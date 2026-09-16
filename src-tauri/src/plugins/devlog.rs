//! devlog 插件（Rust 侧）：轮次目录管理 + 标注导出。
//!
//! 与 plugins/devlog/main/{store,render}.ts 的行为对齐：
//! 目录布局、文件顺序、裁切留白、Markdown 结构都保持原样，
//! 这样 devlog/rounds 里已经归档的轮次与 bin/round.mjs 的工作流都不用改。

use std::fs;
use std::path::Path;
use std::time::Duration;

use chrono::{Local, SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::{json, Map, Value as Json};
use tauri::Manager;

use crate::shot;

#[derive(Deserialize)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Target {
    #[serde(default)]
    selector: String,
    #[serde(default)]
    component: Option<String>,
    #[serde(default)]
    tag: String,
    #[serde(default)]
    classes: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    parent_chain: Vec<String>,
    #[serde(default)]
    styles: Map<String, Json>,
    #[serde(default)]
    attributes: Map<String, Json>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Annotation {
    index: i64,
    comment: String,
    category: String,
    severity: String,
    kind: String,
    rect: Rect,
    #[serde(default)]
    viewport: Option<Json>,
    target: Target,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPayload {
    annotations: Vec<Annotation>,
    #[serde(default)]
    note: String,
    #[serde(default)]
    view: String,
    #[serde(default = "default_dpr")]
    device_pixel_ratio: f64,
    #[serde(default)]
    app_version: String,
}

fn default_dpr() -> f64 {
    1.0
}

/// 渲染 Markdown 与 Readme 时需要的全部信息
struct ExportRecord<'a> {
    round_id: &'a str,
    exported_at: &'a str,
    view: &'a str,
    note: &'a str,
    viewport: Option<(f64, f64)>,
    dpr: f64,
    app_version: &'a str,
    annotations: &'a [Annotation],
}

/* ------------------------------------------------------------------ 轮次 */

pub fn list_rounds(workspace: &Path) -> Result<Json, String> {
    let rounds_dir = workspace.join("devlog").join("rounds");
    if !rounds_dir.is_dir() {
        return Ok(json!([]));
    }

    let mut rounds: Vec<Json> = Vec::new();
    let entries = fs::read_dir(&rounds_dir).map_err(|e| format!("读取轮次目录失败: {e}"))?;
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let annotation_count = fs::read_to_string(dir.join("annotations.json"))
            .ok()
            .and_then(|raw| serde_json::from_str::<Json>(&raw).ok())
            .and_then(|v| v.get("annotations")?.as_array().map(|list| list.len()))
            .unwrap_or(0);
        rounds.push(json!({
            "id": name,
            "dir": dir.to_string_lossy(),
            "createdAt": created_at(&name),
            "annotationCount": annotation_count,
            "hasScreenshot": dir.join("screenshots").join("00-full.png").exists()
        }));
    }
    rounds.sort_by(|a, b| {
        a.get("id")
            .and_then(Json::as_str)
            .unwrap_or("")
            .cmp(b.get("id").and_then(Json::as_str).unwrap_or(""))
    });
    Ok(Json::Array(rounds))
}

/// 目录名形如 0014-20260916-1802 时取出 20260916-1802；否则原样返回（旧版判据是 /^\d{8}-\d{4}/）
fn created_at(name: &str) -> String {
    let bytes = name.as_bytes();
    let digits = |start: usize, len: usize| {
        bytes.len() >= start + len && bytes[start..start + len].iter().all(u8::is_ascii_digit)
    };
    if digits(0, 8) && bytes.get(8) == Some(&b'-') && digits(9, 4) {
        return name[..13].to_string();
    }
    name.to_string()
}

/* ------------------------------------------------------------ 标注导出 */

pub fn export_annotations(
    app: &tauri::AppHandle,
    workspace: &Path,
    payload: Json,
) -> Result<Json, String> {
    let data: ExportPayload =
        serde_json::from_value(payload.clone()).map_err(|e| format!("导出参数不合法：{e}"))?;
    // 落盘的 annotations.json 要保留原始标注对象（含 pageRect / scroll / target），不能过结构体再序列化
    let raw_annotations = payload.get("annotations").cloned().unwrap_or_else(|| json!([]));

    let rounds_dir = workspace.join("devlog").join("rounds");
    let round_id = format!("{:04}-{}", count_rounds(&rounds_dir) + 1, stamp());
    let dir = rounds_dir.join(&round_id);
    let shots_dir = dir.join("screenshots");
    fs::create_dir_all(&shots_dir).map_err(|e| format!("创建轮次目录失败: {e}"))?;

    let mut files: Vec<String> = Vec::new();
    let dpr = if data.device_pixel_ratio > 0.0 {
        data.device_pixel_ratio
    } else {
        1.0
    };

    if let Some(full) = capture_full(app) {
        let full_path = shots_dir.join("00-full.png");
        full.save_with_format(&full_path, image::ImageFormat::Png)
            .map_err(|e| format!("写入整页截图失败: {e}"))?;
        files.push("screenshots/00-full.png".to_string());

        let (image_width, image_height) = full.dimensions();
        for annotation in &data.annotations {
            let name = format!("{:03}-{}.png", annotation.index, slugify(&annotation.comment));
            let x = clamp(annotation.rect.x * dpr - 12.0, 0.0, image_width as f64);
            let y = clamp(annotation.rect.y * dpr - 12.0, 0.0, image_height as f64);
            let width = clamp(annotation.rect.width * dpr + 24.0, 1.0, image_width as f64 - x);
            let height = clamp(annotation.rect.height * dpr + 24.0, 1.0, image_height as f64 - y);
            if width < 1.0 || height < 1.0 {
                continue;
            }
            let crop =
                image::imageops::crop_imm(&full, x as u32, y as u32, width as u32, height as u32)
                    .to_image();
            // 单条裁切失败不影响整体导出
            if crop
                .save_with_format(shots_dir.join(&name), image::ImageFormat::Png)
                .is_ok()
            {
                files.push(format!("screenshots/{name}"));
            }
        }
    }

    let exported_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let viewport = data.annotations.first().and_then(viewport_of);
    let record = ExportRecord {
        round_id: &round_id,
        exported_at: &exported_at,
        view: &data.view,
        note: &data.note,
        viewport,
        dpr,
        app_version: &data.app_version,
        annotations: &data.annotations,
    };

    let json_body = json!({
        "roundId": round_id,
        "exportedAt": exported_at,
        "view": data.view,
        "note": data.note,
        "viewport": viewport.map(|(width, height)| json!({ "width": width, "height": height })),
        "devicePixelRatio": dpr,
        "appVersion": data.app_version,
        "annotations": raw_annotations
    });
    fs::write(
        dir.join("annotations.json"),
        serde_json::to_string_pretty(&json_body).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("写入 annotations.json 失败: {e}"))?;
    files.push("annotations.json".to_string());

    fs::write(dir.join("annotations.md"), render_markdown(&record))
        .map_err(|e| format!("写入 annotations.md 失败: {e}"))?;
    files.push("annotations.md".to_string());

    if !dir.join("README.md").exists() {
        fs::write(dir.join("README.md"), render_round_readme(&record))
            .map_err(|e| format!("写入 README.md 失败: {e}"))?;
        files.push("README.md".to_string());
    }

    Ok(json!({
        "roundId": round_id,
        "roundDir": dir.to_string_lossy(),
        "files": files
    }))
}

fn count_rounds(rounds_dir: &Path) -> usize {
    fs::read_dir(rounds_dir)
        .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).count())
        .unwrap_or(0)
}

fn stamp() -> String {
    Local::now().format("%Y%m%d-%H%M").to_string()
}

fn viewport_of(annotation: &Annotation) -> Option<(f64, f64)> {
    let viewport = annotation.viewport.as_ref()?;
    Some((
        viewport.get("width")?.as_f64()?,
        viewport.get("height")?.as_f64()?,
    ))
}

/// 抓整页：等界面重绘（旧版 invalidate + 320ms），再抓客户区像素
fn capture_full(app: &tauri::AppHandle) -> Option<image::RgbaImage> {
    let win = app.get_webview_window("main")?;
    std::thread::sleep(Duration::from_millis(320));
    let (width, height, rgba) = shot::capture_rgba(&win).ok()?;
    image::RgbaImage::from_raw(width, height, rgba)
}

/* -------------------------------------------------------------- Markdown */

fn render_round_readme(record: &ExportRecord) -> String {
    let viewport = match record.viewport {
        Some((width, height)) => format!("{width}×{height}"),
        None => "未知".to_string(),
    };
    let note = if record.note.is_empty() {
        "（待补充）".to_string()
    } else {
        record.note.to_string()
    };
    format!(
        "# 轮次 {round_id}

> 由页面标注工具自动生成，请在完成本轮改动后补全下面的小节。

## 背景

<!-- 这一轮要解决什么问题、由谁提出 -->

{note}

## 反馈标注

共 {count} 条，详见 [`annotations.md`](annotations.md) 与 [`annotations.json`](annotations.json)。

导出时视口 {viewport}，界面 {view}，应用版本 {app_version}。

## 改动

<!-- 逐条说明做了什么，以及为什么这么做（含取舍） -->

## 验证

<!-- 跑了哪些测试、截图证据、以及没能验证到的部分 -->

## 遗留

<!-- 本轮没做、留待下轮的事项 -->
",
        round_id = record.round_id,
        note = note,
        count = record.annotations.len(),
        viewport = viewport,
        view = record.view,
        app_version = record.app_version,
    )
}

fn render_markdown(record: &ExportRecord) -> String {
    let mut lines: Vec<String> = Vec::new();
    lines.push(format!("# 界面标注 · 轮次 {}", record.round_id));
    lines.push(String::new());
    lines.push(format!("- 导出时间：{}", record.exported_at));
    lines.push(format!("- 所在界面：{}", record.view));
    if let Some((width, height)) = record.viewport {
        lines.push(format!("- 视口：{width}×{height}（DPR {}）", record.dpr));
    }
    lines.push(format!("- 应用版本：{}", record.app_version));
    lines.push(format!("- 标注条数：{}", record.annotations.len()));
    if !record.note.is_empty() {
        lines.push(String::new());
        lines.push("## 总体说明".to_string());
        lines.push(String::new());
        lines.push(record.note.to_string());
    }
    lines.push(String::new());
    lines.push("## 逐条标注".to_string());
    lines.push(String::new());

    for annotation in record.annotations {
        lines.extend(render_one(annotation));
    }
    lines.join("\n")
}

fn render_one(annotation: &Annotation) -> Vec<String> {
    let target = &annotation.target;
    let mut lines: Vec<String> = Vec::new();
    let title = first_line(&annotation.comment);
    lines.push(format!(
        "### {}. {}",
        annotation.index,
        if title.is_empty() { "(无标题)" } else { &title }
    ));
    lines.push(String::new());
    lines.push(format!(
        "- **类别**：{} ｜ **优先级**：{} ｜ **方式**：{}",
        category_label(&annotation.category),
        severity_label(&annotation.severity),
        if annotation.kind == "element" { "点选元素" } else { "框选区域" }
    ));
    if let Some(component) = target.component.as_ref().filter(|value| !value.is_empty()) {
        lines.push(format!("- **组件**：`{component}`"));
    }
    lines.push(format!("- **选择器**：`{}`", target.selector));
    if !target.parent_chain.is_empty() {
        let chain = target
            .parent_chain
            .iter()
            .map(|item| format!("`{item}`"))
            .collect::<Vec<_>>()
            .join(" ← ");
        lines.push(format!("- **父级链**：{chain}"));
    }
    if !target.text.is_empty() {
        let collapsed = target.text.split_whitespace().collect::<Vec<_>>().join(" ");
        lines.push(format!("- **元素文本**：{}", truncate(&collapsed, 120)));
    }
    lines.push(format!(
        "- **位置尺寸**：x={} y={} {}×{}",
        annotation.rect.x.round() as i64,
        annotation.rect.y.round() as i64,
        annotation.rect.width.round() as i64,
        annotation.rect.height.round() as i64
    ));
    let styles = render_style_pairs(&target.styles);
    if !styles.is_empty() {
        lines.push(format!("- **关键样式**：{styles}"));
    }
    let attributes = render_attributes(&target.attributes);
    if !attributes.is_empty() {
        lines.push(format!("- **属性**：{attributes}"));
    }
    lines.push(String::new());
    lines.push(
        annotation
            .comment
            .split('\n')
            .map(|line| format!("> {line}"))
            .collect::<Vec<_>>()
            .join("\n"),
    );
    lines.push(String::new());
    lines
}

fn render_style_pairs(map: &Map<String, Json>) -> String {
    let mut items: Vec<(&String, &Json)> = map.iter().collect();
    items.sort_by(|a, b| a.0.cmp(b.0));
    items
        .iter()
        .map(|(key, value)| format!("{key}: {}", json_text(value)))
        .collect::<Vec<_>>()
        .join("; ")
}

fn render_attributes(map: &Map<String, Json>) -> String {
    let mut items: Vec<(&String, &Json)> = map.iter().collect();
    items.sort_by(|a, b| a.0.cmp(b.0));
    items
        .iter()
        .map(|(key, value)| format!("{key}=\"{}\"", truncate(&json_text(value), 40)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn json_text(value: &Json) -> String {
    match value {
        Json::String(text) => text.clone(),
        other => other.to_string(),
    }
}

fn category_label(category: &str) -> &'static str {
    match category {
        "style" => "视觉样式",
        "layout" => "布局结构",
        "content" => "文案内容",
        "behavior" => "交互行为",
        "bug" => "缺陷",
        _ => "其它",
    }
}

fn severity_label(severity: &str) -> &'static str {
    match severity {
        "must" => "必须改",
        "should" => "建议改",
        _ => "锦上添花",
    }
}

fn first_line(text: &str) -> String {
    text.lines().next().unwrap_or("").trim().chars().take(60).collect()
}

fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let head: String = text.chars().take(max).collect();
    format!("{head}…")
}

/// 文件名片段：清掉半角与全角标点，中文保留
fn slugify(text: &str) -> String {
    const PUNCTUATION: &str = "/\\:*?\"<>|：；？！，。、（）【】《》“”‘’…—";
    let cleaned: String = first_line(text)
        .chars()
        .filter(|c| !PUNCTUATION.contains(*c))
        .collect();
    let mut slug = cleaned.split_whitespace().collect::<Vec<_>>().join("-");
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    let slug = slug.trim_matches('-').chars().take(28).collect::<String>();
    if slug.is_empty() {
        "annotation".to_string()
    } else {
        slug
    }
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

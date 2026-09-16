//! 无界面命令行模式（与 Electron 版的 src/main/cli.ts 对齐）。
//!
//!   gugu-gallery.exe --search --word 泳装类分享 --pages 3 --index-only
//!   gugu-gallery.exe --plate ACG图片 --word Pixiv萌图 --pages 5 --max 60
//!   gugu-gallery.exe --pages 1 --max 3 --delay 150 --library D:/Pics/GuguGallery
//!   gugu-gallery.exe imgdiff a.png b.png
//!
//! 除了给自动化留一个入口，它也是最快的端到端自检：走的是和界面完全一样的
//! 引擎、HTTP 客户端与落盘逻辑。
//!
//! 注意：发布构建是无控制台子系统（windows_subsystem = "windows"），
//! 直接双击/在终端里跑不会显示输出；重定向到管道或文件（脚本里就是这么用的）正常。

use std::path::PathBuf;
use std::time::Duration;

use serde_json::{json, Value as Json};
use tauri::Manager;

use crate::crawler::engine::CrawlRequest;
use crate::AppState;

struct Args {
    plate: String,
    word: String,
    pages: Option<i64>,
    from: i64,
    max: Option<i64>,
    index_only: bool,
    no_enrich: bool,
    search: bool,
    library: Option<String>,
    delay: Option<u64>,
    concurrency: Option<usize>,
    include_tags: Vec<String>,
    exclude_tags: Vec<String>,
}

fn value_of(argv: &[String], name: &str) -> Option<String> {
    let flag = format!("--{name}");
    let index = argv.iter().position(|a| *a == flag)?;
    argv.get(index + 1).cloned()
}

fn number_of(argv: &[String], name: &str) -> Option<i64> {
    value_of(argv, name).and_then(|v| v.parse().ok())
}

fn list_of(argv: &[String], name: &str) -> Vec<String> {
    value_of(argv, name)
        .map(|raw| {
            raw.split(|c: char| c == ',' || c == '，' || c.is_whitespace())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

impl Args {
    fn parse(argv: &[String]) -> Self {
        Self {
            plate: value_of(argv, "plate").unwrap_or_else(|| "ACG图片".to_string()),
            word: value_of(argv, "word").unwrap_or_else(|| "Pixiv萌图".to_string()),
            pages: number_of(argv, "pages"),
            from: number_of(argv, "from").unwrap_or(1),
            max: number_of(argv, "max"),
            index_only: argv.iter().any(|a| a == "--index-only"),
            no_enrich: argv.iter().any(|a| a == "--no-enrich"),
            search: argv.iter().any(|a| a == "--search"),
            library: value_of(argv, "library"),
            delay: number_of(argv, "delay").map(|v| v.max(0) as u64),
            concurrency: number_of(argv, "concurrency").map(|v| v.max(1) as usize),
            include_tags: list_of(argv, "include"),
            exclude_tags: list_of(argv, "exclude"),
        }
    }
}

/// 带 -- 开头参数即进入命令行模式（无参数则是正常界面）
pub fn is_cli_mode(argv: &[String]) -> bool {
    argv.iter().skip(1).any(|a| a.starts_with("--"))
}

/// --library 要在打开图库之前生效，所以必须在建 AppState 之前调用
pub fn apply_library_arg(argv: &[String]) {
    if let Some(library) = value_of(argv, "library") {
        std::env::set_var("GUGU_LIBRARY_ROOT", library);
    }
}

pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let code = run(app.clone()).await;
        app.exit(code);
    });
}

async fn run(app: tauri::AppHandle) -> i32 {
    let argv: Vec<String> = std::env::args().collect();
    let args = Args::parse(&argv);
    let quiet = argv.iter().any(|a| a == "--quiet");

    let (engine, db, root, settings) = {
        let state = app.state::<AppState>();
        let engine = state.engine.lock().unwrap().clone();
        let db = state.db.clone();
        let root = state.lib.lock().unwrap().root.clone();
        let settings = state.settings.lock().unwrap().get();
        (engine, db, root, settings)
    };
    let Some(engine) = engine else {
        eprintln!("[cli] 引擎尚未就绪");
        return 1;
    };

    let setting = |key: &str, fallback: i64| settings.get(key).and_then(Json::as_i64).unwrap_or(fallback);
    let page_to = args.pages.map(|pages| args.from + pages - 1);
    let request = json!({
        "targets": [if args.search {
            json!({ "kind": "search", "word": args.word })
        } else {
            json!({ "kind": "category", "plate": args.plate, "word": args.word })
        }],
        "pageFrom": args.from,
        "pageTo": page_to,
        "maxItems": args.max,
        "indexOnly": args.index_only,
        "download": !args.index_only,
        "enrich": !args.no_enrich,
        "skipExisting": true,
        "listConcurrency": args.concurrency.unwrap_or_else(|| setting("listConcurrency", 2) as usize),
        "downloadConcurrency": args.concurrency.unwrap_or_else(|| setting("downloadConcurrency", 3) as usize),
        "delayMs": args.delay.unwrap_or_else(|| setting("delayMs", 220) as u64),
        "retries": setting("retries", 4) as u32,
        "includeTags": args.include_tags,
        "excludeTags": args.exclude_tags,
        "resumeFromMarks": false,
        "minWidth": 0,
        "minBytes": 0
    });
    let request: CrawlRequest = match serde_json::from_value(request) {
        Ok(request) => request,
        Err(err) => {
            eprintln!("[cli] 参数有误: {err}");
            return 1;
        }
    };

    println!("[cli] 图库目录: {}", root.display());
    println!(
        "[cli] 目标: {} / {}  页 {}..{}",
        if args.search { "搜索" } else { args.plate.as_str() },
        args.word,
        args.from,
        page_to.map(|v| v.to_string()).unwrap_or_else(|| "自动".to_string())
    );
    println!(
        "[cli] 模式: {}{}",
        if args.index_only { "仅索引" } else { "索引 + 下载" },
        args.max.map(|max| format!(" 最多 {max} 张")).unwrap_or_default()
    );

    if let Err(err) = engine.start(request) {
        eprintln!("[cli] 启动失败: {err}");
        return 1;
    }

    let mut last_phase = String::new();
    let mut last_stable = String::new();
    let mut last_print = std::time::Instant::now();
    loop {
        let snapshot = engine.progress();
        if let Some(progress) = snapshot.as_object() {
            let phase = progress.get("phase").and_then(Json::as_str).unwrap_or("");
            if phase != last_phase {
                last_phase = phase.to_string();
                println!("[cli] 阶段 -> {phase}");
            }
            if !quiet {
                // 只在「稳定字段」变化或每 2 秒打一次，避免速率抖动刷屏
                let stable = format!(
                    "{}|{}|{}|{}|{}|{}",
                    progress.get("pagesDone").and_then(Json::as_i64).unwrap_or(0),
                    progress.get("itemsFound").and_then(Json::as_i64).unwrap_or(0),
                    progress.get("downloaded").and_then(Json::as_i64).unwrap_or(0),
                    progress.get("downloadTotal").and_then(Json::as_i64).unwrap_or(0),
                    progress.get("failed").and_then(Json::as_i64).unwrap_or(0),
                    progress.get("currentLabel").and_then(Json::as_str).unwrap_or("")
                );
                if stable != last_stable || last_print.elapsed() >= Duration::from_secs(2) {
                    let line = progress_line(&snapshot);
                    if !line.is_empty() {
                        println!("[cli] {line}");
                    }
                    last_stable = stable;
                    last_print = std::time::Instant::now();
                }
            }
        }
        if !engine.is_running() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    let stats = {
        let conn = db.lock().unwrap();
        crate::store::stats(&conn, &root.to_string_lossy(), 0)
    };
    match stats {
        Ok(stats) => {
            let items = stats.get("items").and_then(Json::as_i64).unwrap_or(0);
            let downloaded = stats.get("downloaded").and_then(Json::as_i64).unwrap_or(0);
            let bytes = stats.get("totalBytes").and_then(Json::as_i64).unwrap_or(0);
            println!(
                "[cli] 完成：索引 {items} 条，已下载 {downloaded} 张，占用 {:.1} MB",
                bytes as f64 / 1024.0 / 1024.0
            );
            0
        }
        Err(err) => {
            eprintln!("[cli] 统计失败: {err}");
            1
        }
    }
}

/// 进展一行：页码 / 条目 / 下载数 / 失败数
fn progress_line(progress: &Json) -> String {
    let number = |key: &str| progress.get(key).and_then(Json::as_i64).unwrap_or(0);
    let pages_done = number("pagesDone");
    if pages_done == 0 && number("itemsFound") == 0 {
        return String::new();
    }
    let pages_total = progress.get("pagesTotal").and_then(Json::as_i64);
    let download_total = progress.get("downloadTotal").and_then(Json::as_i64);
    format!(
        "页 {}/{}{} · 条目 {} · 下载 {}/{}{} · 失败 {}",
        pages_done,
        pages_total.map(|v| v.to_string()).unwrap_or_else(|| "?".to_string()),
        progress
            .get("currentLabel")
            .and_then(Json::as_str)
            .filter(|label| !label.is_empty())
            .map(|label| format!(" ({label})"))
            .unwrap_or_default(),
        number("itemsFound"),
        number("downloaded"),
        download_total.map(|v| v.to_string()).unwrap_or_else(|| "?".to_string()),
        progress
            .get("speedBps")
            .and_then(Json::as_f64)
            .filter(|speed| *speed > 0.0)
            .map(|speed| format!(" @ {:.0} KB/s", speed / 1024.0))
            .unwrap_or_default(),
        number("failed")
    )
}

/* ------------------------------------------------------------ 截图对比 */

/// 粗略比较两张截图的差异面积占比（原来是 Electron 版的 scripts/imgdiff.cjs）
pub fn run_imgdiff(argv: &[String]) -> i32 {
    let paths: Vec<PathBuf> = argv
        .iter()
        .skip(1)
        .filter(|a| !a.starts_with("--") && a.as_str() != "imgdiff")
        .map(PathBuf::from)
        .collect();
    if paths.len() < 2 {
        eprintln!("用法: gugu-gallery.exe imgdiff <图A> <图B>");
        return 1;
    }

    let load = |path: &PathBuf| match image::open(path) {
        Ok(image) => Some(image.to_rgba8()),
        Err(err) => {
            eprintln!("[imgdiff] 读取 {} 失败: {err}", path.display());
            None
        }
    };
    let (Some(a), Some(b)) = (load(&paths[0]), load(&paths[1])) else {
        return 1;
    };
    println!(
        "[imgdiff] 尺寸 {}x{} / {}x{}",
        a.width(),
        a.height(),
        b.width(),
        b.height()
    );
    if a.dimensions() != b.dimensions() {
        println!("[imgdiff] 尺寸不同，差异面积按较大者计：100%");
        return 0;
    }

    let mut different = 0usize;
    let mut total_delta = 0f64;
    for (left, right) in a.pixels().zip(b.pixels()) {
        let delta = (0..3)
            .map(|i| (left.0[i] as i32 - right.0[i] as i32).unsigned_abs() as f64)
            .sum::<f64>();
        total_delta += delta / 3.0;
        if delta / 3.0 > 8.0 {
            different += 1;
        }
    }
    let pixels = (a.width() as usize) * (a.height() as usize);
    println!(
        "[imgdiff] 差异像素 {:.2}%（阈值 8/255），平均通道差 {:.2}",
        different as f64 * 100.0 / pixels as f64,
        total_delta / pixels as f64
    );
    0
}

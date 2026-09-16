//! 插件宿主（Tauri 侧）。
//!
//! Electron 版的主进程插件是编译出来的 JS 模块；Tauri 没有 Node 运行时，
//! 所以这一层直接用 Rust 实现，方法名与参数与旧版逐个对齐：
//!   devlog.listRounds        → 列出 devlog/rounds 下的轮次
//!   devlog.exportAnnotations → 把一次标注导出成完整的轮次目录（截图 + 裁片 + JSON + Markdown）
//!
//! 插件只在开发构建里启用：发布产物本身也不打包插件代码（渲染层由 GUGU_PLUGINS 控制），
//! 因此这里用 debug_assertions 做闸门，发布版永远返回空清单。

mod devlog;

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value as Json};

/// 插件目录的上级（= 仓库根）。发布构建里一律当作没有插件。
fn repo_root() -> Option<PathBuf> {
    if !cfg!(debug_assertions) {
        return None;
    }
    let root = PathBuf::from(env!("GUGU_REPO_ROOT"));
    if root.join("plugins").is_dir() {
        Some(root)
    } else {
        None
    }
}

fn read_json(path: &Path) -> Option<Json> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

fn string_list(value: Option<&Json>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|list| list.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default()
}

/// plugins.json 里登记且依赖齐全的插件（与渲染层同一套判据）
fn enabled_ids(root: &Path) -> Vec<String> {
    let plugins_dir = root.join("plugins");
    let Some(config) = read_json(&plugins_dir.join("plugins.json")) else {
        return Vec::new();
    };
    let ids = string_list(config.get("enabled"));
    ids.iter()
        .filter(|id| {
            let Some(manifest) = read_json(&plugins_dir.join(id).join("plugin.json")) else {
                return false;
            };
            string_list(manifest.get("dependsOn"))
                .iter()
                .all(|dep| ids.contains(dep))
        })
        .cloned()
        .collect()
}

pub fn list() -> Vec<Json> {
    let Some(root) = repo_root() else {
        return Vec::new();
    };
    let plugins_dir = root.join("plugins");
    enabled_ids(&root)
        .iter()
        .filter_map(|id| {
            let manifest = read_json(&plugins_dir.join(id).join("plugin.json"))?;
            Some(json!({
                "id": manifest.get("id").cloned().unwrap_or_else(|| json!(id)),
                "name": manifest.get("name").cloned().unwrap_or_else(|| json!(id)),
                "version": manifest.get("version").cloned().unwrap_or_else(|| json!("0.0.0")),
                "description": manifest.get("description").cloned().unwrap_or_else(|| json!(""))
            }))
        })
        .collect()
}

pub fn invoke(
    app: &tauri::AppHandle,
    plugin_id: &str,
    method: &str,
    payload: Option<Json>,
) -> Result<Json, String> {
    let root = repo_root().ok_or_else(|| "插件只在开发构建里启用".to_string())?;
    if !enabled_ids(&root).iter().any(|id| id == plugin_id) {
        return Err(format!("插件没有启用：{plugin_id}"));
    }
    match (plugin_id, method) {
        ("devlog", "listRounds") => devlog::list_rounds(&workspace_root()),
        ("devlog", "exportAnnotations") => {
            let payload = payload.ok_or_else(|| "导出参数不合法：缺少 annotations".to_string())?;
            devlog::export_annotations(app, &workspace_root(), payload)
        }
        _ => Err(format!("插件 {plugin_id} 没有注册方法 {method}")),
    }
}

/// 插件产物落点：GUGU_WORKSPACE 优先，其次仓库根（开发态），最后用户数据目录
fn workspace_root() -> PathBuf {
    if let Ok(dir) = std::env::var("GUGU_WORKSPACE") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    if let Some(root) = repo_root() {
        return root;
    }
    crate::user_data_dir().join("workspace")
}

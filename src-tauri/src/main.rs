// 咕咕图库 · Tauri 外壳（重构中）
//
// 这一版先把「渲染层 + 桥」跑通：所有命令都按 @shared/bridge 的契约注册，
// 具体实现按模块（store / crawler / media / session）逐步替换掉这里的占位实现。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use tauri::Manager;

/* ------------------------------------------------------------------ 占位实现 */

#[tauri::command]
fn app_info(state: tauri::State<'_, AppState>) -> Value {
    json!({
        "version": env!("GUGU_APP_VERSION"),
        "electron": "",
        "node": "",
        "chrome": "",
        "platform": std::env::consts::OS,
        "packaged": !cfg!(debug_assertions),
        "libraryRoot": state.library_root,
        "dbPath": ""
    })
}

#[tauri::command]
fn settings_get(state: tauri::State<'_, AppState>) -> Value {
    state.settings.clone()
}

#[tauri::command]
fn settings_set(patch: Value, state: tauri::State<'_, AppState>) -> Value {
    let mut current = state.settings.clone();
    if let (Some(dst), Some(src)) = (current.as_object_mut(), patch.as_object()) {
        for (k, v) in src {
            dst.insert(k.clone(), v.clone());
        }
    }
    current
}

#[tauri::command]
fn suggested_library_root(state: tauri::State<'_, AppState>) -> String {
    state.library_root.clone()
}

/* -------------------------------------------------------------------- 图库 */

#[tauri::command]
fn library_stats(state: tauri::State<'_, AppState>) -> Value {
    json!({
        "items": 0,
        "downloaded": 0,
        "favorites": 0,
        "totalBytes": 0,
        "plates": [],
        "topTags": [],
        "sources": 0,
        "libraryRoot": state.library_root,
        "dbBytes": 0
    })
}

#[tauri::command]
fn library_facets() -> Value {
    json!({ "plates": [], "topTags": [], "words": [], "targets": [] })
}

#[tauri::command]
fn library_query(_query: Option<Value>) -> Value {
    json!({ "items": [], "nextCursor": null, "total": 0 })
}

#[tauri::command]
fn library_item(_id: i64) -> Value {
    Value::Null
}

#[tauri::command]
fn library_favorite(_id: i64, value: bool) -> bool {
    value
}

#[tauri::command]
fn library_rating(_id: i64, value: i64) -> i64 {
    value
}

#[tauri::command]
fn library_remove(_ids: Vec<i64>, _delete_files: bool) -> i64 {
    0
}

#[tauri::command]
fn library_reveal(_id: i64) -> bool {
    false
}

#[tauri::command]
fn library_pick_root() -> Value {
    Value::Null
}

#[tauri::command]
fn library_choose_dir(_default_path: Option<String>) -> Value {
    Value::Null
}

#[tauri::command]
fn library_set_root(dir: String) -> String {
    dir
}

/* -------------------------------------------------------------------- 抓取 */

#[tauri::command]
fn crawl_site_info() -> Value {
    json!({ "plates": [], "fetchedAt": 0 })
}

#[tauri::command]
fn crawl_target_info(_target: Option<Value>) -> Value {
    json!({ "totalPages": null, "totalItems": null })
}

#[tauri::command]
fn crawl_start(_request: Option<Value>) -> Value {
    Value::Null
}

#[tauri::command]
fn crawl_pause() -> bool {
    false
}

#[tauri::command]
fn crawl_resume() -> bool {
    false
}

#[tauri::command]
fn crawl_cancel() -> bool {
    false
}

#[tauri::command]
fn crawl_download_items(_ids: Vec<i64>) -> i64 {
    0
}

#[tauri::command]
fn crawl_progress() -> Value {
    Value::Null
}

#[tauri::command]
fn crawl_jobs() -> Value {
    json!([])
}

#[tauri::command]
fn sources_list() -> Value {
    json!([])
}

#[tauri::command]
fn sources_remove(_id: i64) -> bool {
    false
}

#[tauri::command]
fn sources_toggle(_id: i64, _enabled: bool) -> bool {
    false
}

/* ------------------------------------------------------------------ 登录态 */

#[tauri::command]
fn session_status() -> Value {
    json!({
        "loggedIn": false,
        "fingerprint": Value::Null,
        "savedAt": Value::Null,
        "encrypted": false,
        "verified": Value::Null,
        "verifyMessage": Value::Null
    })
}

#[tauri::command]
fn session_set(_cookie: String) -> Value {
    json!({
        "status": session_status(),
        "verify": { "ok": false, "state": "none", "message": "重构中：登录态尚未接入" }
    })
}

#[tauri::command]
fn session_clear() -> Value {
    session_status()
}

#[tauri::command]
fn session_verify() -> Value {
    json!({
        "status": session_status(),
        "verify": { "ok": false, "state": "none", "message": "重构中：登录态尚未接入" }
    })
}

/* -------------------------------------------------------------- 插件 / 系统 */

#[tauri::command]
fn plugins_list() -> Value {
    json!([])
}

#[tauri::command]
fn plugins_invoke(_plugin_id: String, _method: String, _payload: Option<Value>) -> Value {
    Value::Null
}

#[tauri::command]
fn open_external(url: String) -> bool {
    // 先占位：后面换成 opener 插件，并做 https/http 白名单校验
    println!("[gugu] open_external: {url}");
    false
}

#[tauri::command]
fn copy_text(text: String) -> bool {
    println!("[gugu] copy_text: {} 字", text.chars().count());
    false
}

/* -------------------------------------------------------------------- 状态 */

struct AppState {
    library_root: String,
    settings: Value,
}

fn default_settings(library_root: &str) -> Value {
    json!({
        "libraryRoot": library_root,
        "preferOriginal": true,
        "listConcurrency": 2,
        "downloadConcurrency": 3,
        "delayMs": 220,
        "retries": 4,
        "thumbSize": 512,
        "theme": "dark",
        "accent": "#7c9cff",
        "naming": "id-slug",
        "proxy": "",
        "sidebarCollapsed": false,
        "sidebarWidth": 248,
        "setupCompleted": true,
        "pageSize": 60
    })
}

fn main() {
    let library_root = dirs_library_root();

    tauri::Builder::default()
        .setup(|app| {
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .manage(AppState {
            settings: default_settings(&library_root),
            library_root,
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            settings_get,
            settings_set,
            suggested_library_root,
            library_stats,
            library_facets,
            library_query,
            library_item,
            library_favorite,
            library_rating,
            library_remove,
            library_reveal,
            library_pick_root,
            library_choose_dir,
            library_set_root,
            crawl_site_info,
            crawl_target_info,
            crawl_start,
            crawl_pause,
            crawl_resume,
            crawl_cancel,
            crawl_download_items,
            crawl_progress,
            crawl_jobs,
            sources_list,
            sources_remove,
            sources_toggle,
            session_status,
            session_set,
            session_clear,
            session_verify,
            plugins_list,
            plugins_invoke,
            open_external,
            copy_text
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

/** 默认图库目录：开发态放仓库下的 data/demo，正式版放「图片/GuguGallery」 */
fn dirs_library_root() -> String {
    if cfg!(debug_assertions) {
        let cwd = std::env::current_dir().unwrap_or_default();
        return cwd.join("data").join("demo").to_string_lossy().to_string();
    }
    let home = std::env::var("USERPROFILE").unwrap_or_default();
    format!("{home}\\Pictures\\GuguGallery")
}

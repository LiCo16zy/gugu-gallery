// 咕咕图库 · Tauri 外壳
//
// 从 Electron 版迁移中：渲染层与 SQL 语义保持一致，命令按 @shared/bridge 的契约排列。
// 尚未迁移的部分（爬虫 / 登录态 / 插件）暂时返回占位值。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod library;
mod media;
mod settings;
mod store;

use library::Library;
use rusqlite::Connection;
use serde_json::{json, Value as Json};
use settings::{suggested_library_root, SettingsStore};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct AppState {
    lib: Mutex<Library>,
    db: Mutex<Connection>,
    settings: Mutex<SettingsStore>,
}

const PACKAGED: bool = !cfg!(debug_assertions);

fn user_data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("GUGU_USER_DATA") {
        return PathBuf::from(dir);
    }
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    // 与 Electron 版同一个目录：老用户升级后设置与登录凭据还在
    PathBuf::from(appdata).join("gugu-gallery")
}

fn open_state() -> Result<AppState, String> {
    let settings_file = PathBuf::from(std::env::var("GUGU_SETTINGS_FILE").unwrap_or_else(|_| {
        user_data_dir().join("settings.json").to_string_lossy().to_string()
    }));
    let default_root = suggested_library_root(PACKAGED);
    let mut settings = SettingsStore::load(settings_file, &default_root);
    if let Ok(root) = std::env::var("GUGU_LIBRARY_ROOT") {
        settings.set(&json!({ "libraryRoot": root, "setupCompleted": true }));
    }
    let root = settings.library_root();
    let lib = Library::new(&root);
    lib.ensure().map_err(|e| format!("创建图库目录失败: {e}"))?;
    let conn = store::open(&lib.db_path).map_err(|e| format!("打开索引库失败: {e}"))?;
    Ok(AppState {
        lib: Mutex::new(lib),
        db: Mutex::new(conn),
        settings: Mutex::new(settings),
    })
}


/// 自检钩子：把注入脚本的结果以 __EVAL__ 前缀打到 stdout（沿用 Electron 版的约定）
#[tauri::command]
fn debug_report(payload: Json) {
    use std::io::Write;
    let mut out = std::io::stdout();
    let _ = writeln!(out, "__EVAL__{}", payload);
    let _ = out.flush();
}

/// 自检钩子：启动后注入一段脚本（GUGU_EVAL），脚本用 window.gugu.__report 交回结果
fn run_eval_hook(app: &tauri::AppHandle) {
    eprintln!("[gugu] eval hook 已装配");
    let Ok(script) = std::env::var("GUGU_EVAL") else { return };
    let delay: u64 = std::env::var("GUGU_SHOT_DELAY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2600);
    let Some(win) = app.get_webview_window("main") else { return };
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
        // 直接走 __TAURI_INTERNALS__：桥本身出问题时也能看到东西
        let wrapped = format!(
            "(async () => {{
               const rep = async (p) => {{ try {{ await window.__TAURI_INTERNALS__.invoke('debug_report', {{ payload: p }}); }} catch (e) {{}} }};
               await rep({{ stage: 'start' }});
               try {{ const r = await ({}); await rep(r); }} catch (e) {{ await rep({{ error: String(e) }}); }}
             }})()",
            script
        );
        match win.eval(&wrapped) {
            Ok(_) => eprintln!("[gugu] eval 已注入"),
            Err(err) => eprintln!("[gugu] eval 注入失败: {err}"),
        }
    });
}

/* ------------------------------------------------------------------ 应用信息 */

#[tauri::command]
fn app_info(state: State<'_, AppState>) -> Json {
    let lib = state.lib.lock().unwrap();
    json!({
        "version": env!("GUGU_APP_VERSION"),
        "electron": "",
        "node": "",
        "chrome": "",
        "platform": "win32",
        "packaged": PACKAGED,
        "libraryRoot": lib.root.to_string_lossy(),
        "dbPath": lib.db_path.to_string_lossy()
    })
}

#[tauri::command]
fn settings_get(state: State<'_, AppState>) -> Json {
    state.settings.lock().unwrap().get()
}

#[tauri::command]
fn settings_set(patch: Json, state: State<'_, AppState>) -> Result<Json, String> {
    let (before, next, after) = {
        let mut settings = state.settings.lock().unwrap();
        let before = settings.library_root();
        let next = settings.set(&patch);
        let after = settings.library_root();
        (before, next, after)
    };
    if before != after {
        switch_library(&state, &after)?;
    }
    Ok(next)
}

#[tauri::command]
fn suggested_library_root_cmd() -> String {
    suggested_library_root(PACKAGED)
}

fn switch_library(state: &State<'_, AppState>, root: &str) -> Result<(), String> {
    let lib = Library::new(root);
    lib.ensure().map_err(|e| format!("创建图库目录失败: {e}"))?;
    let conn = store::open(&lib.db_path).map_err(|e| format!("打开索引库失败: {e}"))?;
    *state.lib.lock().unwrap() = lib;
    *state.db.lock().unwrap() = conn;
    Ok(())
}

/* -------------------------------------------------------------------- 图库 */

#[tauri::command]
fn library_stats(state: State<'_, AppState>) -> Result<Json, String> {
    let lib = state.lib.lock().unwrap().clone();
    let db = state.db.lock().unwrap();
    let db_bytes = std::fs::metadata(&lib.db_path).map(|m| m.len() as i64).unwrap_or(0);
    store::stats(&db, &lib.root.to_string_lossy(), db_bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn library_facets(state: State<'_, AppState>) -> Result<Json, String> {
    let db = state.db.lock().unwrap();
    store::facets(&db).map_err(|e| e.to_string())
}

#[tauri::command]
fn library_query(query: Option<Json>, state: State<'_, AppState>) -> Result<Json, String> {
    let q: store::GalleryQuery =
        serde_json::from_value(query.unwrap_or(json!({}))).map_err(|e| e.to_string())?;
    let db = state.db.lock().unwrap();
    store::list_items(&db, &q).map_err(|e| e.to_string())
}

#[tauri::command]
fn library_item(id: i64, state: State<'_, AppState>) -> Result<Json, String> {
    let db = state.db.lock().unwrap();
    Ok(store::get_item(&db, id).map_err(|e| e.to_string())?.unwrap_or(Json::Null))
}

#[tauri::command]
fn library_favorite(id: i64, value: bool, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.db.lock().unwrap();
    store::set_favorite(&db, id, value).map_err(|e| e.to_string())
}

#[tauri::command]
fn library_rating(id: i64, value: i64, state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.db.lock().unwrap();
    store::set_rating(&db, id, value).map_err(|e| e.to_string())
}

#[tauri::command]
fn library_remove(ids: Vec<i64>, delete_files: bool, state: State<'_, AppState>) -> Result<i64, String> {
    let lib = state.lib.lock().unwrap().clone();
    let db = state.db.lock().unwrap();
    if delete_files {
        for id in &ids {
            if let Ok(Some(rel)) = store::file_rel_path(&db, *id, "original") {
                lib.remove(&rel);
            }
            if let Ok(Some(thumb)) = store::thumb_rel_path(&db, *id) {
                lib.remove(&thumb);
            }
        }
    }
    store::delete_items(&db, &ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn library_reveal(id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let lib = state.lib.lock().unwrap().clone();
    let (rel, exists) = {
        let db = state.db.lock().unwrap();
        let rel = store::file_rel_path(&db, id, "original").map_err(|e| e.to_string())?;
        let exists = rel
            .as_deref()
            .and_then(|r| lib.resolve_inside(r))
            .map(|p| p.exists())
            .unwrap_or(false);
        (rel, exists)
    };
    if !exists {
        return Ok(false);
    }
    if let Some(abs) = rel.and_then(|r| lib.resolve_inside(&r)) {
        let _ = std::process::Command::new("explorer").arg("/select,").arg(abs).spawn();
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn library_pick_root() -> Json {
    Json::Null
}

#[tauri::command]
fn library_choose_dir() -> Json {
    Json::Null
}

#[tauri::command]
fn library_set_root(dir: String, state: State<'_, AppState>) -> Result<String, String> {
    switch_library(&state, &dir)?;
    state.settings.lock().unwrap().set(&json!({ "libraryRoot": dir }));
    Ok(dir)
}

/* ------------------------------------------------------------ 抓取源 / 任务 */

#[tauri::command]
fn sources_list(state: State<'_, AppState>) -> Result<Json, String> {
    let db = state.db.lock().unwrap();
    Ok(json!(store::list_sources(&db).map_err(|e| e.to_string())?))
}

#[tauri::command]
fn sources_remove(id: i64, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.db.lock().unwrap();
    db.execute("DELETE FROM sources WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn sources_toggle(id: i64, enabled: bool, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.db.lock().unwrap();
    db.execute(
        "UPDATE sources SET enabled = ?1 WHERE id = ?2",
        rusqlite::params![if enabled { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn crawl_jobs(state: State<'_, AppState>) -> Result<Json, String> {
    let db = state.db.lock().unwrap();
    Ok(json!(store::list_jobs(&db, 30).map_err(|e| e.to_string())?))
}

/* --------------------------------------------- 以下为迁移中的占位（爬虫 / 登录态 / 插件） */

#[tauri::command]
fn crawl_site_info() -> Json {
    json!({ "plates": [], "fetchedAt": 0 })
}

#[tauri::command]
fn crawl_target_info() -> Json {
    json!({ "totalPages": Json::Null, "totalItems": Json::Null })
}

#[tauri::command]
fn crawl_start() -> Json {
    Json::Null
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
fn crawl_download_items() -> i64 {
    0
}

#[tauri::command]
fn crawl_progress() -> Json {
    Json::Null
}

#[tauri::command]
fn session_status() -> Json {
    json!({
        "loggedIn": false,
        "fingerprint": Json::Null,
        "savedAt": Json::Null,
        "encrypted": false,
        "verified": Json::Null,
        "verifyMessage": Json::Null
    })
}

#[tauri::command]
fn session_set() -> Json {
    json!({
        "status": session_status(),
        "verify": { "ok": false, "state": "none", "message": "重构中：登录态尚未接入" }
    })
}

#[tauri::command]
fn session_clear() -> Json {
    session_status()
}

#[tauri::command]
fn session_verify() -> Json {
    json!({
        "status": session_status(),
        "verify": { "ok": false, "state": "none", "message": "重构中：登录态尚未接入" }
    })
}

#[tauri::command]
fn plugins_list() -> Json {
    json!([])
}

#[tauri::command]
fn plugins_invoke() -> Json {
    Json::Null
}

#[tauri::command]
fn open_external(url: String) -> bool {
    let _ = url;
    false
}

#[tauri::command]
fn copy_text(text: String) -> bool {
    let _ = text;
    false
}

fn main() {
    let state = match open_state() {
        Ok(v) => v,
        Err(err) => {
            eprintln!("[gugu] 初始化失败: {err}");
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .manage(state)
        .register_asynchronous_uri_scheme_protocol("gugu", |ctx, request, responder| {
            responder.respond(media::handle(ctx, request));
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            settings_get,
            settings_set,
            suggested_library_root_cmd,
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
            sources_list,
            sources_remove,
            sources_toggle,
            crawl_jobs,
            crawl_site_info,
            crawl_target_info,
            crawl_start,
            crawl_pause,
            crawl_resume,
            crawl_cancel,
            crawl_download_items,
            crawl_progress,
            session_status,
            session_set,
            session_clear,
            session_verify,
            plugins_list,
            plugins_invoke,
            open_external,
            copy_text,
            debug_report
        ])
        .setup(|app| {
            let _ = app.get_webview_window("main");
            run_eval_hook(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

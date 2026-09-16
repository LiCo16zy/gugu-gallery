// 咕咕图库 · Tauri 外壳
//
// 从 Electron 版迁移中：渲染层与 SQL 语义保持一致，命令按 @shared/bridge 的契约排列。
// 尚未迁移的部分（爬虫 / 登录态 / 插件）暂时返回占位值。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod crawler;
mod library;
mod media;
mod plugins;
mod session;
mod settings;
mod shot;
mod store;

use crawler::engine::{CrawlRequest, Engine};
use library::Library;
use rusqlite::Connection;
use serde_json::{json, Value as Json};
use session::SessionStore;
use settings::SettingsStore;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

pub struct AppState {
    lib: Mutex<Library>,
    db: Arc<Mutex<Connection>>,
    settings: Mutex<SettingsStore>,
    session: Mutex<SessionStore>,
    engine: Mutex<Option<Arc<Engine>>>,
}

const PACKAGED: bool = !cfg!(debug_assertions);

pub(crate) fn user_data_dir() -> PathBuf {
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
    let default_root = settings::suggested_library_root(PACKAGED);
    let mut settings = SettingsStore::load(settings_file, &default_root);
    if let Ok(root) = std::env::var("GUGU_LIBRARY_ROOT") {
        settings.set(&json!({ "libraryRoot": root, "setupCompleted": true }));
    }
    let mut session = SessionStore::new();
    session.load();
    let root = settings.library_root();
    let lib = Library::new(&root);
    lib.ensure().map_err(|e| format!("创建图库目录失败: {e}"))?;
    let conn = store::open(&lib.db_path).map_err(|e| format!("打开索引库失败: {e}"))?;
    Ok(AppState {
        lib: Mutex::new(lib),
        db: Arc::new(Mutex::new(conn)),
        settings: Mutex::new(settings),
        session: Mutex::new(session),
        engine: Mutex::new(None),
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

/// DOM 体检结果（截图模式的 GUGU_DIAG）：沿用 Electron 版的 __DIAG__<视图>__<json> 约定
#[tauri::command]
fn debug_diag(view: String, payload: Json, app: tauri::AppHandle) {
    use std::io::Write;
    let mut out = std::io::stdout();
    let _ = writeln!(out, "__DIAG__{}__{}", view, payload);
    let _ = out.flush();
    // 没有 eval 脚本时，体检输出就是最后一步
    if std::env::var("GUGU_EVAL").is_err() {
        app.exit(0);
    }
}

/// eval 脚本跑完后的补拍（渲染进程回调），拍完退出
#[tauri::command]
fn shot_after_eval(app: tauri::AppHandle) {
    shot::capture_after_eval(&app);
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
        // 与 Electron 版的 harness 约定保持一致：__EVAL__{ok,result,error,consoleErrors}
        let wrapped = format!(
            "(async () => {{
               const rep = (p) => window.__TAURI_INTERNALS__.invoke('debug_report', {{ payload: p }});
               try {{ const r = await ({}); await rep({{ ok: true, result: r, consoleErrors: [] }}); }}
               catch (e) {{ await rep({{ ok: false, error: String(e), consoleErrors: [] }}); }}
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
fn suggested_library_root() -> String {
    settings::suggested_library_root(PACKAGED)
}

fn switch_library(state: &State<'_, AppState>, root: &str) -> Result<(), String> {
    let lib = Library::new(root);
    lib.ensure().map_err(|e| format!("创建图库目录失败: {e}"))?;
    let conn = store::open(&lib.db_path).map_err(|e| format!("打开索引库失败: {e}"))?;
    *state.lib.lock().unwrap() = lib;
    let mut guard = state.db.lock().unwrap();
    *guard = conn;
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

/// 选目录：用回调式 API + oneshot 把结果带回 async 命令（不阻塞主线程）
async fn pick_folder(app: &tauri::AppHandle, default_path: Option<String>) -> Json {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut builder = app.dialog().file();
    if let Some(path) = default_path.filter(|p| !p.is_empty()) {
        builder = builder.set_directory(path);
    }
    builder.pick_folder(move |picked| {
        let _ = tx.send(picked);
    });
    match rx.await {
        Ok(Some(path)) => json!(path.to_string()),
        _ => Json::Null,
    }
}

#[tauri::command]
async fn library_pick_root(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<Json, String> {
    let current = state.lib.lock().unwrap().root.to_string_lossy().to_string();
    Ok(pick_folder(&app, Some(current)).await)
}

#[tauri::command]
async fn library_choose_dir(app: tauri::AppHandle, default_path: Option<String>) -> Json {
    pick_folder(&app, default_path).await
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
async fn crawl_site_info(state: State<'_, AppState>) -> Result<Json, String> {
    let settings = state.settings.lock().unwrap().get();
    let proxy = settings.get("proxy").and_then(|v| v.as_str()).map(|s| s.to_string());
    let client = crawler::http::HttpClient::new(crawler::http::HttpOptions {
        delay_ms: 0, retries: 2, timeout_ms: 20_000, concurrency: 1, cookie: None, proxy,
    });
    let html = client
        .get_html(&format!("{}/", crawler::site::SITE_ORIGIN))
        .await
        .map_err(|e| e.0)?;
    let plates = crawler::parser::parse_nav(&html)
        .into_iter()
        .map(|p| json!({ "name": p.name, "words": p.words }))
        .collect::<Vec<_>>();
    Ok(json!({ "plates": plates, "fetchedAt": chrono::Utc::now().timestamp_millis() }))
}

#[tauri::command]
async fn crawl_target_info(target: Option<Json>, state: State<'_, AppState>) -> Result<Json, String> {
    let Some(target) = target else { return Ok(json!({ "totalPages": Json::Null, "totalItems": Json::Null })) };
    let site_target: crawler::site::SiteTarget = serde_json::from_value(target).map_err(|e| e.to_string())?;
    let settings = state.settings.lock().unwrap().get();
    let proxy = settings.get("proxy").and_then(|v| v.as_str()).map(|s| s.to_string());
    let client = crawler::http::HttpClient::new(crawler::http::HttpOptions {
        delay_ms: 0, retries: 2, timeout_ms: 20_000, concurrency: 1, cookie: None, proxy,
    });
    let url = crawler::site::list_url(&site_target, 1)?;
    match client.get_html(&url).await {
        Ok(html) => {
            let (pages, items) = crawler::parser::parse_pagination(&html);
            Ok(json!({ "totalPages": pages, "totalItems": items }))
        }
        Err(err) => Err(err.0),
    }
}

#[tauri::command]
fn crawl_start(request: Option<Json>, state: State<'_, AppState>) -> Result<i64, String> {
    let engine = state.engine.lock().unwrap().clone().ok_or("引擎尚未就绪")?;
    let request: CrawlRequest = serde_json::from_value(request.unwrap_or(json!({}))).map_err(|e| e.to_string())?;
    engine.start(request)
}

#[tauri::command]
fn crawl_pause(state: State<'_, AppState>) -> bool {
    state.engine.lock().unwrap().clone().map(|e| e.pause()).unwrap_or(false)
}

#[tauri::command]
fn crawl_resume(state: State<'_, AppState>) -> bool {
    state.engine.lock().unwrap().clone().map(|e| e.resume()).unwrap_or(false)
}

#[tauri::command]
fn crawl_cancel(state: State<'_, AppState>) -> bool {
    state.engine.lock().unwrap().clone().map(|e| e.cancel()).unwrap_or(false)
}

#[tauri::command]
fn crawl_download_items(ids: Vec<i64>, state: State<'_, AppState>) -> Result<i64, String> {
    let engine = state.engine.lock().unwrap().clone().ok_or("引擎尚未就绪")?;
    let settings = state.settings.lock().unwrap().get();
    let request = CrawlRequest {
        download: true,
        max_items: Some(ids.len() as i64),
        delay_ms: settings.get("delayMs").and_then(|v| v.as_u64()).unwrap_or(220),
        retries: settings.get("retries").and_then(|v| v.as_u64()).unwrap_or(4) as u32,
        download_concurrency: settings.get("downloadConcurrency").and_then(|v| v.as_u64()).unwrap_or(3) as usize,
        ..Default::default()
    };
    engine.start_ids(ids, request)
}

#[tauri::command]
fn crawl_progress(state: State<'_, AppState>) -> Json {
    state.engine.lock().unwrap().clone().map(|e| e.progress()).unwrap_or(Json::Null)
}

#[tauri::command]
fn session_status(state: State<'_, AppState>) -> Json {
    state.session.lock().unwrap().status()
}

#[tauri::command]
async fn session_set(cookie: String, state: State<'_, AppState>) -> Result<Json, String> {
    let proxy = state.settings.lock().unwrap().get().get("proxy").and_then(|v| v.as_str()).map(|s| s.to_string());
    {
        let mut session = state.session.lock().unwrap();
        session.save(&cookie)?;
    }
    let header = state.session.lock().unwrap().cookie_for_verify();
    let (verify, verify_state, message) = session::verify_cookie(header, proxy).await;
    let status = {
        let mut session = state.session.lock().unwrap();
        session.apply_verify(&verify_state, &message);
        session.status()
    };
    if let Some(engine) = state.engine.lock().unwrap().clone() {
        engine.set_cookie(state.session.lock().unwrap().cookie_header());
    }
    Ok(json!({ "status": status, "verify": verify }))
}

#[tauri::command]
fn session_clear(state: State<'_, AppState>) -> Json {
    let status = {
        let mut session = state.session.lock().unwrap();
        session.clear();
        session.status()
    };
    if let Some(engine) = state.engine.lock().unwrap().clone() {
        engine.set_cookie(None);
    }
    status
}

#[tauri::command]
async fn session_verify(state: State<'_, AppState>) -> Result<Json, String> {
    let proxy = state.settings.lock().unwrap().get().get("proxy").and_then(|v| v.as_str()).map(|s| s.to_string());
    let header = state.session.lock().unwrap().cookie_for_verify();
    let (verify, verify_state, message) = session::verify_cookie(header, proxy).await;
    let status = {
        let mut session = state.session.lock().unwrap();
        session.apply_verify(&verify_state, &message);
        session.status()
    };
    Ok(json!({ "status": status, "verify": verify }))
}

#[tauri::command]
fn plugins_list() -> Json {
    json!(plugins::list())
}

/// 插件方法调用：宿主只按 (插件 id, 方法名) 分发，核心代码不知道具体插件
#[tauri::command]
fn plugins_invoke(
    app: tauri::AppHandle,
    plugin_id: String,
    method: String,
    payload: Option<Json>,
) -> Result<Json, String> {
    plugins::invoke(&app, &plugin_id, &method, payload)
}

#[tauri::command]
fn open_external(url: String) -> bool {
    // 只放行 http/https，避免把 shell 交给任意协议
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return false;
    }
    tauri_plugin_opener::open_url(url, None::<&str>).is_ok()
}

#[tauri::command]
fn copy_text(app: tauri::AppHandle, text: String) -> bool {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text).is_ok()
}


/* -------------------------------------------------------------------- 探针 */

/// 无界面探针：抓一页列表页并把解析结果打到 stdout。
/// 用法：gugu-gallery.exe probe [页码]
/// 爬虫改动后不用起界面就能快速验证（也是将来 CLI 模式的种子）。
fn run_probe() {
    use crawler::http::{HttpClient, HttpOptions};
    let page: i64 = std::env::args().nth(2).and_then(|v| v.parse().ok()).unwrap_or(1);
    let target = crawler::site::SiteTarget {
        kind: "category".into(),
        plate: Some("ACG图片".into()),
        word: Some("Pixiv萌图".into()),
        url: None,
    };
    let url = crawler::site::list_url(&target, page).expect("构造 URL 失败");
    println!("[probe] GET {url}");
    let started = std::time::Instant::now();
    let client = HttpClient::new(HttpOptions {
        delay_ms: 0,
        retries: 1,
        timeout_ms: 20_000,
        concurrency: 1,
        cookie: None,
        proxy: None,
    });
    match tauri::async_runtime::block_on(client.get_html(&url)) {
        Ok(html) => {
            println!("[probe] HTTP 成功，用时 {:?}，长度 {}", started.elapsed(), html.len());
            let (pages, items) = crawler::parser::parse_pagination(&html);
            println!("[probe] 分页: pages={:?} items={:?}", pages, items);
            let list = crawler::parser::parse_list_items(&html);
            println!("[probe] 解析出条目 {} 条", list.len());
            for it in list.iter().take(3) {
                println!(
                    "[probe]   #{} {} {}x{} {} bytes tags={:?} remote={:?}",
                    it.id, it.title, it.width.unwrap_or(0), it.height.unwrap_or(0),
                    it.bytes.unwrap_or(0), it.tags, it.remote_path
                );
            }
        }
        Err(err) => println!("[probe] 抓取失败（用时 {:?}）：{}", started.elapsed(), err),
    }
}

fn main() {
    let argv: Vec<String> = std::env::args().collect();
    if argv.iter().any(|a| a == "probe") {
        run_probe();
        return;
    }
    if argv.iter().any(|a| a == "imgdiff") {
        std::process::exit(cli::run_imgdiff(&argv));
    }
    // --library 要在打开图库之前生效
    if cli::is_cli_mode(&argv) {
        cli::apply_library_arg(&argv);
    }

    let state = match open_state() {
        Ok(v) => v,
        Err(err) => {
            eprintln!("[gugu] 初始化失败: {err}");
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(state)
        .register_asynchronous_uri_scheme_protocol("gugu", |ctx, request, responder| {
            responder.respond(media::handle(ctx, request));
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
            debug_report,
            debug_diag,
            shot_after_eval
        ])
        .setup(|app| {
            let _ = app.get_webview_window("main");
            let handle = app.handle().clone();
            let state = app.state::<AppState>();
            let lib = state.lib.lock().unwrap().clone();
            let db = state.db.clone();
            let settings = state.settings.lock().unwrap().get();
            let proxy = settings.get("proxy").and_then(|v| v.as_str()).map(|s| s.to_string());
            let cookie = state.session.lock().unwrap().cookie_header();
            let engine = Engine::new(db, lib, handle, cookie, proxy);
            *state.engine.lock().unwrap() = Some(Arc::new(engine));

            // 命令行模式：藏起窗口，跑完抓取直接退出
            if cli::is_cli_mode(&std::env::args().collect::<Vec<_>>()) {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
                cli::start(app.handle().clone());
                return Ok(());
            }

            // 截图模式自己管启动流程（截图 → 体检 → eval → 补拍 → 退出）
            if !shot::maybe_start(app.handle()) {
                run_eval_hook(app.handle());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

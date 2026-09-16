/**
 * 抓取引擎（Rust 版）：两阶段流水线 —— 先建索引，再按条件下载原图。
 * 与 Electron 版的 src/main/crawler/engine.ts 保持同样的行为：
 * 页码范围同时作用于索引与下载、进度事件、可暂停/取消、失败不中断整批。
 */
use super::http::{sniff_format, HttpClient, HttpOptions};
use super::parser::{parse_list_items, parse_pagination};
use super::site::{self, SiteTarget};
use crate::library::{build_slug, Library};
use crate::store::{self, GalleryQuery, ItemUpsert};
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::{json, Value as Json};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CrawlRequest {
    pub targets: Vec<SiteTarget>,
    pub page_from: i64,
    pub page_to: Option<i64>,
    pub max_items: Option<i64>,
    pub index_only: bool,
    pub download: bool,
    pub enrich: bool,
    pub skip_existing: bool,
    pub list_concurrency: usize,
    pub download_concurrency: usize,
    pub delay_ms: u64,
    pub retries: u32,
    pub include_tags: Vec<String>,
    pub exclude_tags: Vec<String>,
    pub resume_from_marks: bool,
    pub min_width: i64,
    pub min_bytes: i64,
    /// 文件命名规则（来自设置：id-slug / id / pixiv / hash），由命令层注入
    #[serde(default)]
    pub naming: String,
}

#[derive(Debug, Clone, Default)]
struct LogLine {
    at: u64,
    level: String,
    message: String,
}

#[derive(Debug, Default)]
struct RunState {
    job_id: i64,
    phase: String,
    started_at: u64,
    pages_done: i64,
    pages_total: Option<i64>,
    items_found: i64,
    items_new: i64,
    items_matched: i64,
    download_total: Option<i64>,
    downloaded: i64,
    skipped: i64,
    failed: i64,
    bytes: u64,
    current_label: Option<String>,
    logs: Vec<LogLine>,
    /// 最近一次失败的原因（单张下载失败时界面要能说清楚）
    last_error: Option<String>,
}

pub struct Engine {
    db: Arc<Mutex<Connection>>,
    lib: Library,
    app: AppHandle,
    running: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    state: Arc<Mutex<RunState>>,
    cookie: Mutex<Option<String>>,
    proxy: Mutex<Option<String>>,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl Engine {
    pub fn new(db: Arc<Mutex<Connection>>, lib: Library, app: AppHandle, cookie: Option<String>, proxy: Option<String>) -> Self {
        Self {
            db,
            lib,
            app,
            running: Arc::new(AtomicBool::new(false)),
            cancelled: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            state: Arc::new(Mutex::new(RunState { phase: "queued".into(), ..Default::default() })),
            cookie: Mutex::new(cookie),
            proxy: Mutex::new(proxy),
        }
    }

    /// 会话变化时更新后续请求要带的 cookie
    pub fn set_cookie(&self, cookie: Option<String>) {
        *self.cookie.lock().unwrap() = cookie;
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn cancel(&self) -> bool {
        if !self.is_running() {
            return false;
        }
        self.cancelled.store(true, Ordering::SeqCst);
        true
    }

    pub fn pause(&self) -> bool {
        if !self.is_running() {
            return false;
        }
        self.paused.store(true, Ordering::SeqCst);
        self.log("info", "已暂停，当前批次完成后停止取新任务");
        true
    }

    pub fn resume(&self) -> bool {
        if !self.is_running() {
            return false;
        }
        self.paused.store(false, Ordering::SeqCst);
        self.log("info", "继续抓取");
        true
    }

    pub fn progress(&self) -> Json {
        let st = self.state.lock().unwrap();
        if st.job_id == 0 {
            return Json::Null;
        }
        progress_json(&st)
    }

    fn log(&self, level: &str, message: &str) {
        eprintln!("[gugu] {level}: {message}");
        {
            let mut st = self.state.lock().unwrap();
            st.logs.push(LogLine {
                at: now_ms(),
                level: level.to_string(),
                message: message.to_string(),
            });
            if st.logs.len() > 400 {
                let drop = st.logs.len() - 400;
                st.logs.drain(0..drop);
            }
        }
        self.emit(true);
    }

    fn emit(&self, with_logs: bool) {
        let payload = {
            let st = self.state.lock().unwrap();
            let progress = progress_json(&st);
            let logs: Vec<Json> = if with_logs {
                st.logs.iter().map(log_json).collect()
            } else {
                Vec::new()
            };
            json!({ "progress": progress, "logs": logs })
        };
        let _ = self.app.emit("crawl://progress", payload);
    }

    /// 只下载指定条目（详情页「下载此图」/ 批量下载）
    pub fn start_ids(&self, ids: Vec<i64>, request: CrawlRequest) -> Result<i64, String> {
        if self.is_running() {
            return Err("已有抓取任务在运行，请先停止".into());
        }
        if ids.is_empty() {
            return Ok(0);
        }
        let job_id = {
            let db = self.db.lock().unwrap();
            store::create_job(&db, "queued", &format!("下载 {} 张", ids.len()), "{}").map_err(|e| e.to_string())?
        };
        {
            let mut st = self.state.lock().unwrap();
            *st = RunState { job_id, phase: "queued".into(), started_at: now_ms(), ..Default::default() };
        }
        self.cancelled.store(false, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
        self.running.store(true, Ordering::SeqCst);
        self.log("info", &format!("任务 #{job_id} 启动：下载 {} 张指定图片", ids.len()));

        let db = self.db.clone();
        let lib = self.lib.clone();
        let app = self.app.clone();
        let running = self.running.clone();
        let cancelled = self.cancelled.clone();
        let paused = self.paused.clone();
        let state = self.state.clone();
        let client = Arc::new(HttpClient::new(HttpOptions {
            delay_ms: request.delay_ms,
            retries: request.retries,
            timeout_ms: 25_000,
            concurrency: request.download_concurrency.max(1),
            cookie: self.cookie.lock().unwrap().clone(),
            proxy: self.proxy.lock().unwrap().clone(),
        }));

        tauri::async_runtime::spawn(async move {
            let engine = EngineHandle { db, lib, app, running, cancelled, paused, state, client };
            let outcome = engine.run_ids(&ids, &request).await;
            if let Err(msg) = outcome {
                engine.log("error", &format!("任务异常终止：{msg}"));
            }
            let phase = if engine.cancelled.load(Ordering::SeqCst) { "cancelled" } else { "done" };
            engine.finish(phase);
        });
        Ok(job_id)
    }

    /// 启动一次抓取（后台跑），返回 jobId
    pub fn start(&self, request: CrawlRequest) -> Result<i64, String> {
        if self.is_running() {
            return Err("已有抓取任务在运行，请先停止".into());
        }
        if request.targets.is_empty() {
            return Err("至少要选择一个抓取目标".into());
        }
        let summary = request
            .targets
            .iter()
            .map(|t| t.title())
            .collect::<Vec<_>>()
            .join("、");

        let job_id = {
            let db = self.db.lock().unwrap();
            store::create_job(&db, "queued", &summary, &serde_json::to_string(&request).unwrap_or_default())
                .map_err(|e| e.to_string())?
        };

        let client = Arc::new(HttpClient::new(HttpOptions {
            delay_ms: request.delay_ms,
            retries: request.retries,
            timeout_ms: 25_000,
            concurrency: request.list_concurrency.max(request.download_concurrency).max(1),
            cookie: self.cookie.lock().unwrap().clone(),
            proxy: self.proxy.lock().unwrap().clone(),
        }));

        {
            let mut st = self.state.lock().unwrap();
            *st = RunState {
                job_id,
                phase: "queued".into(),
                started_at: now_ms(),
                ..Default::default()
            };
        }
        self.cancelled.store(false, Ordering::SeqCst);
        self.paused.store(false, Ordering::SeqCst);
        self.running.store(true, Ordering::SeqCst);
        self.log("info", &format!("任务 #{job_id} 启动：{summary}"));

        let db = self.db.clone();
        let lib = self.lib.clone();
        let app = self.app.clone();
        let running = self.running.clone();
        let cancelled = self.cancelled.clone();
        let paused = self.paused.clone();
        let state = self.state.clone();


        tauri::async_runtime::spawn(async move {
            let engine = EngineHandle { db, lib, app, running, cancelled, paused, state, client };
            let outcome = engine.run(&request).await;
            let phase = match outcome {
                Ok(()) => "done",
                Err(msg) => {
                    engine.log("error", &format!("任务异常终止：{msg}"));
                    "failed"
                }
            };
            if engine.cancelled.load(Ordering::SeqCst) {
                engine.finish("cancelled");
            } else {
                engine.finish(phase);
            }
        });

        Ok(job_id)
    }
}

/// 任务实际执行者的内部句柄（与 Engine 共享同一批 Arc）
struct EngineHandle {
    db: Arc<Mutex<Connection>>,
    lib: Library,
    app: AppHandle,
    running: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    state: Arc<Mutex<RunState>>,
    client: Arc<HttpClient>,
}

impl EngineHandle {
    fn log(&self, level: &str, message: &str) {
        eprintln!("[gugu] {level}: {message}");
        {
            let mut st = self.state.lock().unwrap();
            st.logs.push(LogLine { at: now_ms(), level: level.into(), message: message.into() });
            if st.logs.len() > 400 {
                let drop = st.logs.len() - 400;
                st.logs.drain(0..drop);
            }
        }
        self.emit(true);
    }
    fn emit(&self, with_logs: bool) {
        let payload = {
            let st = self.state.lock().unwrap();
            let logs: Vec<Json> = if with_logs { st.logs.iter().map(log_json).collect() } else { Vec::new() };
            json!({ "progress": progress_json(&st), "logs": logs })
        };
        let _ = self.app.emit("crawl://progress", payload);
    }
    fn finish(&self, phase: &str) {
        let (job_id, stats) = {
            let mut st = self.state.lock().unwrap();
            st.phase = phase.to_string();
            (
                st.job_id,
                json!({
                    "pages": st.pages_done, "found": st.items_found, "new": st.items_new,
                    "downloaded": st.downloaded, "skipped": st.skipped, "failed": st.failed, "bytes": st.bytes
                }),
            )
        };
        {
            let db = self.db.lock().unwrap();
            let _ = store::finish_job(&db, job_id, phase, &stats.to_string());
        }
        self.running.store(false, Ordering::SeqCst);
        let label = match phase {
            "done" => "任务完成",
            "cancelled" => "任务已取消",
            _ => "任务失败",
        };
        self.log("info", label);
        self.emit(false);
    }

    async fn run(&self, request: &CrawlRequest) -> Result<(), String> {
        self.lib.ensure().map_err(|e| e.to_string())?;
        self.lib.cleanup_tmp();
        self.phase("indexing");
        self.emit(true);

        for target in &request.targets {
            if self.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            self.index_target(target, request).await?;
        }

        if self.cancelled.load(Ordering::SeqCst) {
            return Ok(());
        }

        if request.download && !request.index_only {
            self.phase("downloading");
            self.emit(true);
            self.download_phase(request).await?;
        }
        Ok(())
    }

    fn phase(&self, name: &str) {
        let mut st = self.state.lock().unwrap();
        st.phase = name.to_string();
    }

    async fn run_ids(&self, ids: &[i64], request: &CrawlRequest) -> Result<(), String> {
        self.lib.ensure().map_err(|e| e.to_string())?;
        self.lib.cleanup_tmp();
        self.phase("downloading");
        self.emit(true);
        let queue = {
            let db = self.db.lock().unwrap();
            store::list_queue_by_ids(&db, ids).map_err(|e| e.to_string())?
        };
        {
            let mut st = self.state.lock().unwrap();
            st.download_total = Some(queue.len() as i64);
        }
        for item in queue {
            if self.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            if let Err(err) = self.download_one(&item, request).await {
                let mut st = self.state.lock().unwrap();
                st.failed += 1;
                st.last_error = Some(format!("#{} {err}", item.id));
                drop(st);
                self.log("warn", &format!("#{} 下载失败：{err}", item.id));
            }
            self.emit(false);
        }
        Ok(())
    }

    async fn index_target(&self, target: &SiteTarget, request: &CrawlRequest) -> Result<(), String> {
        let title = target.title();
        self.log("info", &format!("开始索引：{title}"));
        let source_url = site::list_url(target, 1)?;
        {
            let db = self.db.lock().unwrap();
            let _ = store::upsert_source(&db, &target.kind, target.plate.as_deref(), target.word.as_deref(), &source_url, &title);
        }
        self.set_label(&format!("索引 {title}"));

        let mut page = request.page_from.max(1);
        loop {
            if self.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            while self.paused.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(300)).await;
                if self.cancelled.load(Ordering::SeqCst) {
                    return Ok(());
                }
            }
            if let Some(to) = request.page_to {
                if page > to {
                    break;
                }
            }
            if request.resume_from_marks {
                let already = {
                    let db = self.db.lock().unwrap();
                    store::has_page_mark(&db, &source_url, page).unwrap_or(false)
                };
                if already {
                    page += 1;
                    continue;
                }
            }

            let url = site::list_url(target, page)?;
            let html = match self.client.get_html(&url).await {
                Ok(html) => html,
                Err(err) => {
                    self.log("warn", &format!("列表页 {page} 抓取失败：{err}"));
                    if err.0.contains("404") {
                        break;
                    }
                    page += 1;
                    if page > request.page_from + 2000 {
                        break;
                    }
                    continue;
                }
            };

            if page == request.page_from {
                let (pages, items) = parse_pagination(&html);
                let total = match request.page_to {
                    Some(to) => (to - request.page_from + 1).max(1),
                    None => pages.unwrap_or(0),
                };
                {
                    let mut st = self.state.lock().unwrap();
                    st.pages_total = if total > 0 { Some(total) } else { None };
                }
                let db = self.db.lock().unwrap();
                let _ = store::update_source_stats(&db, &source_url, pages, items);
            }

            let raw = parse_list_items(&html);
            if raw.is_empty() {
                self.log("info", &format!("第 {page} 页没有内容，该分类索引结束（共 {} 页）", self.pages_done()));
                break;
            }

            let upserts: Vec<ItemUpsert> = raw
                .iter()
                .map(|r| {
                    let mut tags = r.tags.clone();
                    if target.kind == "search" {
                        if let Some(word) = target.word.as_deref() {
                            let app_tag = store::category_tag_for(word);
                            if !tags.contains(&app_tag) {
                                tags.push(app_tag);
                            }
                        }
                    }
                    ItemUpsert {
                        id: r.id,
                        detail_url: r.detail_url.clone(),
                        source_url: Some(source_url.clone()),
                        plate: r.plate.clone().or_else(|| target.plate.clone()),
                        word: r.word.clone().or_else(|| target.word.clone()),
                        title: r.title.clone(),
                        width: r.width,
                        height: r.height,
                        bytes: r.bytes,
                        uploader: r.uploader.clone(),
                        views: r.views,
                        published_at: r.published_at.clone(),
                        remote_path: r.remote_path.clone(),
                        remote_ext: r.remote_path.as_deref().map(site::path_ext),
                        preview_url: r.remote_path.as_deref().map(site::preview_url),
                        download_url: r.remote_path.as_deref().map(site::original_url),
                        page: Some(page),
                        target_word: if target.kind == "search" { target.word.clone() } else { None },
                        tags,
                    }
                })
                .collect();

            let (inserted, _) = {
                let db = self.db.lock().unwrap();
                store::upsert_items(&db, &upserts).map_err(|e| e.to_string())?
            };
            {
                let db = self.db.lock().unwrap();
                let _ = store::mark_page(&db, &source_url, page, raw.len() as i64);
            }
            {
                let mut st = self.state.lock().unwrap();
                st.pages_done += 1;
                st.items_found += raw.len() as i64;
                st.items_new += inserted;
            }
            self.set_label(&format!("{title} 第 {page} 页"));
            self.emit(false);
            page += 1;
        }
        Ok(())
    }

    fn pages_done(&self) -> i64 {
        self.state.lock().unwrap().pages_done
    }

    fn set_label(&self, label: &str) {
        let mut st = self.state.lock().unwrap();
        st.current_label = Some(label.to_string());
    }

    async fn download_phase(&self, request: &CrawlRequest) -> Result<(), String> {
        let query = GalleryQuery {
            page_from: Some(request.page_from.max(1)),
            page_to: request.page_to,
            ..Default::default()
        };
        let mut queue = {
            let db = self.db.lock().unwrap();
            store::list_download_queue(&db, &query, 100_000, true).map_err(|e| e.to_string())?
        };

        if !request.include_tags.is_empty() {
            let db = self.db.lock().unwrap();
            queue = queue
                .into_iter()
                .filter(|q| {
                    let tags: Vec<String> = store::item_tags(&db, q.id).unwrap_or_default();
                    request.include_tags.iter().any(|t| tags.contains(t))
                })
                .collect();
        }
        if !request.exclude_tags.is_empty() {
            let db = self.db.lock().unwrap();
            queue = queue
                .into_iter()
                .filter(|q| {
                    let tags: Vec<String> = store::item_tags(&db, q.id).unwrap_or_default();
                    !request.exclude_tags.iter().any(|t| tags.contains(t))
                })
                .collect();
        }
        if let Some(max) = request.max_items {
            queue.truncate(max.max(0) as usize);
        }

        {
            let mut st = self.state.lock().unwrap();
            st.download_total = Some(queue.len() as i64);
            st.items_matched = queue.len() as i64;
        }
        self.log(
            "info",
            &format!("待下载 {} 张（并发 {}，间隔 {}ms）", queue.len(), request.download_concurrency, request.delay_ms),
        );
        self.emit(false);

        for item in queue {
            if self.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            while self.paused.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(300)).await;
                if self.cancelled.load(Ordering::SeqCst) {
                    return Ok(());
                }
            }
            if let Err(err) = self.download_one(&item, request).await {
                let mut st = self.state.lock().unwrap();
                st.failed += 1;
                st.last_error = Some(format!("#{} {err}", item.id));
                drop(st);
                self.log("warn", &format!("#{} 下载失败：{err}", item.id));
            }
            self.emit(false);
        }
        Ok(())
    }

    async fn download_one(&self, item: &store::QueueItem, request: &CrawlRequest) -> Result<(), String> {
        let remote_path = item
            .remote_path
            .clone()
            .ok_or_else(|| "缺少原图路径".to_string())?;
        let (plate, word, title, pixiv_id) = {
            let db = self.db.lock().unwrap();
            store::item_meta(&db, item.id)
                .map_err(|e| e.to_string())?
                .unwrap_or((None, None, String::new(), None))
        };
        let naming = if request.naming.trim().is_empty() {
            "id-slug".to_string()
        } else {
            request.naming.clone()
        };
        let _ = &title;
        let tags = {
            let db = self.db.lock().unwrap();
            store::item_tags(&db, item.id).unwrap_or_default()
        };
        let pid_part = pixiv_id.as_deref().map(|p| format!("pid{p}"));
        let slug = build_slug(&[
            tags.first().map(|s| s.as_str()),
            tags.get(1).map(|s| s.as_str()),
            pid_part.as_deref(),
        ]);
        let hinted_ext = site::path_ext(&remote_path);
        let rel = self.lib.original_rel_path(
            item.id,
            plate.as_deref(),
            word.as_deref(),
            &slug,
            &hinted_ext,
            &naming,
            pixiv_id.as_deref(),
            None,
        );
        let dest = self
            .lib
            .resolve_inside(&rel)
            .ok_or_else(|| "路径越界".to_string())?;

        let url = site::original_url(&remote_path);
        let result = self.client.download(&url, &dest).await.map_err(|e| e.0)?;
        let (ext, mime) = sniff_format(&result.head).unwrap_or((hinted_ext.as_str(), "image/jpeg"));
        // 扩展名与实际格式不一致时改名（站点大量存在 .png 实际是 JPEG）
        let final_rel = if ext != hinted_ext {
            let renamed = self.lib.original_rel_path(
                item.id,
                plate.as_deref(),
                word.as_deref(),
                &slug,
                ext,
                &naming,
                pixiv_id.as_deref(),
                None,
            );
            if let Some(target) = self.lib.resolve_inside(&renamed) {
                if std::fs::rename(&dest, &target).is_ok() {
                    renamed
                } else {
                    rel.clone()
                }
            } else {
                rel.clone()
            }
        } else {
            rel.clone()
        };
        let final_abs = self.lib.resolve_inside(&final_rel).ok_or_else(|| "路径越界".to_string())?;

        // 缩略图：用真实解码结果覆盖站点标注的尺寸
        let thumb_rel = self.lib.thumb_rel_path(item.id);
        let (width, height) = match make_thumbnail(&final_abs, &self.lib, &thumb_rel, request) {
            Ok(size) => size,
            Err(err) => {
                self.log("warn", &format!("#{} 缩略图生成失败：{err}", item.id));
                (None, None)
            }
        };

        {
            let db = self.db.lock().unwrap();
            let _ = store::upsert_file(
                &db,
                item.id,
                &final_rel,
                Some(&thumb_rel),
                ext,
                mime,
                width,
                height,
                result.bytes as i64,
                &result.sha256,
            );
            let _ = store::apply_file_metrics(&db, item.id, width, height, result.bytes as i64, ext);
        }
        {
            let mut st = self.state.lock().unwrap();
            st.downloaded += 1;
            st.bytes += result.bytes;
        }
        self.log(
            "success",
            &format!("#{} 已保存 {}（{}）", item.id, final_rel, human_size(result.bytes)),
        );
        Ok(())
    }
}

fn make_thumbnail(
    src: &Path,
    lib: &Library,
    thumb_rel: &str,
    request: &CrawlRequest,
) -> Result<(Option<i64>, Option<i64>), String> {
    let img = image::open(src).map_err(|e| e.to_string())?;
    let (w, h) = (img.width(), img.height());
    let max = 512u32;
    let thumb = if w.max(h) > max {
        img.resize(max, max, image::imageops::FilterType::Triangle)
    } else {
        img.clone()
    };
    let dest = lib.resolve_inside(thumb_rel).ok_or("路径越界")?;
    if let Some(parent) = dest.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    thumb.to_rgb8().save_with_format(&dest, image::ImageFormat::Jpeg).map_err(|e| e.to_string())?;
    let _ = request.min_width; // 过滤在队列阶段处理
    Ok((Some(w as i64), Some(h as i64)))
}

fn human_size(bytes: u64) -> String {
    let b = bytes as f64;
    if b < 1024.0 {
        format!("{bytes} B")
    } else if b < 1024.0 * 1024.0 {
        format!("{:.1} KB", b / 1024.0)
    } else {
        format!("{:.2} MB", b / 1024.0 / 1024.0)
    }
}

fn log_json(line: &LogLine) -> Json {
    json!({ "at": line.at, "level": line.level, "message": line.message })
}

fn progress_json(st: &RunState) -> Json {
    let elapsed = now_ms().saturating_sub(st.started_at);
    let speed = if elapsed > 0 { (st.bytes as f64) / (elapsed as f64 / 1000.0) } else { 0.0 };
    json!({
        "jobId": st.job_id,
        "phase": st.phase,
        "startedAt": st.started_at,
        "elapsedMs": elapsed,
        "pagesDone": st.pages_done,
        "pagesTotal": st.pages_total,
        "itemsFound": st.items_found,
        "itemsNew": st.items_new,
        "itemsMatched": st.items_matched,
        "downloadTotal": st.download_total,
        "downloaded": st.downloaded,
        "skipped": st.skipped,
        "failed": st.failed,
        "bytesDownloaded": st.bytes,
        "speedBps": speed.round(),
        "etaSeconds": Json::Null,
        "currentLabel": st.current_label,
        "lastError": st.last_error,
        "logs": []
    })
}

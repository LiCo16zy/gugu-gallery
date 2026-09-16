/**
 * 面向爬虫的 HTTP 客户端（Rust 版）。
 *
 * 站点实测的坑（2026-09）：
 *  1. 必须带 Referer=https://www.guguxz.com/ ，否则 imageBed 直接 403；
 *  2. 服务端不太稳定：约 1/4 的请求会在 1KB 左右断开或挂住 —— 重试 + 完整性校验是核心。
 */
use crate::crawler::site::{BROWSER_UA, SITE_REFERER};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, CACHE_CONTROL, COOKIE, REFERER, USER_AGENT};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

#[derive(Clone, Default)]
pub struct HttpOptions {
    pub delay_ms: u64,
    pub retries: u32,
    pub timeout_ms: u64,
    pub concurrency: usize,
    pub cookie: Option<String>,
    pub proxy: Option<String>,
}

pub struct HttpError(pub String);

impl std::fmt::Debug for HttpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl std::fmt::Display for HttpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl std::error::Error for HttpError {}

pub struct DownloadResult {
    pub bytes: u64,
    pub sha256: String,
    pub head: Vec<u8>,
}

#[derive(Clone)]
pub struct HttpClient {
    client: reqwest::Client,
    opts: HttpOptions,
    gate: Arc<Semaphore>,
    next_at: Arc<AtomicU64>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

impl HttpClient {
    pub fn new(opts: HttpOptions) -> Self {
        let concurrency = opts.concurrency.max(1);
        let mut builder = reqwest::Client::builder()
            .timeout(Duration::from_millis(opts.timeout_ms.max(1000)))
            .redirect(reqwest::redirect::Policy::limited(10))
            .user_agent(BROWSER_UA)
            .gzip(true)
            .brotli(true)
            ;
        if let Some(proxy) = opts.proxy.as_deref().filter(|p| !p.is_empty()) {
            if let Ok(p) = reqwest::Proxy::all(proxy) {
                builder = builder.proxy(p);
            }
        }
        let client = builder.build().unwrap_or_else(|_| reqwest::Client::new());
        Self {
            client,
            opts,
            gate: Arc::new(Semaphore::new(concurrency)),
            next_at: Arc::new(AtomicU64::new(0)),
        }
    }

    fn headers(&self, accept: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(USER_AGENT, HeaderValue::from_static(BROWSER_UA));
        h.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"));
        h.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
        h.insert(REFERER, HeaderValue::from_static(SITE_REFERER));
        if let Ok(v) = HeaderValue::from_str(accept) {
            h.insert(ACCEPT, v);
        }
        if let Some(cookie) = self.opts.cookie.as_deref().filter(|c| !c.is_empty()) {
            if let Ok(v) = HeaderValue::from_str(cookie) {
                h.insert(COOKIE, v);
            }
        }
        h
    }

    /// 请求间隔 + 并发闸门（与旧版 Limiter 等价）
    async fn throttle(&self) {
        let delay = self.opts.delay_ms;
        if delay == 0 {
            return;
        }
        loop {
            let now = now_ms();
            let next = self.next_at.load(Ordering::SeqCst);
            if now >= next {
                if self
                    .next_at
                    .compare_exchange(next, now + delay, Ordering::SeqCst, Ordering::SeqCst)
                    .is_ok()
                {
                    return;
                }
            } else {
                tokio::time::sleep(Duration::from_millis(next - now)).await;
            }
        }
    }

    fn backoff(&self, attempt: u32) -> u64 {
        let base = 700u64.saturating_mul(1 << attempt.min(4));
        base.min(15_000) + (now_ms() % 400)
    }

    /// 抓 HTML：重试 + 截断校验
    pub async fn get_html(&self, url: &str) -> Result<String, HttpError> {
        let _permit = self.gate.clone().acquire_owned().await.map_err(|e| HttpError(e.to_string()))?;
        let mut last_err = String::new();
        for attempt in 0..=self.opts.retries {
            if attempt > 0 {
                tokio::time::sleep(Duration::from_millis(self.backoff(attempt))).await;
            }
            self.throttle().await;
            match self
                .client
                .get(url)
                .headers(self.headers("text/html,application/xhtml+xml,*/*;q=0.8"))
                .send()
                .await
            {
                Ok(res) => {
                    let status = res.status();
                    if !status.is_success() {
                        last_err = format!("HTTP {}", status.as_u16());
                        if status.as_u16() == 404 {
                            return Err(HttpError(last_err));
                        }
                        continue;
                    }
                    match res.text().await {
                        Ok(text) => {
                            if !is_complete_html(&text) {
                                last_err = format!("响应被截断（{} 字符）", text.chars().count());
                                continue;
                            }
                            return Ok(text);
                        }
                        Err(err) => last_err = err.to_string(),
                    }
                }
                Err(err) => last_err = err.to_string(),
            }
        }
        Err(HttpError(last_err))
    }

    /// 只要 HTTP 状态，不要正文（判断页码是否越界）
    pub async fn head_status(&self, url: &str) -> Result<u16, HttpError> {
        self.throttle().await;
        let res = self
            .client
            .get(url)
            .headers(self.headers("text/html,*/*;q=0.8"))
            .send()
            .await
            .map_err(|e| HttpError(e.to_string()))?;
        Ok(res.status().as_u16())
    }

    /// 下载到文件：先写 .part 再原子改名，并做长度校验
    pub async fn download(&self, url: &str, dest: &Path) -> Result<DownloadResult, HttpError> {
        let _permit = self.gate.clone().acquire_owned().await.map_err(|e| HttpError(e.to_string()))?;
        if let Some(parent) = dest.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        let part = dest.with_extension("part");
        let mut last_err = String::new();
        for attempt in 0..=self.opts.retries {
            if attempt > 0 {
                tokio::time::sleep(Duration::from_millis(self.backoff(attempt))).await;
            }
            self.throttle().await;
            match self.client.get(url).headers(self.headers("image/avif,image/webp,image/*,*/*;q=0.8")).send().await {
                Ok(res) => {
                    if !res.status().is_success() {
                        last_err = format!("下载失败 HTTP {}", res.status().as_u16());
                        if res.status().as_u16() == 404 {
                            return Err(HttpError(last_err));
                        }
                        continue;
                    }
                    let expected = res.content_length();
                    let mut file = match tokio::fs::File::create(&part).await {
                        Ok(f) => f,
                        Err(err) => {
                            last_err = err.to_string();
                            continue;
                        }
                    };
                    let mut hasher = Sha256::new();
                    let mut head: Vec<u8> = Vec::with_capacity(512);
                    let mut total: u64 = 0;
                    let mut stream = res;
                    let mut failed = false;
                    loop {
                        match stream.chunk().await {
                            Ok(Some(chunk)) => {
                                if head.len() < 512 {
                                    let take = (512 - head.len()).min(chunk.len());
                                    head.extend_from_slice(&chunk[..take]);
                                }
                                hasher.update(&chunk);
                                total += chunk.len() as u64;
                                if let Err(err) = file.write_all(&chunk).await {
                                    last_err = err.to_string();
                                    failed = true;
                                    break;
                                }
                            }
                            Ok(None) => break,
                            Err(err) => {
                                last_err = err.to_string();
                                failed = true;
                                break;
                            }
                        }
                    }
                    let _ = file.flush().await;
                    drop(file);
                    if failed {
                        let _ = tokio::fs::remove_file(&part).await;
                        continue;
                    }
                    if let Some(expected) = expected {
                        if expected > 0 && total != expected {
                            last_err = format!("下载不完整（{total}/{expected} 字节）");
                            let _ = tokio::fs::remove_file(&part).await;
                            continue;
                        }
                    }
                    if total < 512 {
                        last_err = format!("内容过短（{total} 字节）");
                        let _ = tokio::fs::remove_file(&part).await;
                        continue;
                    }
                    if let Err(err) = tokio::fs::rename(&part, dest).await {
                        last_err = err.to_string();
                        continue;
                    }
                    return Ok(DownloadResult {
                        bytes: total,
                        sha256: format!("{:x}", hasher.finalize()),
                        head,
                    });
                }
                Err(err) => last_err = err.to_string(),
            }
        }
        Err(HttpError(last_err))
    }
}

/// 站点被截断的响应经常仍返回 200，只能靠内容判断
fn is_complete_html(text: &str) -> bool {
    let trimmed = text.trim_end();
    trimmed.ends_with("</html>") || trimmed.ends_with("</HTML>") || trimmed.len() > 4000
}

/// 用魔数判断真实图片格式
pub fn sniff_format(head: &[u8]) -> Option<(&'static str, &'static str)> {
    if head.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(("jpg", "image/jpeg"));
    }
    if head.starts_with(&[0x89, b'P', b'N', b'G']) {
        return Some(("png", "image/png"));
    }
    if head.len() > 12 && &head[0..4] == b"RIFF" && &head[8..12] == b"WEBP" {
        return Some(("webp", "image/webp"));
    }
    if head.starts_with(b"GIF8") {
        return Some(("gif", "image/gif"));
    }
    if head.len() > 12 && &head[4..12] == b"ftypavif" {
        return Some(("avif", "image/avif"));
    }
    if head.starts_with(b"BM") {
        return Some(("bmp", "image/bmp"));
    }
    None
}

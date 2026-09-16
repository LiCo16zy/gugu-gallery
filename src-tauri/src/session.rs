/**
 * 登录态：只保存站点会话 cookie，**不保存账号密码**。
 *
 * 与 Electron 版的 src/main/session.ts 语义一致，差别是落盘方式：
 * 旧版写 userData/session.bin（DPAPI 密文）；新版交给系统凭据库
 * （Windows 凭据管理器，同样是 DPAPI 保护、绑定当前用户账户）。
 */
use crate::crawler::http::{HttpClient, HttpOptions};
use crate::crawler::site::SITE_ORIGIN;
use serde_json::{json, Value as Json};

const SERVICE: &str = "gugu-gallery";
const ACCOUNT: &str = "session-cookie";

/// 自检用：环境变量 GUGU_SESSION_EPHEMERAL=1 时不读写系统凭据库，
/// 保证断言与用户本机的登录状态无关。
fn ephemeral() -> bool {
    std::env::var("GUGU_SESSION_EPHEMERAL").map(|v| v == "1").unwrap_or(false)
}

pub struct SessionStore {
    cookie: Option<String>,
    saved_at: Option<String>,
    verified: Option<bool>,
    verify_message: Option<String>,
    expiry_notified: bool,
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            cookie: None,
            saved_at: None,
            verified: None,
            verify_message: None,
            expiry_notified: false,
        }
    }

    fn entry() -> Option<keyring::Entry> {
        keyring::Entry::new(SERVICE, ACCOUNT).ok()
    }

    /// 启动时读回登录态
    pub fn load(&mut self) {
        if ephemeral() {
            return;
        }
        let Some(entry) = Self::entry() else { return };
        let Ok(raw) = entry.get_password() else { return };
        if let Ok(parsed) = serde_json::from_str::<Json>(&raw) {
            let cookie = parsed.get("cookie").and_then(|v| v.as_str()).map(|s| s.to_string());
            if let Some(cookie) = cookie.filter(|c| !c.is_empty()) {
                self.saved_at = parsed.get("savedAt").and_then(|v| v.as_str()).map(|s| s.to_string());
                self.cookie = Some(cookie);
            }
        }
    }

    pub fn is_logged_in(&self) -> bool {
        self.cookie_header().is_some()
    }

    pub fn cookie_header(&self) -> Option<String> {
        let cookie = self.cookie.as_deref()?;
        if cookie.is_empty() {
            return None;
        }
        if cookie.contains('=') {
            Some(cookie.to_string())
        } else {
            Some(format!("PHPSESSID={cookie}"))
        }
    }

    pub fn save(&mut self, input: &str) -> Result<(), String> {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return Err("cookie 不能为空".into());
        }
        self.cookie = Some(trimmed.to_string());
        self.saved_at = Some(chrono::Local::now().to_rfc3339());
        self.verified = None;
        self.verify_message = None;
        self.expiry_notified = false;
        if !ephemeral() {
          if let Some(entry) = Self::entry() {
            let payload = json!({ "cookie": trimmed, "savedAt": self.saved_at }).to_string();
            // 凭据库不可用时退化为「仅本次有效」，绝不落明文
            let _ = entry.set_password(&payload);
          }
        }
        Ok(())
    }

    pub fn clear(&mut self) {
        self.cookie = None;
        self.saved_at = None;
        self.verified = None;
        self.verify_message = None;
        self.expiry_notified = false;
        if !ephemeral() {
          if let Some(entry) = Self::entry() {
            let _ = entry.delete_credential();
          }
        }
    }

    pub fn status(&self) -> Json {
        json!({
            "loggedIn": self.is_logged_in(),
            "fingerprint": self.cookie.as_deref().map(fingerprint),
            "savedAt": self.saved_at,
            "encrypted": true,
            "verified": self.verified,
            "verifyMessage": self.verify_message
        })
    }

    pub fn mark_verified(&mut self) {
        self.verified = Some(true);
        self.verify_message = None;
        self.expiry_notified = false;
    }

    pub fn mark_expired(&mut self, message: &str) {
        self.verified = Some(false);
        self.verify_message = Some(message.to_string());
        self.expiry_notified = true;
    }

    pub fn should_notify_expiry(&self) -> bool {
        !self.expiry_notified
    }

    /// 把一次校验结果落到会话状态上（不碰 IO，可安全地在锁内调用）
    pub fn apply_verify(&mut self, state: &str, message: &str) {
        if state == "in" {
            self.mark_verified();
        } else if state == "out" {
            self.mark_expired(message);
        } else {
            self.verified = Some(false);
            self.verify_message = Some(message.to_string());
        }
    }

    /// 校验前先把要用的 cookie 取出来（避免把锁带进 async）
    pub fn cookie_for_verify(&self) -> Option<String> {
        self.cookie_header()
    }
}

/// 去站点核对一次：不持锁、不依赖 SessionStore，方便在 async 命令里调用
pub async fn verify_cookie(cookie: Option<String>, proxy: Option<String>) -> (Json, String, String) {
    let Some(cookie) = cookie else {
        return (
            json!({ "ok": false, "state": "none", "message": "还没有设置登录凭据" }),
            "none".into(),
            "还没有设置登录凭据".into(),
        );
    };
    let client = HttpClient::new(HttpOptions {
        delay_ms: 0,
        retries: 1,
        timeout_ms: 20_000,
        concurrency: 1,
        cookie: Some(cookie),
        proxy,
    });
    match client.get_html(&format!("{SITE_ORIGIN}/")).await {
        Ok(html) => match login_state(&html) {
            "in" => (json!({ "ok": true, "state": "in", "message": "登录态有效" }), "in".into(), "登录态有效".into()),
            "out" => {
                let message = "cookie 已过期，请重新登录";
                (json!({ "ok": false, "state": "out", "message": message }), "out".into(), message.into())
            }
            _ => {
                let message = "没法确认登录态：首页里既没有登录入口也没有退出入口";
                (json!({ "ok": false, "state": "unknown", "message": message }), "unknown".into(), message.into())
            }
        },
        Err(err) => {
            let message = format!("校验失败：{err}");
            (json!({ "ok": false, "state": "error", "message": message }), "error".into(), message)
        }
    }
}

/// 站点判定登录态：未登录时页头固定是「登录 / 注册」，登录后换成用户入口并多出「泳装类分享」
pub fn login_state(html: &str) -> &'static str {
    if html.contains("泳装类分享") {
        return "in";
    }
    if html.contains("退出") || html.contains("注销") {
        return "in";
    }
    if html.contains("登录 / 注册") || html.contains("/login.html") {
        return "out";
    }
    "unknown"
}

/// 只暴露头尾几位，够确认「换没换」但不足以还原凭证
fn fingerprint(cookie: &str) -> String {
    let value = if let Some(idx) = cookie.find('=') {
        &cookie[idx + 1..]
    } else {
        cookie
    };
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 8 {
        return value.to_string();
    }
    let head: String = chars.iter().take(4).collect();
    let tail: String = chars.iter().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    format!("{head}…{tail}")
}

/**
 * 咕咕小站站点适配层：常量、URL 规则、路径编解码。
 * 与 Electron 版的 src/main/crawler/site.ts 一一对应。
 */
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};

pub const SITE_ORIGIN: &str = "https://www.guguxz.com";
pub const SITE_REFERER: &str = "https://www.guguxz.com/";
pub const CDN_HOST: &str = "total.wdbed.vip";
pub const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SiteTarget {
    pub kind: String,
    pub plate: Option<String>,
    pub word: Option<String>,
    pub url: Option<String>,
}

impl SiteTarget {
    pub fn title(&self) -> String {
        let plate = self.plate.clone().unwrap_or_default();
        let word = self.word.clone().unwrap_or_default();
        match self.kind.as_str() {
            "home" => "首页最新".to_string(),
            "category" => format!("{plate} · {word}").trim().to_string(),
            "search" => format!("搜索 · {word}"),
            "ranking" => format!("{plate} · {} 月排行", if word.is_empty() { "排行".into() } else { word }),
            "custom" => self.url.clone().unwrap_or_else(|| "自定义地址".into()),
            _ => word,
        }
    }
}

fn enc(s: &str) -> String {
    urlencoding::encode(s).to_string()
}

pub fn list_url(target: &SiteTarget, page: i64) -> Result<String, String> {
    let q = if page > 1 { format!("?page={page}") } else { String::new() };
    match target.kind.as_str() {
        "home" => Ok(format!("{SITE_ORIGIN}/{q}")),
        "category" => {
            let plate = target.plate.clone().ok_or("category 目标需要 plate")?;
            let word = target.word.clone().ok_or("category 目标需要 word")?;
            Ok(format!(
                "{SITE_ORIGIN}/search/index/plate/{}/wd/{}.html{q}",
                enc(&plate),
                enc(&word)
            ))
        }
        "search" => {
            let word = target.word.clone().ok_or("search 目标需要 word")?;
            Ok(format!("{SITE_ORIGIN}/search/index/wd/{}.html{q}", enc(&word)))
        }
        "ranking" => {
            let plate = target.plate.clone().ok_or("ranking 目标需要 plate")?;
            let word = target.word.clone().unwrap_or_else(|| "排行".into());
            Ok(format!(
                "{SITE_ORIGIN}/ranking/image/plate/{}/wd/{}/nav/month.html{q}",
                enc(&plate),
                enc(&word)
            ))
        }
        "custom" => {
            let url = target.url.clone().ok_or("custom 目标需要 url")?;
            Ok(with_page(&url, page))
        }
        other => Err(format!("未知目标类型: {other}")),
    }
}

fn with_page(url: &str, page: i64) -> String {
    let full = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("{SITE_ORIGIN}{url}")
    };
    if page <= 1 {
        return full;
    }
    if full.contains('?') {
        format!("{full}&page={page}")
    } else {
        format!("{full}?page={page}")
    }
}

/// 由相对路径生成原图下载 URL（dw=true 通道）
pub fn original_url(remote_path: &str) -> String {
    format!("{SITE_ORIGIN}/index/imageBed?item={remote_path}&dw=true")
}

/// 预览（压缩）图 URL
pub fn preview_url(remote_path: &str) -> String {
    format!("{SITE_ORIGIN}/index/imageBed?item={}", encode_base64(remote_path))
}

pub fn encode_base64(text: &str) -> String {
    STANDARD.encode(text.as_bytes())
}

/// 解开 <img src="...imageBed?item=XXX"> 里的相对路径
pub fn decode_item_param(param: &str) -> Option<String> {
    let s = param.trim();
    if s.is_empty() {
        return None;
    }
    let plain_ok = s.contains('/')
        && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'));
    if plain_ok {
        return Some(s.to_string());
    }
    let mut normalized: String = s
        .chars()
        .map(|c| match c {
            '-' => '+',
            '_' => '/',
            other => other,
        })
        .collect();
    let pad = normalized.len() % 4;
    if pad == 1 {
        return None;
    }
    if pad > 0 {
        normalized.push_str(&"=".repeat(4 - pad));
    }
    let bytes = STANDARD.decode(normalized.as_bytes()).ok()?;
    let decoded = String::from_utf8(bytes).ok()?;
    let looks_like_path = decoded.contains('/')
        && decoded
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'));
    if looks_like_path {
        Some(decoded)
    } else {
        None
    }
}

pub fn path_ext(remote_path: &str) -> String {
    let tail = remote_path.rsplit_once('.').map(|(_, e)| e).unwrap_or("");
    if tail.len() >= 2 && tail.len() <= 5 && tail.chars().all(|c| c.is_ascii_alphanumeric()) {
        tail.to_lowercase()
    } else {
        "jpg".to_string()
    }
}

/// 「1.69M」「222.38K」这类站点标注 -> 字节
pub fn parse_human_size(text: &str) -> Option<i64> {
    let re = regex::Regex::new(r"(?i)^\s*([\d.]+)\s*([kmg]?)\s*b?\s*$").ok()?;
    let caps = re.captures(text)?;
    let value: f64 = caps.get(1)?.as_str().parse().ok()?;
    if !value.is_finite() {
        return None;
    }
    let unit = caps.get(2).map(|m| m.as_str().to_uppercase()).unwrap_or_default();
    let factor = match unit.as_str() {
        "K" => 1024f64,
        "M" => 1024f64 * 1024f64,
        "G" => 1024f64 * 1024f64 * 1024f64,
        _ => 1f64,
    };
    Some((value * factor).round() as i64)
}

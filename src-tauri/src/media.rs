/**
 * 缩略图 / 原图的本地协议。
 *
 * 渲染层拿到的图片地址由后端拼好（ItemSummary.thumbUrl / imageUrl），
 * 换外壳时只要保持同一套语义即可 —— 所以这里保留 gugu://thumb/<id> 的**路径形状**，
 * 只是按 WebView2 的约定换成 http://gugu.localhost/thumb/<id>。
 */
use crate::AppState;
use std::fs;
use tauri::http::Response;
use tauri::{Manager, UriSchemeContext};

pub const THUMB_BASE: &str = "http://gugu.localhost/thumb/";
pub const MEDIA_BASE: &str = "http://gugu.localhost/media/";

fn mime_of(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "heic" => "image/heic",
        _ => "image/jpeg",
    }
}

fn not_found(msg: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(404)
        .header("content-type", "text/plain")
        .body(msg.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// 处理 gugu 协议请求：/thumb/<id> 与 /media/<id>
pub fn handle(ctx: UriSchemeContext<'_, tauri::Wry>, request: tauri::http::Request<Vec<u8>>) -> Response<Vec<u8>> {
    let state = ctx.app_handle().state::<AppState>();
    let path = request.uri().path().trim_start_matches('/').to_string();
    let (kind, id_text) = match path.split_once('/') {
        Some((k, v)) => (k.to_string(), v.to_string()),
        None => return not_found("bad path"),
    };
    let Ok(id) = id_text.parse::<i64>() else {
        return not_found("bad id");
    };

    let lib = state.lib.lock().unwrap().clone();
    let db = state.db.lock().unwrap();

    let (rel, ext) = match kind.as_str() {
        "thumb" => {
            let thumb = crate::store::thumb_rel_path(&db, id).ok().flatten();
            match thumb {
                Some(rel) => (rel, "jpg".to_string()),
                None => return not_found("no thumb"),
            }
        }
        "media" => match crate::store::file_rel_path(&db, id, "original").ok().flatten() {
            Some(rel) => (rel.clone(), crate::library::ext_of(&rel)),
            None => return not_found("no file"),
        },
        _ => return not_found("unknown kind"),
    };

    let Some(abs) = lib.resolve_inside(&rel) else {
        return not_found("escape");
    };
    match fs::read(&abs) {
        Ok(bytes) => Response::builder()
            .status(200)
            .header("content-type", mime_of(&ext))
            .header("cache-control", "no-cache")
            .body(bytes)
            .unwrap_or_else(|_| not_found("build failed")),
        Err(_) => not_found("read failed"),
    }
}

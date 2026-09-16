//! 截图自检模式：`GUGU_SHOT=<输出目录>` 启动时，等界面稳定后截图并退出。
//!
//! 与 Electron 版的契约逐字保持一致：
//! `GUGU_SHOT / GUGU_SHOT_VIEW / GUGU_SHOT_DELAY / GUGU_SHOT_SETTLE /
//! GUGU_SHOT_FORMAT / GUGU_DIAG / GUGU_EVAL`，
//! 产物 `<视图|home>.<png|jpg>`，注入了 eval 脚本时再补一张 `<视图>-after-eval.<ext>`。

use std::path::PathBuf;
use std::time::Duration;

use tauri::Manager;

/// 渲染进程里的体检脚本：结构、布局、图片解码情况（与 Electron 版逐字一致）
const DIAGNOSTICS_SCRIPT: &str = r#"(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => Array.from(document.querySelectorAll(s))
  const imgs = qa('img')
  const decoded = imgs.filter((i) => i.complete && i.naturalWidth > 0)
  const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0)
  const grid = q('.grid')
  const lbImg = q('.lightbox-stage img')
  return {
    title: document.title,
    theme: document.documentElement.dataset.theme || 'dark',
    rootChildren: document.getElementById('root') ? document.getElementById('root').childElementCount : 0,
    cards: qa('.card').length,
    thumbs: qa('.card img').length,
    imagesDecoded: decoded.length,
    imagesBroken: broken.length,
    brokenSrc: broken.slice(0, 3).map((i) => i.getAttribute('src')),
    gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    gridWidth: grid ? Math.round(grid.getBoundingClientRect().width) : null,
    sidebarActive: qa('.side-item.active').length,
    tagChips: qa('.tag-chip').length,
    filterPills: qa('.filter-bar .pill').length,
    filterMeta: q('.filter-bar .meta-line') ? q('.filter-bar .meta-line').textContent : null,
    hasLightbox: Boolean(q('.lightbox')),
    lightboxImage: lbImg ? { w: lbImg.naturalWidth, h: lbImg.naturalHeight } : null,
    lightboxNav: qa('.lb-nav').length,
    lightboxStrip: qa('.lb-strip button').length,
    kvRows: qa('.kv dt').length,
    panels: qa('.card-panel').length,
    targetGroups: qa('.target-group').length,
    statCards: qa('.stat').length,
    logRows: qa('.logs .row').length,
    bodyOverflowX: document.body.scrollWidth > document.body.clientWidth + 1,
    font: getComputedStyle(document.body).fontFamily.split(',')[0],
    bg: getComputedStyle(document.body).backgroundColor
  }
})()"#;

fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(default)
}

fn shot_dir() -> Option<PathBuf> {
    std::env::var("GUGU_SHOT").ok().filter(|v| !v.is_empty()).map(PathBuf::from)
}

fn as_jpeg() -> bool {
    std::env::var("GUGU_SHOT_FORMAT").map(|v| v == "jpeg").unwrap_or(false)
}

fn extension() -> &'static str {
    if as_jpeg() { "jpg" } else { "png" }
}

/// 当前视图名；没有指定视图时叫 home（与 Electron 版的输出文件名一致）
fn view_label() -> String {
    match std::env::var("GUGU_SHOT_VIEW") {
        Ok(v) if !v.trim().is_empty() => v,
        _ => "home".to_string(),
    }
}

/// 截图模式接管启动流程。返回 true 表示本次是截图模式，调用方不要再装配普通的 eval 钩子。
pub fn maybe_start(app: &tauri::AppHandle) -> bool {
    let Some(dir) = shot_dir() else { return false };
    if let Err(err) = std::fs::create_dir_all(&dir) {
        eprintln!("[gugu] 创建截图目录失败: {err}");
    }

    let view = std::env::var("GUGU_SHOT_VIEW").unwrap_or_default();
    let label = view_label();
    let delay = env_u64("GUGU_SHOT_DELAY", 2600);
    let settle = env_u64("GUGU_SHOT_SETTLE", 1400);
    let want_diag = std::env::var("GUGU_DIAG").map(|v| !v.is_empty()).unwrap_or(false);
    let eval = std::env::var("GUGU_EVAL").ok();
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(delay)).await;
        let Some(win) = app.get_webview_window("main") else {
            eprintln!("[gugu] 截图模式：找不到主窗口");
            app.exit(1);
            return;
        };

        if !view.is_empty() {
            let detail = serde_json::to_string(&view).unwrap_or_else(|_| "\"\"".to_string());
            let script = format!(
                "window.dispatchEvent(new CustomEvent('gugu:navigate', {{ detail: {detail} }})); true"
            );
            if let Err(err) = win.eval(&script) {
                eprintln!("[gugu] 切换视图注入失败: {err}");
            }
            tokio::time::sleep(Duration::from_millis(settle)).await;
        }
        // 强制重绘并等一帧：GPU 合成的画面 PrintWindow 才拿得到
        tokio::time::sleep(Duration::from_millis(400)).await;

        match capture_and_save(&win, &label, "") {
            Ok(path) => eprintln!("[gugu] 截图已保存 {}", path.display()),
            Err(err) => eprintln!("[gugu] 截图失败: {err}"),
        }

        let label_json = serde_json::to_string(&label).unwrap_or_else(|_| "\"home\"".to_string());
        let diag_injected = if want_diag {
            let wrapped = format!(
                "(async () => {{
                   try {{
                     const r = {script};
                     await window.__TAURI_INTERNALS__.invoke('debug_diag', {{ view: {label}, payload: {{ ...r, consoleErrors: [] }} }});
                   }} catch (e) {{
                     await window.__TAURI_INTERNALS__.invoke('debug_diag', {{ view: {label}, payload: {{ ok: false, error: String(e) }} }});
                   }}
                 }})()",
                script = DIAGNOSTICS_SCRIPT,
                label = label_json
            );
            match win.eval(&wrapped) {
                Ok(_) => true,
                Err(err) => {
                    eprintln!("[gugu] DOM 体检注入失败: {err}");
                    false
                }
            }
        } else {
            false
        };

        match eval {
            Some(script) => {
                // 沿用 Electron 版的 harness 约定：__EVAL__{ok,result,error,consoleErrors}
                let wrapped = format!(
                    "(async () => {{
                       const rep = (p) => window.__TAURI_INTERNALS__.invoke('debug_report', {{ payload: p }});
                       try {{ const r = await ({}); await rep({{ ok: true, result: r, consoleErrors: [] }}); }}
                       catch (e) {{ await rep({{ ok: false, error: String(e), consoleErrors: [] }}); }}
                       await window.__TAURI_INTERNALS__.invoke('shot_after_eval');
                     }})()",
                    script
                );
                if let Err(err) = win.eval(&wrapped) {
                    eprintln!("[gugu] eval 注入失败: {err}");
                    app.exit(1);
                }
            }
            // 没有 eval 时：体检结果打完就收工；体检没注进去就直接收工
            None => {
                if !diag_injected {
                    app.exit(0);
                }
            }
        }
    });

    true
}

/// eval 脚本跑完后的补拍（由渲染进程回调触发），拍完退出应用
pub fn capture_after_eval(app: &tauri::AppHandle) {
    let label = view_label();
    if let Some(win) = app.get_webview_window("main") {
        match capture_and_save(&win, &label, "-after-eval") {
            Ok(path) => eprintln!("[gugu] 截图已保存 {}", path.display()),
            Err(err) => eprintln!("[gugu] 补拍失败: {err}"),
        }
    }
    app.exit(0);
}

fn capture_and_save(
    win: &tauri::WebviewWindow,
    label: &str,
    suffix: &str,
) -> Result<PathBuf, String> {
    let dir = shot_dir().ok_or_else(|| "GUGU_SHOT 未设置".to_string())?;
    let path = dir.join(format!("{label}{suffix}.{}", extension()));
    let (width, height, rgba) = capture_rgba(win)?;
    let image = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| "像素数据长度与尺寸不匹配".to_string())?;
    if as_jpeg() {
        // 归档用 JPEG（体积约为 PNG 的 1/5），日常自检仍用 PNG 保留无损细节
        let file = std::fs::File::create(&path).map_err(|e| format!("创建文件失败: {e}"))?;
        let mut writer = std::io::BufWriter::new(file);
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, 86)
            .encode_image(&image)
            .map_err(|e| format!("编码 JPEG 失败: {e}"))?;
    } else {
        image
            .save_with_format(&path, image::ImageFormat::Png)
            .map_err(|e| format!("编码 PNG 失败: {e}"))?;
    }
    Ok(path)
}

/// 抓窗口客户区像素。PrintWindow 带 PW_RENDERFULLCONTENT 才能拿到 GPU 合成的 WebView2 画面。
#[cfg(target_os = "windows")]
pub fn capture_rgba(win: &tauri::WebviewWindow) -> Result<(u32, u32, Vec<u8>), String> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
    use windows::Win32::UI::WindowsAndMessaging::GetClientRect;

    let hwnd: HWND = win.hwnd().map_err(|e| format!("取窗口句柄失败: {e}"))?;

    unsafe {
        let mut rect = RECT::default();
        GetClientRect(hwnd, &mut rect).map_err(|e| format!("取窗口尺寸失败: {e}"))?;
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return Err(format!("窗口尺寸异常：{width}x{height}"));
        }

        let window_dc = GetDC(Some(hwnd));
        if window_dc.0.is_null() {
            return Err("取窗口 DC 失败".to_string());
        }
        let mem_dc = CreateCompatibleDC(Some(window_dc));
        let bitmap = CreateCompatibleBitmap(window_dc, width, height);
        let previous = SelectObject(mem_dc, HGDIOBJ(bitmap.0));

        // 1 = PW_CLIENTONLY，2 = PW_RENDERFULLCONTENT（windows 0.61 只导出了前者）
        let printed = PrintWindow(hwnd, mem_dc, PRINT_WINDOW_FLAGS(1 | 2));

        let mut buffer = vec![0u8; (width as usize) * (height as usize) * 4];
        let mut info = BITMAPINFO::default();
        info.bmiHeader = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height, // 负高度 = 自顶向下的位图
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };
        let lines = GetDIBits(
            mem_dc,
            bitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr().cast()),
            &mut info,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, previous);
        let _ = DeleteObject(HGDIOBJ(bitmap.0));
        let _ = DeleteDC(mem_dc);
        ReleaseDC(Some(hwnd), window_dc);

        if !printed.as_bool() {
            return Err("PrintWindow 调用失败".to_string());
        }
        if lines == 0 {
            return Err("GetDIBits 读取像素失败".to_string());
        }

        // BGRA → RGBA；32 位 BI_RGB 的 alpha 通道不可信，一律按不透明处理
        for pixel in buffer.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            pixel[3] = 255;
        }
        Ok((width as u32, height as u32, buffer))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn capture_rgba(_win: &tauri::WebviewWindow) -> Result<(u32, u32, Vec<u8>), String> {
    Err("当前平台还没有实现窗口截图".to_string())
}

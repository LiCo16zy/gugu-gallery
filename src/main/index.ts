/**
 * Electron 主进程入口。
 */
import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { app, BrowserWindow, protocol, shell } from 'electron'
import { AppContext } from './context'
import { registerIpc } from './ipc'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic'
}

let mainWindow: BrowserWindow | null = null
const ctx = new AppContext()

// 自定义协议必须在使用前登记为特权协议，否则 fetch/stream 都不可用
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'gugu',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

const isShotMode = Boolean(process.env.GUGU_SHOT)

if (!app.requestSingleInstanceLock() && !isShotMode) {
  app.quit()
} else {
  void bootstrap()
}

async function bootstrap(): Promise<void> {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  await app.whenReady()
  await ctx.init()

  registerMediaProtocol()
  registerIpc(ctx, () => mainWindow)

  mainWindow = createWindow()
  await loadRenderer(mainWindow)

  if (isShotMode) await runScreenshot(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      void loadRenderer(mainWindow)
    }
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1040,
    minHeight: 660,
    show: false,
    backgroundColor: '#0d1017',
    autoHideMenuBar: true,
    title: '咕咕图库',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

async function loadRenderer(win: BrowserWindow): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    await win.loadURL(devUrl)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** gugu://thumb/<id> 与 gugu://media/<id>：把本地文件安全地喂给渲染进程 */
function registerMediaProtocol(): void {
  protocol.handle('gugu', async (request) => {
    try {
      const url = new URL(request.url)
      const kind = url.hostname
      const id = Number.parseInt(url.pathname.replace(/^\/+/, ''), 10)
      if (!Number.isFinite(id)) return new Response('bad id', { status: 400 })

      const item = ctx.repository.getItem(id)
      if (!item) return new Response('not found', { status: 404 })

      let rel: string | null = null
      if (kind === 'thumb') rel = item.relPath ? ctx.library.thumbRelPath(id) : null
      if (kind === 'media') rel = item.relPath

      // 缩略图还没生成时退回原图，避免界面出现空洞
      if (kind === 'thumb' && rel && !ctx.library.exists(rel)) rel = item.relPath
      if (!rel || !ctx.library.exists(rel)) return new Response('not found', { status: 404 })

      const abs = ctx.library.resolveInside(rel)
      const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream',
          'cache-control': 'no-cache'
        }
      })
    } catch (err) {
      return new Response(err instanceof Error ? err.message : 'error', { status: 500 })
    }
  })
}

/**
 * 截图自检模式：GUGU_SHOT=<输出目录> 启动时，等界面稳定后截图并退出。
 * 用于在没有人工介入的情况下回归前端视觉。
 * 追加 GUGU_DIAG=1 会把 DOM 体检结果打到 stdout，便于自动断言。
 */
async function runScreenshot(win: BrowserWindow): Promise<void> {
  const outDir = process.env.GUGU_SHOT as string
  const view = process.env.GUGU_SHOT_VIEW ?? ''
  const delay = Number.parseInt(process.env.GUGU_SHOT_DELAY ?? '2600', 10)

  const consoleErrors: string[] = []
  win.webContents.on('console-message', (...args: unknown[]) => {
    const level = args[1] as number
    const message = args[2] as string
    if (typeof level === 'number' && level >= 2) consoleErrors.push(String(message))
  })

  await new Promise((resolve) => setTimeout(resolve, delay))
  if (view) {
    await win.webContents.executeJavaScript(
      `window.dispatchEvent(new CustomEvent('gugu:navigate', { detail: ${JSON.stringify(view)} })); true`
    )
    await new Promise((resolve) => setTimeout(resolve, Number.parseInt(process.env.GUGU_SHOT_SETTLE ?? '1400', 10)))
  }

  // 隐藏窗口的合成器不一定会产出新帧，截图前强制重绘并等一帧
  win.webContents.invalidate()
  await new Promise((resolve) => setTimeout(resolve, 400))

  const image = await win.webContents.capturePage()
  await writeFile(join(outDir, `${view || 'home'}.png`), image.toPNG())

  if (process.env.GUGU_DIAG) {
    const report = await win.webContents.executeJavaScript(DIAGNOSTICS_SCRIPT)
    console.log(`__DIAG__${view || 'home'}__${JSON.stringify({ ...report, consoleErrors })}`)
  }

  // GUGU_EVAL：把一段脚本注入页面执行，用于交互回归测试
  const evalScript = process.env.GUGU_EVAL
  if (evalScript) {
    try {
      const result = await win.webContents.executeJavaScript(evalScript, true)
      console.log(`__EVAL__${JSON.stringify({ ok: true, result, consoleErrors })}`)
    } catch (err) {
      console.log(
        `__EVAL__${JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err), consoleErrors })}`
      )
    }
    const after = await win.webContents.capturePage()
    await writeFile(join(outDir, `${view || 'home'}-after-eval.png`), after.toPNG())
  }

  app.quit()
}

/** 在渲染进程里跑的一段体检脚本：结构、布局、图片解码情况 */
const DIAGNOSTICS_SCRIPT = /* js */ `(() => {
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
})()`


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void ctx.dispose()
})

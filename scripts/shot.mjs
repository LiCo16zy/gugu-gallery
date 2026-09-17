/**
 * 前端视觉自检：以 GUGU_SHOT 模式启动应用，自动截图若干个视图。
 *
 *   node scripts/shot.mjs                  # 截图到 screenshots/
 *   node scripts/shot.mjs gallery crawl    # 只截指定视图
 *
 * 需要先 `cd src-tauri && cargo build`。图库数据取自 GUGU_LIBRARY_ROOT（默认 data/demo）。
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { root, runApp, startDevServer } from './tauri-app.mjs'

const outDir = process.env.GUGU_SHOT_DIR ?? join(root, 'screenshots')
await mkdir(outDir, { recursive: true })

const views = process.argv.slice(2)
const targets = views.length > 0 ? views : ['gallery', 'lightbox', 'crawl', 'settings']

const libraryRoot = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')
const format = process.env.GUGU_SHOT_FORMAT ?? 'png'
const ext = format === 'jpeg' ? 'jpg' : 'png'

const vite = await startDevServer()
try {
  for (const view of targets) {
    const { code, timedOut } = await runApp(
      {
        GUGU_SHOT: outDir,
        GUGU_SHOT_VIEW: view === 'gallery' ? '' : view,
        GUGU_SHOT_DELAY: view === 'gallery' ? '4200' : '3200',
        GUGU_SHOT_SETTLE: '2200',
        GUGU_SHOT_FORMAT: format,
        GUGU_DIAG: process.env.GUGU_DIAG ?? '1',
        GUGU_LIBRARY_ROOT: libraryRoot,
        GUGU_SETTINGS_FILE: join(root, 'data', 'screenshot-settings.json')
      },
      { timeoutMs: 120000 }
    )
    if (timedOut || code !== 0) {
      console.error(`截图 ${view} 失败（${timedOut ? '超时' : `退出码 ${code}`}）`)
      process.exit(1)
    }
    console.log(`已截图: ${join(outDir, `${view === 'gallery' ? 'home' : view}.${ext}`)}`)
  }
} finally {
  vite.kill()
}

console.log('完成。')
// 开发服务器的孙进程万一还挂着句柄，显式退出，别让脚本僵着
setTimeout(() => process.exit(0), 200)

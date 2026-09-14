/**
 * 前端视觉自检：以 GUGU_SHOT 模式启动应用，自动截图若干个视图。
 *
 *   node scripts/screenshot.mjs                 # 截图到 screenshots/
 *   node scripts/screenshot.mjs gallery crawl   # 只截指定视图
 *
 * 需要先 `npm run build`。图库数据取自 GUGU_LIBRARY_ROOT（默认 data/demo）。
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const electronBinary = join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
)

if (!existsSync(electronBinary)) {
  console.error('未找到 Electron 可执行文件，请先执行 npm install')
  process.exit(1)
}
if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  console.error('未找到构建产物，请先执行 npm run build')
  process.exit(1)
}

const outDir = process.env.GUGU_SHOT_DIR ?? join(root, 'screenshots')
await mkdir(outDir, { recursive: true })

const views = process.argv.slice(2)
const targets = views.length > 0 ? views : ['gallery', 'lightbox', 'crawl', 'settings']

const libraryRoot = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')

for (const view of targets) {
  await new Promise((resolvePromise, reject) => {
    const env = {
      ...process.env,
      GUGU_SHOT: outDir,
      GUGU_SHOT_VIEW: view === 'gallery' ? '' : view,
      GUGU_SHOT_DELAY: view === 'gallery' ? '4200' : '3200',
      GUGU_SHOT_SETTLE: '2200',
      GUGU_LIBRARY_ROOT: libraryRoot,
      GUGU_SETTINGS_FILE: join(root, 'data', 'screenshot-settings.json'),
      GUGU_DIAG: process.env.GUGU_DIAG ?? '1',
      GUGU_SHOT_FORMAT: process.env.GUGU_SHOT_FORMAT ?? 'png'
    }
    const child = spawn(electronBinary, [join(root, 'out', 'main', 'index.js')], {
      cwd: root,
      env,
      stdio: 'inherit'
    })
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`截图 ${view} 退出码 ${code}`))
    })
  })
  const ext = (process.env.GUGU_SHOT_FORMAT ?? 'png') === 'jpeg' ? 'jpg' : 'png'
  console.log(`已截图: ${join(outDir, `${view === 'gallery' ? 'home' : view}.${ext}`)}`)
}

console.log('完成。')

/**
 * 生成应用图标 build/icon.png（512×512）。
 *
 * 为什么用 Electron 来画：本机没有 sharp / ImageMagick 这类图形库，
 * 而 Electron 自带 Chromium，直接渲染一段 SVG 再截图就是最稳的栅格化方案，
 * 零额外依赖，矢量源也能跟着仓库一起版本化。
 *
 *   node scripts/make-icon.mjs
 *
 * 产物会被 electron-builder 自动转成 Windows 的 .ico
 * （应用图标与安装程序图标都用它）。
 * 想换成自己的图标：直接把 512×512 以上的 PNG 覆盖到 build/icon.png 即可。
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = join(root, 'build')

/** 图标矢量源：渐变圆角方块 + 品牌字「咕」 */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8aa4ff"/>
      <stop offset="52%" stop-color="#7c9cff"/>
      <stop offset="100%" stop-color="#b98cff"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="46%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#1b2440" flood-opacity="0.45"/>
    </filter>
  </defs>

  <g filter="url(#soft)">
    <rect x="26" y="22" width="460" height="460" rx="112" fill="url(#bg)"/>
  </g>
  <rect x="26" y="22" width="460" height="460" rx="112" fill="url(#gloss)"/>
  <rect x="26" y="22" width="460" height="460" rx="112" fill="none"
        stroke="#ffffff" stroke-opacity="0.34" stroke-width="3"/>

  <text x="256" y="256" text-anchor="middle" dominant-baseline="central"
        font-family="Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
        font-size="236" font-weight="700" fill="#ffffff" fill-opacity="0.97"
        style="letter-spacing:-6px">咕</text>
</svg>`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:512px;height:512px;background:transparent;overflow:hidden}
  svg{display:block}
</style></head><body>${ICON_SVG}</body></html>`

await mkdir(outDir, { recursive: true })

const electronBinary = join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
)

const runner = join(outDir, '.make-icon.cjs')
await writeFile(
  runner,
  `const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const html = fs.readFileSync(process.argv[2], 'utf8')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512, height: 512, show: false, frame: false,
    transparent: true, backgroundColor: '#00000000',
    webPreferences: { offscreen: false }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 900))
  const image = await win.webContents.capturePage()
  fs.writeFileSync(process.argv[3], image.toPNG())
  console.log('ICON_BYTES', fs.statSync(process.argv[3]).size, JSON.stringify(image.getSize()))
  app.quit()
})
`,
  'utf8'
)

const htmlPath = join(outDir, '.make-icon.html')
await writeFile(htmlPath, html, 'utf8')

const outPath = join(outDir, 'icon.png')
await new Promise((resolvePromise, reject) => {
  const child = spawn(electronBinary, [runner, htmlPath, outPath], { cwd: root, stdio: 'inherit' })
  child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error('生成图标失败'))))
})

console.log(`图标已生成：${outPath}`)

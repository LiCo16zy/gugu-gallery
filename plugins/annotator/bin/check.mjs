/**
 * 标注工具自检：程序化驱动界面完成「打开工具 -> 点选元素 -> 写批注 -> 框选区域 -> 导出」，
 * 然后校验 devlog 轮次目录里的产物是否齐全。
 *
 *   npm run annotatecheck
 *
 * 导出目标通过 GUGU_WORKSPACE 指向 data/annotate-test，不会污染真实的 devlog 档案。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const electronBinary = join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
)

const workspace = join(root, 'data', 'annotate-test')
const libraryRoot = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')

if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  console.error('缺少构建产物，请先 npm run build')
  process.exit(1)
}

await rm(workspace, { recursive: true, force: true })
await mkdir(workspace, { recursive: true })

/* ------------------------------------------------------- 注入到页面的脚本 */

const SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const out = {}
  const btn = (text) =>
    [...document.querySelectorAll('.gugu-anno-seg button, .gugu-anno-btn')].find(
      (b) => b.textContent.trim() === text
    )
  const setTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const fire = (el, type, x, y) =>
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }))

  await sleep(400)

  // 1) Ctrl+Shift+A 打开工具
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', ctrlKey: true, shiftKey: true, bubbles: true }))
  await sleep(450)
  out.toolbarVisible = Boolean(document.querySelector('.gugu-anno-toolbar'))
  out.hintBrowse = document.querySelector('.gugu-anno-hint')?.textContent?.slice(0, 12) ?? null

  // 2) 切到点选模式
  btn('点选')?.click()
  await sleep(200)
  out.modeAfterSwitch = [...document.querySelectorAll('.gugu-anno-seg button')].find((b) => b.className === 'on')?.textContent

  // 3) 点选标签胶囊
  const chip = document.querySelector('.tag-chip')
  out.pickedElement = chip ? chip.className : null
  const rect = chip.getBoundingClientRect()
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  fire(chip, 'mousemove', cx, cy)
  await sleep(150)
  out.hoverLabel = document.querySelector('.gugu-anno-hover-label')?.textContent ?? null
  fire(chip, 'mousedown', cx, cy)
  fire(chip, 'mouseup', cx, cy)
  await sleep(350)
  out.editorOpen = Boolean(document.querySelector('.gugu-anno-editor'))
  out.editorComponent = document.querySelector('.gugu-anno-target code')?.textContent ?? null
  out.editorSelector = [...document.querySelectorAll('.gugu-anno-target code')].pop()?.textContent ?? null

  // 4) 写批注并提交
  const ta = document.querySelector('.gugu-anno-editor textarea')
  setTextarea(ta, '标签胶囊太挤：字号想从 11.5px 提到 12.5px，左右内边距加到 12px')
  await sleep(120)
  btn('添加')?.click()
  await sleep(350)
  out.pinsAfterFirst = document.querySelectorAll('.gugu-anno-pin').length

  // 5) 框选一个区域
  btn('框选')?.click()
  await sleep(150)
  fire(document.body, 'mousedown', 420, 300)
  fire(document.body, 'mousemove', 760, 540)
  fire(document.body, 'mouseup', 760, 540)
  await sleep(350)
  out.regionEditorOpen = Boolean(document.querySelector('.gugu-anno-editor'))
  const ta2 = document.querySelector('.gugu-anno-editor textarea')
  setTextarea(ta2, '卡片区域留白偏大，希望整体收紧一档')
  await sleep(120)
  btn('添加')?.click()
  await sleep(350)
  out.pinsAfterSecond = document.querySelectorAll('.gugu-anno-pin').length
  out.modeAfterSubmit = [...document.querySelectorAll('.gugu-anno-seg button')].find((b) => b.className === 'on')?.textContent
  out.panelItems = document.querySelectorAll('.gugu-anno-item').length

  // 6) 导出
  btn('导出标注')?.click()
  await sleep(400)
  out.modalOpen = Boolean(document.querySelector('.gugu-anno-modal'))
  const noteEl = document.querySelector('.gugu-anno-modal textarea')
  setTextarea(noteEl, '自检脚本生成的示例标注，用于验证导出链路。')
  await sleep(150)
  btn('确认导出')?.click()
  await sleep(2200)
  out.toastAfterExport = document.querySelector('.toast')?.textContent ?? null
  return out
})()`

/* ------------------------------------------------------------------ 运行 */

const env = {
  ...process.env,
  GUGU_SHOT: join(workspace, 'shots'),
  GUGU_SHOT_VIEW: '',
  GUGU_SHOT_DELAY: '3400',
  GUGU_LIBRARY_ROOT: libraryRoot,
  GUGU_SETTINGS_FILE: join(root, 'data', 'annotate-settings.json'),
  GUGU_WORKSPACE: workspace,
  GUGU_EVAL: SCRIPT
}

await mkdir(join(workspace, 'shots'), { recursive: true })

const output = await new Promise((resolvePromise) => {
  const child = spawn(electronBinary, [join(root, 'out', 'main', 'index.js')], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let buf = ''
  child.stdout.on('data', (d) => (buf += String(d)))
  child.stderr.on('data', (d) => (buf += String(d)))
  child.on('exit', () => resolvePromise(buf))
})

const match = /__EVAL__(\{.*\})/s.exec(output)
if (!match) {
  console.error('未拿到执行结果，原始输出：\n' + output)
  process.exit(1)
}
const { ok, result, error, consoleErrors } = JSON.parse(match[1])
if (!ok) {
  console.error('注入脚本执行失败:', error)
  process.exit(1)
}

/* ------------------------------------------------------------ 校验产物 */

const roundsDir = join(workspace, 'devlog', 'rounds')
const rounds = existsSync(roundsDir) ? await readdir(roundsDir) : []
const roundDir = rounds.length > 0 ? join(roundsDir, rounds[0]) : null

let exported = null
let markdown = ''
let shots = []
if (roundDir) {
  try {
    exported = JSON.parse(await readFile(join(roundDir, 'annotations.json'), 'utf8'))
  } catch {
    /* ignore */
  }
  try {
    markdown = await readFile(join(roundDir, 'annotations.md'), 'utf8')
  } catch {
    /* ignore */
  }
  try {
    shots = await readdir(join(roundDir, 'screenshots'))
  } catch {
    /* ignore */
  }
}

const checks = [
  ['工具栏能打开', result.toolbarVisible === true],
  ['能切换点选模式', result.modeAfterSwitch === '点选'],
  ['悬停能识别到元素', Boolean(result.hoverLabel)],
  ['点选后弹出批注框', result.editorOpen === true],
  ['批注框记录了组件名', Boolean(result.editorComponent)],
  ['提交后生成图钉', result.pinsAfterFirst === 1],
  ['框选区域也能弹出批注框', result.regionEditorOpen === true],
  ['第二条标注生成', result.pinsAfterSecond === 2],
  ['提交后自动回到浏览模式', result.modeAfterSubmit === '浏览'],
  ['标注清单列出两条', result.panelItems === 2],
  ['导出弹窗能打开', result.modalOpen === true],
  ['导出后给出轮次提示', /devlog\/rounds/.test(result.toastAfterExport ?? '')],
  ['生成了轮次目录', rounds.length === 1],
  ['annotations.json 可解析且有 2 条', exported?.annotations?.length === 2],
  ['annotations.md 有内容', markdown.includes('逐条标注')],
  ['整页截图已落盘', shots.includes('00-full.png')],
  ['每条标注都有裁片', shots.filter((f) => /^\d{3}-/.test(f)).length === 2],
  ['运行期无控制台错误', (consoleErrors ?? []).length === 0]
]

console.log('标注工具自检：')
let failed = 0
for (const [label, pass] of checks) {
  console.log(`  ${pass ? '✓' : '✗'} ${label}`)
  if (!pass) failed += 1
}

console.log('\n页面脚本返回值：')
console.log(JSON.stringify(result, null, 2).split('\n').map((l) => '  ' + l).join('\n'))

if (exported) {
  console.log('\n导出的标注条目：')
  for (const a of exported.annotations) {
    console.log(`  ${a.index}. [${a.category}/${a.severity}] ${a.comment}`)
    console.log(`     组件=${a.target.component} 选择器=${a.target.selector.slice(0, 90)}`)
  }
}
console.log(`\n产物目录：${roundDir ?? '(无)'}`)
console.log(`截图：${shots.join(', ')}`)

if (failed > 0) {
  console.error(`\n${failed} 项检查未通过`)
  process.exit(1)
}
console.log('\n标注工具自检通过。')

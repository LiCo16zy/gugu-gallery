/**
 * 交互回归测试：驱动真实的 Electron 界面点一遍关键路径，
 * 断言筛选、搜索、灯箱、键盘翻页、排序、主题切换的行为。
 *
 *   npm run uicheck
 *
 * 需要先 npm run build；依赖 GUGU_LIBRARY_ROOT（默认 data/demo）里的图库数据。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
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

const libraryRoot = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')
const outDir = join(root, 'screenshots', 'uicheck')

if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  console.error('缺少构建产物，请先 npm run build')
  process.exit(1)
}
await mkdir(outDir, { recursive: true })

const SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const qa = (s) => Array.from(document.querySelectorAll(s))
  const byText = (sel, text) => qa(sel).find((el) => (el.textContent || '').trim() === text)
  const meta = () => (document.querySelector('.filter-bar .meta-line') || {}).textContent || ''
  const out = {}

  await sleep(300)

  // 1) 初始网格
  out.initialCards = qa('.card').length
  out.initialMeta = meta()

  // 2) 点第一个标签，筛选应生效
  const chip = qa('.tag-chip')[0]
  out.firstTag = chip ? chip.textContent.trim() : null
  if (chip) {
    chip.click()
    await sleep(900)
    out.afterTagMeta = meta()
    out.afterTagChips = qa('.filter-bar .pill').length
    out.afterTagCards = qa('.card').length
    const clear = byText('.filter-bar .pill', '清空筛选')
    if (clear) { clear.click(); await sleep(900) }
    out.afterClearMeta = meta()
  }

  // 3) 搜索框输入
  const input = document.querySelector('.search input')
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '碧蓝档案')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(1100)
    out.searchMeta = meta()
    out.searchFirstTitle = (document.querySelector('.card-title') || {}).textContent || null
    setter.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(1000)
  }

  // 4) 打开灯箱
  const firstCard = document.querySelector('.card')
  if (firstCard) {
    firstCard.click()
    await sleep(1200)
    const kv = qa('.kv dd')
    out.lightboxOpen = Boolean(document.querySelector('.lightbox'))
    out.lightboxId = kv[0] ? kv[0].textContent : null
    out.lightboxImage = (() => {
      const img = document.querySelector('.lightbox-stage img')
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null
    })()
    out.lightboxTagCount = qa('.lb-tags button').length
    out.lightboxStrip = qa('.lb-strip button').length

    // 5) 键盘翻页
    const before = out.lightboxId
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await sleep(1000)
    const kvAfter = qa('.kv dd')
    out.lightboxIdAfterArrow = kvAfter[0] ? kvAfter[0].textContent : null
    out.arrowChangedImage = out.lightboxIdAfterArrow !== before

    // 6) Esc 关闭
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await sleep(600)
    out.lightboxClosed = !document.querySelector('.lightbox')
  }

  // 6.5) 侧栏分类树：展开某个一级分类，点它的二级分类
  const topLevel = qa('.side-item').filter((el) => !el.classList.contains('sub'))
  const firstPlate = topLevel[5]
  if (firstPlate) {
    out.plateName = (firstPlate.querySelector('.label') || {}).textContent || null
    firstPlate.click()
    await sleep(700)
    out.subItems = qa('.side-item.sub').length
    out.subNames = qa('.side-item.sub .label').slice(0, 4).map((el) => el.textContent)
    const sub = qa('.side-item.sub')[0]
    if (sub) {
      sub.click()
      await sleep(1000)
      out.plateMeta = meta()
      out.plateChip = (document.querySelector('.filter-bar .pill.active') || {}).textContent || null
      const reset = byText('.filter-bar .pill', '清空筛选')
      if (reset) { reset.click(); await sleep(800) }
    }
  }

  // 7) 排序切换
  const sort = document.querySelector('.topbar select.select')
  if (sort) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(sort, 'resolution')
    sort.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(1100)
    out.sortValue = sort.value
    out.sortMeta = meta()
  }

  // 8) 微缩视图
  const denseBtn = qa('.topbar .seg button')[1]
  if (denseBtn) {
    denseBtn.click()
    await sleep(700)
    out.denseColumns = getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length
    qa('.topbar .seg button')[0].click()
    await sleep(600)
  }

  // 9) 切到设置页并切浅色主题
  const settingsBtn = byText('.topbar .seg button', '设置')
  if (settingsBtn) {
    settingsBtn.click()
    await sleep(800)
    const lightBtn = byText('.seg button', '浅色')
    out.foundThemeSwitch = Boolean(lightBtn)
    if (lightBtn) {
      lightBtn.click()
      await sleep(1200)
      out.theme = document.documentElement.dataset.theme
      out.bodyBgAfterLight = getComputedStyle(document.body).backgroundColor
    }
  }

  out.consoleClean = true
  return out
})()`

const env = {
  ...process.env,
  GUGU_SHOT: outDir,
  GUGU_SHOT_VIEW: '',
  GUGU_SHOT_DELAY: '3200',
  GUGU_LIBRARY_ROOT: libraryRoot,
  GUGU_SETTINGS_FILE: join(root, 'data', 'uicheck-settings.json'),
  GUGU_EVAL: SCRIPT
}

const output = await new Promise((resolvePromise) => {
  const child = spawn(electronBinary, [join(root, 'out', 'main', 'index.js')], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let buf = ''
  child.stdout.on('data', (d) => {
    buf += String(d)
  })
  child.stderr.on('data', (d) => {
    buf += String(d)
  })
  child.on('exit', () => resolvePromise(buf))
})

const match = /__EVAL__(\{.*\})/s.exec(output)
if (!match) {
  console.error('未拿到测试结果，原始输出：\n' + output)
  process.exit(1)
}

const { ok, result, error, consoleErrors } = JSON.parse(match[1])
if (!ok) {
  console.error('脚本执行失败:', error)
  process.exit(1)
}

const checks = [
  ['首页渲染出卡片', result.initialCards > 0],
  ['顶部统计与实际数据一致', /共 \d+ 条/.test(result.initialMeta || '')],
  ['点击标签后筛选条件生效', (result.afterTagChips ?? 0) >= 1],
  ['清空筛选后恢复', (result.afterClearMeta || '').startsWith('共')],
  ['搜索能命中标签', /共 \d+ 条/.test(result.searchMeta || '')],
  ['都能打开灯箱', result.lightboxOpen === true],
  ['灯箱加载了原图', Boolean(result.lightboxImage && result.lightboxImage.w > 0)],
  ['灯箱有元数据面板', (result.lightboxTagCount ?? 0) > 0],
  ['灯箱有缩略图条', (result.lightboxStrip ?? 0) > 0],
  ['方向键能翻页', result.arrowChangedImage === true],
  ['Esc 能关闭灯箱', result.lightboxClosed === true],
  ['分类树能展开出二级分类', (result.subItems ?? 0) > 0],
  ['二级分类筛选生效', /共 \d+ 条/.test(result.plateMeta || '')],
  ['切换排序生效', result.sortValue === 'resolution'],
  ['微缩视图列数更多', (result.denseColumns ?? 0) >= 4],
  ['浅色主题可切换', result.theme === 'light'],
  ['运行期无控制台错误', (consoleErrors ?? []).length === 0]
]

console.log('交互回归结果：')
let failed = 0
for (const [label, pass] of checks) {
  console.log(`  ${pass ? '✓' : '✗'} ${label}`)
  if (!pass) failed += 1
}

console.log('\n原始数据：')
console.log(JSON.stringify(result, null, 2).split('\n').map((l) => '  ' + l).join('\n'))

if (failed > 0) {
  console.error(`\n${failed} 项交互检查未通过`)
  process.exit(1)
}
console.log('\n全部交互检查通过。截图见 screenshots/uicheck/')

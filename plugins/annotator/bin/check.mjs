/**
 * 标注工具自检：程序化驱动界面完成「打开工具 -> 点选元素 -> 写批注 -> 框选区域 -> 导出」，
 * 然后校验 devlog 轮次目录里的产物是否齐全。
 *
 *   npm run annotatecheck
 *
 * 导出目标通过 GUGU_WORKSPACE 指向 data/annotate-test，不会污染真实的 devlog 档案。
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runApp, startDevServer } from '../../../scripts/tauri-app.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

const workspace = join(root, 'data', 'annotate-test')
const libraryRoot = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')

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

  // 6.5) 批注框必须完整落在视口内，且「添加」够得着
  //      挑一个贴右下角的元素，旧实现（按固定高度硬算）会把它顶到屏幕外
  btn('点选')?.click()
  await sleep(200)
  {
    // 侧栏底部按钮正好贴在视口下沿，最能暴露「批注框被顶到屏幕外」的问题
    const target = document.querySelector('.sidebar-foot .side-item') || document.querySelector('.card')
    if (!target) return { error: 'no target for corner test' }
    const r = target.getBoundingClientRect()
    fire(target, 'mousedown', r.x + r.width / 2, r.y + r.height / 2)
    fire(target, 'mouseup', r.x + r.width / 2, r.y + r.height / 2)
    await sleep(450)
    const box = document.querySelector('.gugu-anno-editor')
    out.cornerEditorOpen = Boolean(box)
    if (box) {
      const br = box.getBoundingClientRect()
      out.editorRect = [Math.round(br.left), Math.round(br.top), Math.round(br.width), Math.round(br.height)]
      out.editorInViewport =
        br.left >= -1 && br.top >= -1 && br.right <= window.innerWidth + 1 && br.bottom <= window.innerHeight + 1
      const addBtn = Array.from(box.querySelectorAll('button')).find((b) => b.textContent.trim() === '添加')
      if (addBtn) {
        const ar = addBtn.getBoundingClientRect()
        const hit = document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2)
        out.addButtonHittable = hit === addBtn
      }
    }
    // 顺手验证：保存后仍然停在「点选」，可以直接继续标注
    const ta3 = box ? box.querySelector('textarea') : null
    if (ta3) {
      setTextarea(ta3, '连续标注第一笔')
      await sleep(150)
      Array.from(box.querySelectorAll('button')).find((b) => b.textContent.trim() === '添加')?.click()
      await sleep(450)
      out.modeAfterSave = [...document.querySelectorAll('.gugu-anno-seg button')].find((b) => b.className === 'on')?.textContent
      const pinsBefore = document.querySelectorAll('.gugu-anno-pin').length
      // 不点任何模式按钮，直接再点一次元素
      const chip2 = document.querySelector('.tag-chip')
      const cr = chip2.getBoundingClientRect()
      fire(chip2, 'mousedown', cr.x + cr.width / 2, cr.y + cr.height / 2)
      fire(chip2, 'mouseup', cr.x + cr.width / 2, cr.y + cr.height / 2)
      await sleep(450)
      out.continuedWithoutReclick = Boolean(document.querySelector('.gugu-anno-editor'))
      const ta4 = document.querySelector('.gugu-anno-editor textarea')
      if (ta4) {
        setTextarea(ta4, '连续标注第二笔')
        await sleep(150)
        Array.from(document.querySelectorAll('.gugu-anno-editor button'))
          .find((b) => b.textContent.trim() === '添加')
          ?.click()
        await sleep(400)
      }
      out.pinsAfterChain = document.querySelectorAll('.gugu-anno-pin').length
      out.pinsBeforeChain = pinsBefore
    }
    // 恢复浏览模式
    btn('浏览')?.click()
    await sleep(200)
  }

  // 7) 工具栏层级：标注记号不能盖住工具栏
  // 前面的流程耗时已经超过 5s，工具栏此时多半已自动收起，先点把手展开
  const handleEarly = document.querySelector('.gugu-anno-handle')
  if (document.querySelector('.gugu-anno-toolbar.collapsed')) {
    out.autoCollapsedBeforeCheck = true
    handleEarly?.click()
    await sleep(450)
  }
  out.pinsBeforeTopCheck = document.querySelectorAll('.gugu-anno-pin').length
  // 工具栏必须整体落在窗口拖动区下方，否则真实鼠标点击会被窗口吞掉
  {
    const tr2 = document.querySelector('.gugu-anno-toolbar').getBoundingClientRect()
    const topbarEl = document.querySelector('.topbar') || document.querySelector('header')
    const dragBottom = topbarEl ? topbarEl.getBoundingClientRect().bottom : 58
    out.dragZoneBottom = Math.round(dragBottom)
    out.toolbarTopY = Math.round(tr2.top)
    out.toolbarBelowDragZone = tr2.top >= dragBottom
  }
  const toolbar = document.querySelector('.gugu-anno-toolbar')
  const firstPin = document.querySelector('.gugu-anno-pin')
  // 层级现在挂在停靠点（dock）上，工具栏自身不再单独设 z-index
  const dockEl = document.querySelector('.gugu-anno-dock')
  out.toolbarZ = dockEl ? Number(getComputedStyle(dockEl).zIndex) || 0 : -1
  out.pinZ = firstPin ? Number(getComputedStyle(firstPin).zIndex) || 0 : -1
  out.toolbarAbovePins = out.toolbarZ > out.pinZ
  out.toolbarHitTest = (() => {
    const r = toolbar.getBoundingClientRect()
    // 在工具栏内取几个点，避开按钮文字，确认没有被标注记号或其它层挡住
    for (const [dx, dy] of [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.2]]) {
      const el = document.elementFromPoint(r.left + r.width * dx, r.top + r.height * dy)
      if (!el || !el.closest('.gugu-anno-toolbar')) {
        out.toolbarBlockedAt = [dx, dy, el ? el.className || el.tagName : 'null']
        return false
      }
    }
    return true
  })()

  // 7.8) 标注清单跟随「显示标注」一起显隐
  {
    btn('浏览')?.click()
    await sleep(250)
    out.panelVisibleBefore = Boolean(document.querySelector('.gugu-anno-panel'))
    btn('隐藏标注')?.click()
    await sleep(350)
    out.panelVisibleWhenPinsHidden = Boolean(document.querySelector('.gugu-anno-panel'))
    btn('显示标注')?.click()
    await sleep(350)
    out.panelVisibleAfter = Boolean(document.querySelector('.gugu-anno-panel'))
  }

  // 8) 说明气泡：点击选项后出现，5s 后消失
  btn('点选')?.click()
  await sleep(250)
  out.hintAfterClick = document.querySelector('.gugu-anno-hint')?.textContent ?? null
  await sleep(5200)
  out.hintAfter5s = document.querySelector('.gugu-anno-hint')?.textContent ?? null

  // 9) 工具栏：可拖动 + 简易/标准形态互切
  {
    const toolbar = document.querySelector('.gugu-anno-toolbar')
    const dock = document.querySelector('.gugu-anno-dock')
    const before = dock.getBoundingClientRect()
    // 从工具栏空白处（左上角内侧）开始拖，避开按钮
    const sx = before.left + 6
    const sy = before.top + before.height / 2
    fire(toolbar, 'mousedown', sx, sy)
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: sx + 180, clientY: sy + 140 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: sx + 180, clientY: sy + 140 }))
    await sleep(300)
    const after = dock.getBoundingClientRect()
    out.dragMovedX = Math.round(after.left - before.left)
    out.dragMovedY = Math.round(after.top - before.top)
    out.dragWorks = Math.abs(out.dragMovedX) > 60 && Math.abs(out.dragMovedY) > 60

    // 试图拖到标题栏里：应被夹在拖动区下方
    fire(toolbar, 'mousedown', after.left + 6, after.top + after.height / 2)
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 2 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 200, clientY: 2 }))
    await sleep(300)
    out.dockTopAfterDragUp = Math.round(dock.getBoundingClientRect().top)
    const topbar = document.querySelector('.topbar')
    out.dragTopClamped = out.dockTopAfterDragUp >= (topbar ? topbar.getBoundingClientRect().bottom : 58)

    // 切到简易工具栏
    Array.from(document.querySelectorAll('.gugu-anno-toolbar button')).find((b) => b.textContent.trim() === '收起')?.click()
    await sleep(350)
    out.compactMode = Boolean(document.querySelector('.gugu-anno-toolbar.compact'))
    out.compactIconCount = document.querySelectorAll('.gugu-anno-toolbar.compact .anno-icon-btn').length
    out.compactHasText = (document.querySelector('.gugu-anno-toolbar.compact')?.textContent || '').trim()

    // 简易工具栏上的图标能切模式
    const iconBtns = Array.from(document.querySelectorAll('.gugu-anno-toolbar.compact .anno-icon-btn'))
    iconBtns[2]?.click()
    await sleep(300)
    out.compactRegionMode = iconBtns[2]?.className.includes('on') === true
    iconBtns[0]?.click()
    await sleep(250)
    out.compactBrowseMode = iconBtns[0]?.className.includes('on') === true

    // 展开回标准
    iconBtns[3]?.click()
    await sleep(350)
    out.expandedBack = !document.querySelector('.gugu-anno-toolbar.compact')
    out.expandedHasText = Boolean(
      Array.from(document.querySelectorAll('.gugu-anno-toolbar button')).find((b) => b.textContent.trim() === '导出标注')
    )
  }
  return out
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

// 插件只在 debug 构建里启用，界面走 devUrl：先起 Vite，再跑应用本体
const vite = await startDevServer()
let output = ''
try {
  const run = await runApp(env, { timeoutMs: 180000 })
  output = run.output
} finally {
  vite.kill()
}

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
  ['框选保存后仍停留在框选模式', result.modeAfterSubmit === '框选'],
  ['标注清单列出两条', result.panelItems === 2],
  ['导出弹窗能打开', result.modalOpen === true],
  ['导出后给出轮次提示', /devlog\/rounds/.test(result.toastAfterExport ?? '')],
  ['生成了轮次目录', rounds.length === 1],
  ['annotations.json 可解析且有 2 条', exported?.annotations?.length === 2],
  ['annotations.md 有内容', markdown.includes('逐条标注')],
  ['整页截图已落盘', shots.includes('00-full.png')],
  ['每条标注都有裁片', shots.filter((f) => /^\d{3}-/.test(f)).length === 2],
  ['运行期无控制台错误', (consoleErrors ?? []).length === 0],
  ['工具栏可以拖动', result.dragWorks === true],
  ['工具栏不会被拖进窗口拖动区', result.dragTopClamped === true],
  ['可以切到简易工具栏', result.compactMode === true],
  ['简易工具栏恰好 4 个图标', result.compactIconCount === 4],
  ['简易工具栏没有文字', result.compactHasText === ''],
  ['简易工具栏的图标能切模式', result.compactRegionMode === true && result.compactBrowseMode === true],
  ['能从简易切回标准工具栏', result.expandedBack === true && result.expandedHasText === true],
  ['工具栏整体位于窗口拖动区下方', result.toolbarBelowDragZone === true],
  ['贴边元素的批注框完整落在视口内', result.editorInViewport === true],
  ['批注框的「添加」按钮点得到', result.addButtonHittable === true],
  ['保存后仍停留在点选模式', result.modeAfterSave === '点选'],
  ['无需重新点模式即可连续标注', result.continuedWithoutReclick === true],
  ['标注清单默认可见', result.panelVisibleBefore === true],
  ['隐藏标注时清单一起隐藏', result.panelVisibleWhenPinsHidden === false],
  ['恢复显示后清单回来', result.panelVisibleAfter === true],
  ['工具栏层级高于标注记号', result.toolbarAbovePins === true],
  ['工具栏中心点命中工具栏本身（未被遮挡）', result.toolbarHitTest === true],
  ['点击选项后出现说明气泡', Boolean(result.hintAfterClick)],
  ['说明气泡 5s 后自动隐藏', result.hintAfter5s === null],
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

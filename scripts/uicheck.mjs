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
import { cp, mkdir, rm } from 'node:fs/promises'
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

const sourceLibrary = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')
const outDir = join(root, 'screenshots', 'uicheck')

if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
  console.error('缺少构建产物，请先 npm run build')
  process.exit(1)
}
await mkdir(outDir, { recursive: true })

/*
 * 在副本上跑：这套用例里有「删除」这种破坏性操作，
 * 直接对着 data/demo 跑会把演示图库一点点吃掉（实测跑了几轮少了 7 条）。
 */
const libraryRoot = join(root, 'data', 'uicheck-lib')
await rm(libraryRoot, { recursive: true, force: true })
await cp(sourceLibrary, libraryRoot, { recursive: true })
console.log(`用例图库副本：${libraryRoot}（源：${sourceLibrary}）`)

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

  // 1.1) 瀑布流几何：同列不重叠、列宽一致、横图真的占到两栏
  {
    const grid = document.querySelector('.grid')
    const cs = grid ? getComputedStyle(grid) : null
    const colW = cs ? cs.gridTemplateColumns.split(' ').map((s) => Math.round(parseFloat(s))) : []
    const cards = grid ? Array.from(grid.querySelectorAll(':scope > .card')) : []
    const areas = []
    for (const c of cards) {
      const m = /^(\\d+) \\/ span (\\d+)$/.exec(c.style.gridColumn)
      const r = /^(\\d+) \\/ span (\\d+)$/.exec(c.style.gridRow)
      if (!m || !r) continue
      areas.push({ col: +m[1], span: +m[2], row: +r[1], rows: +r[2], w: Math.round(c.getBoundingClientRect().width), itemId: c.dataset.itemId, id: c.querySelector('.card-title')?.textContent || '' })
    }
    out.masonryColumns = Number(grid?.dataset.columns)
    out.masonryCards = areas.length
    out.masonryEqualColumns = new Set(colW).size === 1
    out.masonrySpan2 = areas.filter((a) => a.span === 2).length
    out.masonryWidthOk = areas.every((a) => Math.abs(a.w - (colW.slice(a.col - 1, a.col - 1 + a.span).reduce((s, v) => s + v, 0) + 14 * (a.span - 1))) <= 3)
    const perCol = new Map()
    for (const a of areas) for (let c = a.col; c < a.col + a.span; c++) {
      if (!perCol.has(c)) perCol.set(c, [])
      perCol.get(c).push(a)
    }
    let overlap = 0
    for (const list of perCol.values()) {
      list.sort((x, y) => x.row - y.row)
      for (let i = 1; i < list.length; i++) {
        if (list[i].id === list[i - 1].id) continue
        if (list[i].row < list[i - 1].row + list[i - 1].rows) overlap++
      }
    }
    out.masonryOverlaps = overlap
    out.firstScreenVisible = areas.slice(0, 4).every((a) => {
      const el = document.querySelector('.card[data-item-id="' + a.itemId + '"]')
      return el ? Number(getComputedStyle(el).opacity) > 0.5 : false
    })
  }

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
  // 挑一张本地真有文件的卡片（带「仅索引」徽标的就是没下载的）
  const firstCard = qa('.card').find((c) => !c.querySelector('.badge')) || document.querySelector('.card')
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

    // 图片必须完整落在舞台内（竖图的长边曾经跑到屏幕外）
    const stageEl = document.querySelector('.lightbox-stage')
    const imgEl = stageEl ? stageEl.querySelector('img') : null
    if (stageEl && imgEl) {
      const sr = stageEl.getBoundingClientRect()
      const ir = imgEl.getBoundingClientRect()
      out.lightboxFit =
        ir.top >= sr.top - 1 && ir.bottom <= sr.bottom + 1 && ir.left >= sr.left - 1 && ir.right <= sr.right + 1
      out.lightboxFitInfo = {
        stage: [Math.round(sr.width), Math.round(sr.height)],
        img: [Math.round(ir.width), Math.round(ir.height)]
      }
    }

    // 缩放下限应为 25%
    const zoomLabel = () => (document.querySelector('[data-component="Lightbox/Zoom"] .mono') || {}).textContent || ''
    const minusBtn = qa('[data-component="Lightbox/Zoom"] .btn')[0]
    for (let i = 0; i < 24; i += 1) minusBtn?.click()
    await sleep(500)
    out.zoomFloor = zoomLabel().trim()
    out.zoomFloorDisabled = Boolean(minusBtn?.disabled)

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

  // 6.5) 侧栏分类：摊平后只有一层，点一下直接筛选
  {
    const cats = qa('[data-component="Sidebar/Category"]')
    out.categoryCount = cats.length
    out.categoryNames = cats.map((el) => (el.querySelector('.label') || {}).textContent || '')
    out.noNestedTree = qa('.side-item.sub').length === 0
    const first = cats[0]
    if (first) {
      first.click()
      await sleep(1100)
      out.categoryMeta = meta()
      out.categoryActive = first.className.includes('active')
      const reset = byText('.filter-bar .pill', '清空筛选')
      if (reset) { reset.click(); await sleep(900) }
    }
  }

  // 7) 排序切换（排序已从顶栏挪到过滤栏，改成折叠菜单）
  const sortPill = document.querySelector('.sort-picker .pill')
  if (sortPill) {
    sortPill.click()
    await sleep(250)
    out.sortMenuOpen = Boolean(document.querySelector('.sort-menu'))
    const items = Array.from(document.querySelectorAll('.sort-menu .sort-item'))
    const target = items.find((b) => b.textContent.trim() === '浏览量')
    out.sortItemCount = items.length
    target?.click()
    await sleep(1100)
    out.sortValue = (document.querySelector('.sort-picker .pill')?.textContent || '').includes('浏览量')
      ? 'views'
      : 'other'
    out.sortMeta = meta()
  }

  // 7.5) 横向溢出
  {
    const m = document.querySelector('.main')
    out.mainOverflowX = m ? m.scrollWidth - m.clientWidth : -1
  }

  // 7.6) 灯箱沉浸模式与删除/下载按钮（先切到「已下载」，保证打开的是本地有文件的图）
  {
    const dlPill = qa('.filter-bar .pill').find((b) => b.textContent.trim() === '已下载')
    dlPill?.click()
    await sleep(1200)
    out.downloadedCount = qa('.card').length
    const firstCard2 = document.querySelector('.card')
    firstCard2?.click()
    await sleep(1300)
    const lb = document.querySelector('.lightbox')
    const toggle = document.querySelector('.lb-immersive')
    out.immersiveToggle = Boolean(toggle)
    const side = document.querySelector('.lightbox-side')
    const before = side ? getComputedStyle(side).opacity : null
    toggle?.click()
    await sleep(700)
    out.immersiveHidesPanel = lb?.classList.contains('immersive') === true && side ? Number(getComputedStyle(side).opacity) < 0.5 : false
    // 右栏滑走后必须还有别的出口，否则用户退不出沉浸模式
    const exitBtn = document.querySelector('.lb-exit-immersive')
    out.immersiveExitVisible = Boolean(exitBtn)
    if (exitBtn) {
      const er = exitBtn.getBoundingClientRect()
      // 按钮现在只有图标，中心点命中的是 svg，所以要往上找一层
      const hitEl = document.elementFromPoint(er.left + er.width / 2, er.top + er.height / 2)
      out.immersiveExitHittable = Boolean(hitEl && hitEl.closest('.lb-exit-immersive') === exitBtn)
      exitBtn.click()
      await sleep(600)
      out.immersiveExitedByStageBtn = !lb?.classList.contains('immersive')
      toggle?.click()
      await sleep(600)
    }

    // 沉浸模式下切图应当弹出右下角标题条
    {
      const kb = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      out.captionHiddenBefore = !document.querySelector('.lb-caption')
      kb('ArrowRight')
      await sleep(350)
      const cap = document.querySelector('.lb-caption')
      out.captionShown = Boolean(cap)
      out.captionText = cap ? (cap.textContent || '').trim() : null
      // 2s 保持 + 0.6s 滑出，留足余量地轮询等待它自己消失
      for (let i = 0; i < 20; i += 1) {
        if (!document.querySelector('.lb-caption')) break
        await sleep(300)
      }
      out.captionGoneLater = !document.querySelector('.lb-caption')
    }
    out.immersiveOpacityBefore = before
    toggle?.click()
    await sleep(700)

    // 删除两步确认
    const delBtn = document.querySelector('.del-2step')
    out.deleteSteps = '未测'
    out.downloadBtnHiddenWhenReady = !document.querySelector('.dl-btn')
    if (delBtn && !delBtn.disabled) {
      delBtn.click(); await sleep(300)
      const first = (delBtn.textContent || '').trim()
      delBtn.click(); await sleep(400)
      const second = (delBtn.textContent || '').trim()
      out.deleteSteps = (first.includes('确定') ? '确认' : first) + '->' + (second.includes('已删除') ? '已删除' : second)
    } else {
      out.deleteSteps = delBtn ? '按钮被禁用（本地无文件）' : '无删除按钮'
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await sleep(600)
    const clearPill = qa('.filter-bar .pill').find((b) => b.textContent.trim() === '清空筛选')
    clearPill?.click()
    await sleep(900)
  }

  // 7.9) 灯箱打开时禁用窗口拖动；侧栏开合不触发重排动画
  {
    const card = document.querySelector('.card')
    card?.click()
    await sleep(1000)
    const appEl = document.querySelector('.app')
    out.lightboxOpenClass = appEl?.classList.contains('lightbox-open') === true
    const topbarEl = document.querySelector('.topbar')
    out.topbarRegionInLightbox = topbarEl ? getComputedStyle(topbarEl).webkitAppRegion : null
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await sleep(700)
    out.topbarRegionNormal = getComputedStyle(document.querySelector('.topbar')).webkitAppRegion

    // 侧栏开合：不应出现 reflowing
    document.querySelector('.brand-mark')?.click()
    await sleep(70)
    out.reflowOnSidebar = document.querySelector('.main')?.classList.contains('reflowing') === true
    await sleep(500)
    document.querySelector('.brand-mark')?.click()
    await sleep(500)

    // 视图密度切换：应当出现 reflowing
    document.querySelector('.view-toggle')?.click()
    await sleep(70)
    out.reflowOnDensity = document.querySelector('.main')?.classList.contains('reflowing') === true
    await sleep(400)
    document.querySelector('.view-toggle')?.click()
    await sleep(400)
  }

  // 8) 视图密度：合并成了一个按钮
  const denseBtn = document.querySelector('.view-toggle')
  out.viewToggleCount = qa('.view-toggle').length
  if (denseBtn) {
    const before = getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length
    denseBtn.click()
    await sleep(700)
    out.denseColumns = getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length
    out.denseBefore = before
    denseBtn.click()
    await sleep(600)
    out.normalColumnsAfter = getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length
  }

  // 9) 切到设置页并切浅色主题
  const settingsBtn = document.querySelector('.sidebar-foot .side-item[title="设置"]')
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
  ['瀑布流：列宽一致', result.masonryEqualColumns === true],
  ['瀑布流：同列卡片不重叠', result.masonryOverlaps === 0],
  ['瀑布流：卡片宽度与跨栏数一致', result.masonryWidthOk === true],
  ['瀑布流：横图占到两栏', (result.masonrySpan2 ?? 0) > 0],
  ['进场动画不隐藏首屏卡片', result.firstScreenVisible === true],
  ['顶部统计与实际数据一致', /共 [\d,]+ 条/.test(result.initialMeta || '')],
  ['点击标签后筛选条件生效', (result.afterTagChips ?? 0) >= 1],
  ['清空筛选后恢复', (result.afterClearMeta || '').startsWith('共')],
  ['搜索能命中标签', /共 \d+ 条/.test(result.searchMeta || '')],
  ['都能打开灯箱', result.lightboxOpen === true],
  ['灯箱加载了原图', Boolean(result.lightboxImage && result.lightboxImage.w > 0)],
  ['灯箱有元数据面板', (result.lightboxTagCount ?? 0) > 0],
  ['灯箱有缩略图条', (result.lightboxStrip ?? 0) > 0],
  ['灯箱图片完整落在可视区内', result.lightboxFit === true],
  ['灯箱缩放下限为 25%', result.zoomFloor === '25%'],
  ['方向键能翻页', result.arrowChangedImage === true],
  ['Esc 能关闭灯箱', result.lightboxClosed === true],
  ['分类只有一层（无嵌套二级）', result.noNestedTree === true],
  ['分类列表来自应用定义', (result.categoryCount ?? 0) >= 1],
  ['点击分类直接筛选生效', /共 [\d,]+ 条/.test(result.categoryMeta || '')],
  ['排序挪到过滤栏且可展开', result.sortMenuOpen === true && result.sortItemCount === 6],
  ['切换排序生效', result.sortValue === 'views'],
  ['内容页无横向溢出', result.mainOverflowX === 0],
  ['灯箱打开时根节点有 lightbox-open', result.lightboxOpenClass === true],
  ['灯箱打开时顶栏不可拖动窗口', result.topbarRegionInLightbox === 'no-drag'],
  ['关闭灯箱后顶栏恢复可拖动', result.topbarRegionNormal === 'drag'],
  ['侧栏开合不触发重排动画', result.reflowOnSidebar === false],
  ['视图密度切换才触发重排动画', result.reflowOnDensity === true],
  ['灯箱有沉浸模式开关', result.immersiveToggle === true],
  ['沉浸模式能隐藏右栏', result.immersiveHidesPanel === true],
  ['沉浸模式下仍可退出（舞台内有出口）', result.immersiveExitHittable === true],
  ['沉浸模式下切图弹出标题条', result.captionShown === true],
  ['标题条内容取自站点标题', typeof result.captionText === 'string' && result.captionText.length > 0],
  ['标题条保持后自行滑出', result.captionGoneLater === true],
  ['舞台出口能真正退出沉浸模式', result.immersiveExitedByStageBtn === true],
  ['删除按钮有两步确认', result.deleteSteps === '确认->已删除'],
  ['已下载的图不显示下载按钮', result.downloadBtnHiddenWhenReady === true],
  ['视图密度只剩一个按钮', result.viewToggleCount === 1],
  ['标准视图为 4 栏', result.masonryColumns === 4],
  ['紧凑视图为 6 栏', result.denseColumns === 6],
  ['切回标准视图恢复 4 栏', result.normalColumnsAfter === 4],
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

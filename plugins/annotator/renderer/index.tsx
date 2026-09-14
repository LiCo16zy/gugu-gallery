/**
 * 页面标注工具。
 *
 * 用法：
 *   Ctrl+Shift+A 打开/关闭；打开后先处于「浏览」模式（不拦截点击），
 *   正常操作应用翻到你想要的那一屏，再切到「点选」或「框选」写批注，
 *   最后「导出标注」——会在 devlog/rounds/<轮次>/ 下落盘标注原文、逐条截图裁片与说明骨架。
 *
 * 实现要点：
 *  - 拦截用 document 捕获阶段的监听器，而不是铺一层遮罩，
 *    这样可以直接用 e.target 拿到真实元素，也避免遮罩挡住自己的工具栏。
 *  - 位置同时记「视口坐标」和「文档坐标」：前者用于截图裁切，后者保证滚动后标注还在原地。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PluginOverlayProps, PluginTopBarActionProps, RendererPluginModule } from '@shared/plugin'
import {
  CATEGORY_OPTIONS,
  SEVERITY_OPTIONS,
  type Annotation,
  type AnnotationCategory,
  type AnnotationRect,
  type AnnotationSeverity,
  type ExportResult,
  type RoundInfo
} from '@plugins/devlog/shared/types'
import manifestJson from '../plugin.json'
import { describeElement, describeRegion, rectOf } from './inspect'
import './annotator.css'
import './toolbar.css'

const manifest = manifestJson as RendererPluginModule['manifest']
type ToolMode = 'browse' | 'element' | 'region'

/** 说明气泡显示时长 */
const HINT_DURATION = 5000
/**
 * 工具栏能被拖到任意位置，但纵向不能低于这里。
 * 顶栏那一条是窗口拖动区（自绘标题栏的副作用），落在里面的话
 * 真实鼠标点击会被窗口吞掉 —— 上一轮就是栽在这上面，所以直接禁掉。
 */
const TOOLBAR_TOP_SAFE = 60

/** 工具栏位置与形态跨次打开保持 */
let toolbarPosition: { x: number; y: number } | null = null
let compactPreference = false

const MODE_LABEL: Record<ToolMode, string> = { browse: '浏览', element: '点选', region: '框选' }
const MODE_HINT: Record<ToolMode, string> = {
  browse: '浏览模式：正常操作应用，翻到要改的地方后切「点选」或「框选」',
  element: '点选模式：点击任意元素即可写批注（Esc 取消）',
  region: '框选模式：按住左键拖出一个区域写批注（Esc 取消）'
}

/** 把工具栏夹进视口，且不低于窗口拖动区 */
function clampDock(x: number, y: number, compact: boolean): { x: number; y: number } {
  const width = compact ? 196 : 588
  const height = compact ? 44 : 52
  return {
    x: Math.max(4, Math.min(Math.max(4, window.innerWidth - width - 4), x)),
    y: Math.max(TOOLBAR_TOP_SAFE, Math.min(Math.max(TOOLBAR_TOP_SAFE, window.innerHeight - height - 4), y))
  }
}

/* ------------------------------------------------ 简易工具栏上的四个图标 */

/** 浏览：只伸出食指的右手 */
function IconPointHand(): JSX.Element {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.2 11.4V4.6a1.7 1.7 0 0 1 3.4 0v6.8" />
      <path d="M13.6 11.4V9.6a1.7 1.7 0 0 1 3.4 0v1.8" />
      <path d="M17 11.4v-1a1.7 1.7 0 0 1 3.4 0v4.4A6.4 6.4 0 0 1 14 21.2h-2.2A6.4 6.4 0 0 1 5.4 14.8v-3.9a1.7 1.7 0 0 1 3.4 0v.6" />
    </svg>
  )
}

/** 点选：被瞄准的元素 */
function IconPickElement(): JSX.Element {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M12 2.4v2.6M12 19v2.6M2.4 12H5M19 12h2.6" />
    </svg>
  )
}

/** 框选：虚线框住的区域 */
function IconPickRegion(): JSX.Element {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" strokeDasharray="3.2 3.2" />
      <path d="M8.5 12h7" />
    </svg>
  )
}

/** 展开：从简易切回标准工具栏 */
function IconExpandToolbar(): JSX.Element {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5.5 12 11l6-5.5" />
      <path d="M6 12.5 12 18l6-5.5" />
    </svg>
  )
}

interface Draft {
  kind: 'element' | 'region'
  rect: AnnotationRect
  pageRect: AnnotationRect
  scroll: { x: number; y: number }
  target: ReturnType<typeof describeElement>
}

const uid = (): string => Math.random().toString(36).slice(2, 10)

/** 覆盖层：把插件契约的 active / onActiveChange 映射到内部沿用的命名上 */
function AnnotatorOverlay({
  active: enabled,
  onActiveChange: onToggle,
  view,
  appVersion,
  onToast
}: PluginOverlayProps): JSX.Element | null {
  const [mode, setMode] = useState<ToolMode>('browse')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<Annotation | null>(null)
  const [showPins, setShowPins] = useState(true)
  const [hoverRect, setHoverRect] = useState<AnnotationRect | null>(null)
  const [hoverLabel, setHoverLabel] = useState<string>('')
  const [dragRect, setDragRect] = useState<AnnotationRect | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [note, setNote] = useState('')
  const [rounds, setRounds] = useState<RoundInfo[]>([])
  const [scrollTick, setScrollTick] = useState(0)
  /** 简易工具栏（4 个图标）还是标准工具栏 */
  const [compact, setCompact] = useState(compactPreference)
  /** 拖动后的位置；null 表示默认居中 */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(toolbarPosition)
  /** 说明气泡：只在点击选项后显示 5s */
  const [hint, setHint] = useState<string | null>(null)

  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const modeRef = useRef<ToolMode>(mode)
  modeRef.current = mode
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const posRef = useRef<{ x: number; y: number } | null>(toolbarPosition)
  const dragState = useRef<{ dx: number; dy: number } | null>(null)

  /* ------------------------------------------------------ 工具栏自动收起 */


  /** 点击某个选项后弹一句说明，5s 后自动消失 */
  const flashHint = useCallback((text: string) => {
    setHint(text)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), HINT_DURATION)
  }, [])


  const compactRef = useRef(compact)
  compactRef.current = compact

  useEffect(() => {
    if (enabled) return
    if (hintTimer.current) clearTimeout(hintTimer.current)
  }, [enabled])

  const switchCompact = useCallback((next: boolean) => {
    setCompact(next)
    compactPreference = next
    setPos((current) => (current ? clampDock(current.x, current.y, next) : current))
    setHint(next ? '已收起到简易工具栏' : '已展开标准工具栏')
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), HINT_DURATION)
  }, [])

  /** 按住工具栏空白处即可拖动；按钮上不触发，免得点不动 */
  const startToolbarDrag = useCallback((event: React.MouseEvent) => {
    if ((event.target as Element).closest('button')) return
    const el = dockRef.current
    if (!el) return
    event.preventDefault()
    const rect = el.getBoundingClientRect()
    dragState.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }

    const onMove = (e: MouseEvent): void => {
      const d = dragState.current
      if (!d) return
      const next = clampDock(e.clientX - d.dx, e.clientY - d.dy, compactRef.current)
      setPos(next)
      posRef.current = next
    }
    const onUp = (): void => {
      dragState.current = null
      toolbarPosition = posRef.current
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('dragging-tool')
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.classList.add('dragging-tool')
  }, [])

  /* ---------------------------------------------------------- 快捷键与滚动 */

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        onToggle(!enabled)
      } else if (e.key === 'Escape' && enabled) {
        setDraft(null)
        setEditing(null)
        setExportOpen(false)
        setDragRect(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onToggle])

  // 位置需要在滚动/缩放后重算
  useEffect(() => {
    if (!enabled) return
    const bump = (): void => setScrollTick((t) => t + 1)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    return () => {
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('resize', bump)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    setMode('browse')
    // 顺手读一下历史轮次，导出时可以提示进度
    void (async () => {
      try {
        const list = await window.gugu?.plugins.invoke<RoundInfo[]>('devlog', 'listRounds')
        setRounds(list ?? [])
      } catch {
        setRounds([])
      }
    })()
  }, [enabled])

  /* ------------------------------------------------------------ 事件拦截 */

  useEffect(() => {
    if (!enabled) return

    const inTool = (target: EventTarget | null): boolean =>
      target instanceof Element && Boolean(target.closest('.gugu-anno-root'))

    const toRect = (a: { x: number; y: number }, b: { x: number; y: number }): AnnotationRect => ({
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y)
    })

    const onMouseMove = (e: MouseEvent): void => {
      if (inTool(e.target)) return
      const current = modeRef.current
      if (current === 'browse') {
        if (hoverRect) setHoverRect(null)
        return
      }
      if (dragStart.current && current === 'region') {
        setDragRect(toRect(dragStart.current, { x: e.clientX, y: e.clientY }))
        return
      }
      if (e.target instanceof Element) {
        const rect = rectOf(e.target)
        setHoverRect(rect)
        const tag = e.target.tagName.toLowerCase()
        const cls = [...e.target.classList].slice(0, 2).join('.')
        const comp = e.target.closest('[data-component]')?.getAttribute('data-component')
        setHoverLabel(comp ? `${comp} · ${tag}${cls ? `.${cls}` : ''}` : `${tag}${cls ? `.${cls}` : ''}`)
      }
    }

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      if (inTool(e.target)) return
      if (modeRef.current === 'browse') return
      e.preventDefault()
      e.stopPropagation()
      dragStart.current = { x: e.clientX, y: e.clientY }
      setHoverRect(null)
    }

    const onMouseUp = (e: MouseEvent): void => {
      if (inTool(e.target)) return
      if (modeRef.current === 'browse') return
      e.preventDefault()
      e.stopPropagation()

      const start = dragStart.current
      dragStart.current = null
      if (!start) return

      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      const scroll = { x: window.scrollX, y: window.scrollY }

      if (modeRef.current === 'region' || moved > 8) {
        const rect = toRect(start, { x: e.clientX, y: e.clientY })
        if (rect.width < 6 || rect.height < 6) {
          setDragRect(null)
          return
        }
        const viewport = { width: window.innerWidth, height: window.innerHeight }
        setDragRect(null)
        setDraft({
          kind: 'region',
          rect,
          pageRect: { ...rect, x: rect.x + scroll.x, y: rect.y + scroll.y },
          scroll,
          target: describeRegion(rect, viewport)
        })
        return
      }

      if (e.target instanceof Element) {
        const rect = rectOf(e.target)
        setDraft({
          kind: 'element',
          rect,
          pageRect: { ...rect, x: rect.x + scroll.x, y: rect.y + scroll.y },
          scroll,
          target: describeElement(e.target)
        })
      }
    }

    const onClick = (e: MouseEvent): void => {
      if (inTool(e.target)) return
      if (modeRef.current === 'browse') return
      // 点选模式下必须吃掉点击，否则会顺带触发应用自身的交互
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onClick, true)
    return () => {
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('mouseup', onMouseUp, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onClick, true)
    }
  }, [enabled, hoverRect])

  /* ------------------------------------------------------------ 标注增删改 */

  const commitDraft = useCallback(
    (comment: string, category: AnnotationCategory, severity: AnnotationSeverity) => {
      if (!draft) return
      setAnnotations((prev) => [
        ...prev,
        {
          id: uid(),
          index: prev.length + 1,
          comment,
          category,
          severity,
          kind: draft.kind,
          createdAt: Date.now(),
          rect: draft.rect,
          pageRect: draft.pageRect,
          scroll: draft.scroll,
          target: draft.target,
          viewport: { width: window.innerWidth, height: window.innerHeight }
        }
      ])
      setDraft(null)
      // 刻意不回到浏览模式：连续标注时不该每次都重新点一遍「点选 / 框选」
      setMode((current) => (current === 'browse' ? 'browse' : current))
    },
    [draft]
  )

  const updateAnnotation = useCallback((id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    setEditing(null)
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id).map((a, i) => ({ ...a, index: i + 1 })))
    setEditing(null)
  }, [])

  /* ---------------------------------------------------------------- 导出 */

  const doExport = useCallback(async () => {
    if (annotations.length === 0) {
      onToast('还没有任何标注')
      return
    }
    if (!window.gugu?.plugins) {
      onToast('导出能力不可用：devlog 插件未加载')
      return
    }
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    // 导出时按当前滚动位置换算回视口坐标，保证截图裁切对齐
    const payload = {
      view,
      note,
      appVersion,
      devicePixelRatio: window.devicePixelRatio || 1,
      annotations: annotations.map((a) => ({
        ...a,
        rect: {
          ...a.rect,
          x: a.pageRect.x - scrollX,
          y: a.pageRect.y - scrollY
        }
      }))
    }
    try {
      const result = await window.gugu.plugins.invoke<ExportResult>('devlog', 'exportAnnotations', payload)
      setExportOpen(false)
      setNote('')
      onToast(`已导出到 devlog/rounds/${result.roundId}/`)
      const list = await window.gugu.plugins.invoke<RoundInfo[]>('devlog', 'listRounds')
      setRounds(list ?? [])
    } catch (err) {
      onToast(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [annotations, view, note, appVersion, onToast])

  /* ------------------------------------------------------------ 位置换算 */

  const viewportRectOf = useCallback(
    (a: Annotation): AnnotationRect => {
      void scrollTick
      return { ...a.rect, x: a.pageRect.x - window.scrollX, y: a.pageRect.y - window.scrollY }
    },
    [scrollTick]
  )

  const overlayRects = useMemo(() => {
    if (!showPins) return []
    return annotations.map((a) => ({ anno: a, rect: viewportRectOf(a) }))
  }, [annotations, showPins, viewportRectOf])

  if (!enabled) return null

  const pendingCount = annotations.length

  return (
    <div className="gugu-anno-root">
      {/* ------------------------------------------------------------ 工具栏 */}
      <div
        ref={dockRef}
        className={'gugu-anno-dock' + (pos ? ' placed' : '') + (compact ? ' compact-mode' : '')}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
      >
        {compact ? (
          /* 简易工具栏：只有 4 个图标，无文字 */
          <div className="gugu-anno-toolbar compact" onMouseDown={startToolbarDrag} title="按住空白处可拖动">
            <span className="gugu-anno-grip" aria-hidden />
            <button
              className={'anno-icon-btn' + (mode === 'browse' ? ' on' : '')}
              title="浏览：不拦截点击，正常使用应用"
              aria-label="浏览"
              onClick={() => {
                setMode('browse')
                setDraft(null)
                flashHint(MODE_HINT.browse)
              }}
            >
              <IconPointHand />
            </button>
            <button
              className={'anno-icon-btn' + (mode === 'element' ? ' on' : '')}
              title="点选元素"
              aria-label="点选元素"
              onClick={() => {
                setMode('element')
                setDraft(null)
                flashHint(MODE_HINT.element)
              }}
            >
              <IconPickElement />
            </button>
            <button
              className={'anno-icon-btn' + (mode === 'region' ? ' on' : '')}
              title="框选区域"
              aria-label="框选区域"
              onClick={() => {
                setMode('region')
                setDraft(null)
                flashHint(MODE_HINT.region)
              }}
            >
              <IconPickRegion />
            </button>
            <button
              className="anno-icon-btn"
              title="展开标准工具栏"
              aria-label="展开标准工具栏"
              onClick={() => switchCompact(false)}
            >
              <IconExpandToolbar />
            </button>
          </div>
        ) : (
          <div className="gugu-anno-toolbar" onMouseDown={startToolbarDrag} title="按住空白处可拖动">
            <span className="gugu-anno-grip" aria-hidden />
            <span className="gugu-anno-brand">
              <b>标注模式</b>
              <em>{pendingCount} 条</em>
            </span>

            <div className="gugu-anno-seg">
              {(['browse', 'element', 'region'] as ToolMode[]).map((value) => (
                <button
                  key={value}
                  className={mode === value ? 'on' : ''}
                  onClick={() => {
                    setMode(value)
                    setDraft(null)
                    flashHint(MODE_HINT[value])
                  }}
                  title={value === 'browse' ? '不拦截点击，正常使用应用' : '点击 / 拖拽即可添加标注'}
                >
                  {MODE_LABEL[value]}
                </button>
              ))}
            </div>

            <button
              className={'gugu-anno-btn' + (showPins ? ' on' : '')}
              onClick={() => {
                const next = !showPins
                setShowPins(next)
                flashHint(next ? '已显示标注记号' : '已隐藏标注记号')
              }}
            >
              {showPins ? '隐藏标注' : '显示标注'}
            </button>
            <button className="gugu-anno-btn primary" onClick={() => setExportOpen(true)} disabled={pendingCount === 0}>
              导出标注
            </button>
            <button
              className="gugu-anno-btn danger"
              onClick={() => {
                if (pendingCount > 0 && !window.confirm('放弃 ' + pendingCount + ' 条未导出的标注？')) return
                setAnnotations([])
                setDraft(null)
                flashHint('已清空未导出的标注')
              }}
              disabled={pendingCount === 0 && !draft}
            >
              清空
            </button>
            <button className="gugu-anno-btn" onClick={() => onToggle(false)} title="退出标注（Ctrl+Shift+A）">
              退出
            </button>
            <button className="gugu-anno-btn ghost" onClick={() => switchCompact(true)} title="收起到简易工具栏">
              收起
            </button>
          </div>
        )}

        {hint && <div className="gugu-anno-hint">{hint}</div>}
      </div>

      {/* ------------------------------------------------------------ 高亮 */}
      {hoverRect && mode !== 'browse' && (
        <div
          className="gugu-anno-hover"
          style={{
            left: hoverRect.x,
            top: hoverRect.y,
            width: hoverRect.width,
            height: hoverRect.height
          }}
        >
          <span className="gugu-anno-hover-label">{hoverLabel}</span>
        </div>
      )}

      {dragRect && (
        <div
          className="gugu-anno-drag"
          style={{ left: dragRect.x, top: dragRect.y, width: dragRect.width, height: dragRect.height }}
        />
      )}

      {/* ------------------------------------------------------------ 已有标注 */}
      {overlayRects.map(({ anno, rect }) => (
        <div
          key={anno.id}
          className={`gugu-anno-pin gugu-anno-${anno.category}`}
          style={{ left: rect.x, top: rect.y, width: Math.max(rect.width, 8), height: Math.max(rect.height, 8) }}
          onClick={(e) => {
            e.stopPropagation()
            setEditing(anno)
            setMode('browse')
          }}
          title={anno.comment}
        >
          <span className="gugu-anno-index">{anno.index}</span>
        </div>
      ))}

      {/* ------------------------------------------------------------ 批注编辑 */}
      {(draft || editing) && (
        <CommentEditor
          draft={draft}
          editing={editing}
          onCancel={() => {
            setDraft(null)
            setEditing(null)
          }}
          onSave={commitDraft}
          onUpdate={updateAnnotation}
          onDelete={removeAnnotation}
        />
      )}

      {/* ------------------------------------------------------------ 标注列表 */}
      {/* 清单与标注记号同生共死：隐藏标注时清单也一起收起来 */}
      {showPins && annotations.length > 0 && (
        <div className="gugu-anno-panel">
          <div className="gugu-anno-panel-head">
            <b>标注清单</b>
            <span>{annotations.length} 条</span>
          </div>
          <div className="gugu-anno-panel-list">
            {annotations.map((a) => (
              <button
                key={a.id}
                className="gugu-anno-item"
                onClick={() => {
                  window.scrollTo({ top: Math.max(0, a.pageRect.y - window.innerHeight / 2), behavior: 'smooth' })
                  setEditing(a)
                }}
              >
                <span className={`gugu-anno-dot gugu-anno-${a.category}`}>{a.index}</span>
                <span className="gugu-anno-item-body">
                  <span className="gugu-anno-item-title">{a.comment.split('\n')[0] || '(无标题)'}</span>
                  <span className="gugu-anno-item-meta">
                    {CATEGORY_OPTIONS.find((c) => c.value === a.category)?.label} ·{' '}
                    {SEVERITY_OPTIONS.find((s) => s.value === a.severity)?.label}
                    {a.target.component ? ` · ${a.target.component}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ 导出确认 */}
      {exportOpen && (
        <div className="gugu-anno-modal-mask" onClick={() => setExportOpen(false)}>
          <div className="gugu-anno-modal" onClick={(e) => e.stopPropagation()}>
            <h3>导出本轮标注</h3>
            <p>
              将写入 <code>devlog/rounds/&lt;轮次&gt;/</code>
              ：<code>annotations.md</code>、<code>annotations.json</code>、整页截图与每条标注的裁片。
            </p>
            <label>总体说明（可选）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="这一轮整体想达到什么效果？有什么取舍上的要求？"
              rows={4}
            />
            <div className="gugu-anno-modal-meta">
              共 {pendingCount} 条 · 当前界面 {view} · 已有 {rounds.length} 个历史轮次
            </div>
            <div className="gugu-anno-modal-actions">
              <button className="gugu-anno-btn" onClick={() => setExportOpen(false)}>
                取消
              </button>
              <button className="gugu-anno-btn primary" onClick={() => void doExport()}>
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- 批注编辑框 */

function CommentEditor({
  draft,
  editing,
  onCancel,
  onSave,
  onUpdate,
  onDelete
}: {
  draft: Draft | null
  editing: Annotation | null
  onCancel: () => void
  onSave: (comment: string, category: AnnotationCategory, severity: AnnotationSeverity) => void
  onUpdate: (id: string, patch: Partial<Annotation>) => void
  onDelete: (id: string) => void
}): JSX.Element {
  const [text, setText] = useState(editing?.comment ?? '')
  const [category, setCategory] = useState<AnnotationCategory>(editing?.category ?? 'style')
  const [severity, setSeverity] = useState<AnnotationSeverity>(editing?.severity ?? 'should')
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const target = editing?.target ?? draft?.target ?? null
  const rect = editing?.rect ?? draft?.rect ?? null

  /**
   * 批注框不能跑到视口外面 —— 之前是按「面板高 300px」硬算的，
   * 内容一多（标签长、批注长）就会把「添加」按钮顶到屏幕外点不到。
   * 改成先渲染再量实际尺寸，然后：优先贴在标注框下方，下方放不下就翻到上方，
   * 最后统一夹进视口内。
   */
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const place = (): void => {
      const width = el.offsetWidth || 360
      const height = el.offsetHeight || 260
      const margin = 12
      const gap = 10
      if (!rect) {
        setPos({ left: margin, top: 78 })
        return
      }
      let top = rect.y + rect.height + gap
      if (top + height > window.innerHeight - margin) {
        const above = rect.y - gap - height
        top = above >= margin ? above : window.innerHeight - height - margin
      }
      let left = rect.x
      if (left + width > window.innerWidth - margin) left = rect.x + rect.width - width
      left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin))
      top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin))
      setPos({ left, top })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(el)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [rect])

  // 还没量出尺寸前先藏在屏幕外，避免闪一下再跳位
  const style: React.CSSProperties = pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }

  const submit = (): void => {
    const comment = text.trim()
    if (!comment) return
    if (editing) onUpdate(editing.id, { comment, category, severity })
    else onSave(comment, category, severity)
  }

  return (
    <div ref={boxRef} className="gugu-anno-editor" style={style}>
      <div className="gugu-anno-editor-head">
        {editing ? `编辑标注 #${editing.index}` : draft?.kind === 'region' ? '新增区域标注' : '新增元素标注'}
        <button className="gugu-anno-x" onClick={onCancel} title="取消 (Esc)">
          ×
        </button>
      </div>

      {target && (
        <div className="gugu-anno-target">
          {target.component && (
            <div>
              <span>组件</span>
              <code>{target.component}</code>
            </div>
          )}
          <div>
            <span>选择器</span>
            <code>{target.selector}</code>
          </div>
          {target.text && (
            <div>
              <span>文本</span>
              <em>{target.text.slice(0, 80)}</em>
            </div>
          )}
        </div>
      )}

      <textarea
        ref={ref}
        value={text}
        rows={4}
        placeholder="想怎么改？例如：卡片标题字号偏小，希望提到 13px 并加粗；间距从 3px 调到 6px"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            submit()
          }
        }}
      />

      <div className="gugu-anno-editor-row">
        <select value={category} onChange={(e) => setCategory(e.target.value as AnnotationCategory)}>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as AnnotationSeverity)}>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="gugu-anno-editor-actions">
        {editing && (
          <button className="gugu-anno-btn danger" onClick={() => onDelete(editing.id)}>
            删除
          </button>
        )}
        <span className="gugu-anno-spacer" />
        <button className="gugu-anno-btn" onClick={onCancel}>
          取消
        </button>
        <button className="gugu-anno-btn primary" onClick={submit} disabled={!text.trim()}>
          {editing ? '保存' : '添加'}
        </button>
      </div>
      <div className="gugu-anno-editor-tip">Ctrl+Enter 快速提交</div>
    </div>
  )
}

/* --------------------------------------------------------------- 插件导出 */

/** 顶栏入口图标：内联 SVG，插件不依赖应用的图标组件 */
function MarkerIcon(): JSX.Element {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16" />
      <path d="M14.5 3.5 20 9l-9.5 9.5H5v-5.5z" />
      <path d="M12.5 5.5 18 11" />
    </svg>
  )
}

function AnnotatorTopBarAction({ active, toggle }: PluginTopBarActionProps): JSX.Element {
  return (
    <button
      data-component="annotator/TopBarAction"
      className={`btn icon ghost${active ? ' annotate-on' : ''}`}
      title="页面标注工具（Ctrl+Shift+A）"
      onClick={toggle}
    >
      <MarkerIcon />
    </button>
  )
}

const annotatorPlugin: RendererPluginModule = {
  manifest,
  TopBarAction: AnnotatorTopBarAction,
  Overlay: AnnotatorOverlay
}

export default annotatorPlugin

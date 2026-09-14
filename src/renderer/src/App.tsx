import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppInfo,
  AppSettings,
  CrawlLogLine,
  CrawlProgress,
  Facet,
  GalleryQuery,
  PlateFacet,
  ItemSummary,
  LibraryStats,
  Orientation,
  SortKey
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { api, formatBytes, formatSpeed } from './api'
import Sidebar from './components/Sidebar'
import GalleryGrid from './components/GalleryGrid'
import Lightbox from './components/Lightbox'
import CrawlPanel from './components/CrawlPanel'
import SettingsPanel from './components/SettingsPanel'
import ContextMenu, { type MenuEntry } from './components/ContextMenu'
import Toast, { type ToastPayload } from './components/Toast'
import { IconCopy, IconExternal, IconFolder, IconHeart } from './components/Icons'
import { loadedPlugins } from './plugins'
import {
  IconArrowUp,
  IconClose,
  IconSearch,
  IconSidebar,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore
} from './components/Icons'

export type View = 'gallery' | 'crawl' | 'settings'

export interface Filters {
  text: string
  plate: string | null
  word: string | null
  tags: string[]
  tagMode: 'any' | 'all'
  favorite: boolean
  downloaded: 'any' | 'only' | 'never'
  sort: SortKey
  orientation: Orientation
  minWidth: number
}

const INITIAL_FILTERS: Filters = {
  text: '',
  plate: null,
  word: null,
  tags: [],
  tagMode: 'any',
  favorite: false,
  downloaded: 'any',
  sort: 'newest',
  orientation: 'any',
  minWidth: 0
}

/** 主题：dark / light / system，system 跟随操作系统配色 */
function applyTheme(theme: 'dark' | 'light' | 'system'): void {
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  const resolved = theme === 'system' ? (prefersLight ? 'light' : 'dark') : theme
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themeMode = theme
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: '最新发布' },
  { value: 'oldest', label: '最早上传' },
  { value: 'views', label: '浏览量' },
  { value: 'size', label: '文件体积' },
  { value: 'title', label: '标题' },
  { value: 'random', label: '随机' }
]

const SORT_LABEL: Record<SortKey, string> = SORT_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<SortKey, string>
)

/** 视图密度按钮：标准=一个竖长方形，紧凑=两个。切换时图标交叉渐隐 */
function IconViewToggle({ dense }: { dense: boolean }): JSX.Element {
  // 空心长方体：标准视图 12×16，紧凑视图两个 8×16、间隔 4
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      {dense ? (
        <>
          <rect x={0} y={2} width={8} height={16} rx={1.6} />
          <rect x={12} y={2} width={8} height={16} rx={1.6} />
        </>
      ) : (
        <rect x={4} y={2} width={12} height={16} rx={1.8} />
      )}
    </svg>
  )
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [plates, setPlates] = useState<PlateFacet[]>([])
  const [topTags, setTopTags] = useState<Facet[]>([])

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [debouncedText, setDebouncedText] = useState('')
  const [items, setItems] = useState<ItemSummary[]>([])
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dense, setDense] = useState(false)

  const [view, setView] = useState<View>('gallery')
  const [openId, setOpenId] = useState<number | null>(null)

  /** 当前展开的工具插件 id；插件全部关闭时这里恒为 null */
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  const [logs, setLogs] = useState<CrawlLogLine[]>([])
  const [toast, setToast] = useState<ToastPayload | null>(null)
  /** 右键菜单：卡片 + 弹出位置 */
  const [contextMenu, setContextMenu] = useState<{ item: ItemSummary; x: number; y: number } | null>(null)
  /** 自绘标题栏：最大化状态与窗口按钮联动 */
  const [maximized, setMaximized] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  /** 侧栏开合 / 密度切换时给内容页加一层「变暗 -> 重排 -> 变亮」的过渡 */
  const [reflowing, setReflowing] = useState(false)
  /** 品牌图标允许被外部图标覆盖，取不到就退回默认的「咕」字 */
  const [appIconOk, setAppIconOk] = useState(true)
  /** 侧栏宽度：拖动时走本地状态，松手才落盘 */
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SETTINGS.sidebarWidth)
  /** 向下滚动时把过滤栏藏起来 */
  const [barHidden, setBarHidden] = useState(false)
  /** 向上滚动且已经离开首屏时，右下角出现回到顶部 */
  const [showToTop, setShowToTop] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  const lastScrollTop = useRef(0)
  const reflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastSeq = useRef(0)
  const requestId = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  /* ---------------------------------------------------------------- 初始化 */

  useEffect(() => {
    void (async () => {
      const [s, i] = await Promise.all([api.settings.get(), api.appInfo()])
      setSettings(s)
      setInfo(i)
      applyTheme(s.theme)
      document.documentElement.style.setProperty('--accent', s.accent)
    })()
  }, [])

  // 「跟随系统」要跟着系统配色实时变
  useEffect(() => {
    if (settings.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [settings.theme])

  const refreshMeta = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([api.library.stats(), api.library.facets()])
      setStats(s)
      setPlates(f.plates)
      setTopTags(f.topTags)
    } catch {
      /* 图库目录刚切换时可能短暂读不到，忽略 */
    }
  }, [])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  /* ---------------------------------------------------------- 渐进式加载 */

  const pageSize = Math.max(20, Math.min(200, settings.pageSize || 60))

  const buildQuery = useCallback(
    (cursorValue: string | null): GalleryQuery => ({
      text: debouncedText,
      plate: filters.plate,
      word: filters.word,
      tags: filters.tags,
      tagMode: filters.tagMode,
      favorite: filters.favorite,
      downloaded: filters.downloaded,
      orientation: filters.orientation,
      sort: filters.sort,
      minWidth: filters.minWidth > 0 ? filters.minWidth : undefined,
      cursor: cursorValue,
      limit: pageSize
    }),
    [debouncedText, filters, pageSize]
  )

  const loadPage = useCallback(
    async (mode: 'reset' | 'append') => {
      const id = ++requestId.current
      setLoading(true)
      try {
        const page = await api.library.query(buildQuery(mode === 'append' ? cursor : null))
        if (id !== requestId.current) return
        setItems((prev) => (mode === 'append' ? [...prev, ...page.items] : page.items))
        setCursor(page.nextCursor)
        setTotal(page.total)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [buildQuery, cursor]
  )

  // 文本输入防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(filters.text), 260)
    return () => clearTimeout(timer)
  }, [filters.text])

  // 条件变化 -> 回到第一页
  useEffect(() => {
    setCursor(null)
    void loadPage('reset')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText, filters.plate, filters.word, filters.tags, filters.tagMode, filters.favorite, filters.downloaded, filters.sort, filters.orientation, filters.minWidth])

  // 滚动到底自动追加
  /**
   * 滚动时：向下藏过滤栏（给内容让位），向上立刻唤回。
   * 同时负责触底追加下一页。
   */
  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget
      const top = el.scrollTop
      const delta = top - lastScrollTop.current
      if (Math.abs(delta) > 6) {
        const down = delta > 0
        setBarHidden(down && top > 96)
        // 首屏都看不见了、并且正在往上滑，才给回到顶部
        setShowToTop(!down && top > 320)
        lastScrollTop.current = top
      }
      if (!loading && cursor && el.scrollHeight - top - el.clientHeight < 900) void loadPage('append')
    },
    [cursor, loading, loadPage]
  )

  /* ------------------------------------------------------------- 抓取进度 */

  useEffect(() => {
    void api.crawl.progress().then((p) => p && setProgress(p))
    const off = api.crawl.onProgress(({ progress: p, logs: newLogs }) => {
      setProgress(p)
      if (newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs].slice(-400))
      }
      if (p.phase === 'done' || p.phase === 'cancelled' || p.phase === 'failed') {
        void refreshMeta()
      }
    })
    return off
  }, [refreshMeta])

  // 截图自检模式通过自定义事件切换视图
  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<string>).detail
      if (detail === 'crawl' || detail === 'settings' || detail === 'gallery') setView(detail)
      if (detail === 'lightbox' && items.length > 0) setOpenId(items[0].id)
    }
    window.addEventListener('gugu:navigate', handler)
    return () => window.removeEventListener('gugu:navigate', handler)
  }, [items])

  useEffect(() => {
    setSidebarWidth(settings.sidebarWidth || DEFAULT_SETTINGS.sidebarWidth)
  }, [settings.sidebarWidth])

  // 排序菜单点空白处关闭
  useEffect(() => {
    if (!sortOpen) return
    const onDown = (e: MouseEvent): void => {
      if (!(e.target as Element).closest('.sort-picker')) setSortOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [sortOpen])

  // 自绘标题栏要跟着窗口状态走（比如用户双击标题栏最大化）
  useEffect(() => {
    void api.window.state().then((s) => setMaximized(s.maximized))
  }, [])

  /** 轻提示：同一时刻只留一条，重复触发会重播动画 */
  const showToast = useCallback((text: string, duration = 1600, kind: ToastPayload['kind'] = 'info') => {
    toastSeq.current += 1
    setToast({ id: toastSeq.current, text, duration, kind })
  }, [])

  /* ---------------------------------------------------------------- 交互 */

  /**
   * 筛选条件的唯一入口。规则只有两条，但必须双向成立：
   *   1. 「待下载」与其它所有筛选项互斥 —— 选中它会清掉别的，选中别的也会把它清掉
   *   2. 「已下载」只与「待下载」互斥（可以叠加收藏、横竖图、标签）
   * 互斥单向做的话会出现「点 A 清了 B，再点 B 却清不掉 A」这种自相矛盾的状态。
   */
  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      // 换分类时必须清掉二级分类，否则会留下跨分类的无效条件
      if (patch.plate !== undefined) next.word = null

      if (patch.downloaded === 'never') {
        next.favorite = false
        next.orientation = 'any'
        next.minWidth = 0
        next.plate = null
        next.word = null
        next.tags = []
      } else {
        const turnedOnOther =
          patch.favorite === true ||
          (patch.orientation !== undefined && patch.orientation !== 'any') ||
          (patch.minWidth !== undefined && patch.minWidth > 0) ||
          (patch.tags !== undefined && patch.tags.length > 0) ||
          (patch.plate !== undefined && patch.plate !== null)
        if (turnedOnOther && prev.downloaded === 'never') next.downloaded = 'any'
      }
      return next
    })
  }, [])

  /** 「全部」的判定要把构图与尺寸条件也算进去，否则选了横图还显示「全部」高亮 */
  const isAllScope =
    filters.downloaded === 'any' &&
    !filters.favorite &&
    !filters.plate &&
    filters.tags.length === 0 &&
    filters.orientation === 'any' &&
    filters.minWidth === 0

  const quickFavorite = useCallback(async (item: ItemSummary) => {
    const value = await api.library.favorite(item.id, !item.favorite)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, favorite: value } : i)))
  }, [])

  const toggleTag = useCallback((name: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(name) ? prev.tags.filter((t) => t !== name) : [...prev.tags, name]
    }))
  }, [])

  const onSettingsChange = useCallback(
    async (patch: Partial<AppSettings>, opts?: { silent?: boolean }) => {
      const next = await api.settings.set(patch)
      setSettings(next)
      if (patch.theme) applyTheme(next.theme)
      if (patch.accent) document.documentElement.style.setProperty('--accent', next.accent)
      if (patch.libraryRoot) {
        setFilters(INITIAL_FILTERS)
        setItems([])
        setCursor(null)
        await refreshMeta()
        await loadPage('reset')
      }
      if (!opts?.silent) showToast('设置已保存', 1600, 'success')
    },
    [refreshMeta, loadPage]
  )

  const triggerReflow = useCallback(() => {
    setReflowing(false)
    // 先摘掉再挂上，保证连续切换也能重播动画
    requestAnimationFrame(() => {
      setReflowing(true)
      if (reflowTimer.current) clearTimeout(reflowTimer.current)
      reflowTimer.current = setTimeout(() => setReflowing(false), 180)
    })
  }, [])

  /** 拖动侧栏右边缘调宽，上限为窗口宽度的 40%（依赖 onSettingsChange，故定义在其后） */
  const startSidebarResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    let latest = startWidth
    const maxWidth = (): number => Math.round(window.innerWidth * 0.4)

    const onMove = (e: MouseEvent): void => {
      latest = Math.max(180, Math.min(maxWidth(), startWidth + (e.clientX - startX)))
      setSidebarWidth(latest)
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.classList.remove('resizing')
      void onSettingsChange({ sidebarWidth: latest }, { silent: true })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.classList.add('resizing')
  }

  const activeChipCount = useMemo(() => {
    let n = 0
    if (filters.plate) n += 1
    if (filters.word) n += 1
    n += filters.tags.length
    if (filters.favorite) n += 1
    if (filters.downloaded !== 'any') n += 1
    if (filters.orientation !== 'any') n += 1
    if (filters.minWidth > 0) n += 1
    return n
  }, [filters])

  const jobActive =
    progress != null && !['done', 'cancelled', 'failed'].includes(progress.phase)

  /* 右键菜单项：收藏 / 复制 pid / 打开于…（折叠子项） */
  const contextEntries: MenuEntry[] = contextMenu
    ? [
        {
          key: 'fav',
          label: contextMenu.item.favorite ? '取消收藏' : '收藏',
          icon: <IconHeart width={13} height={13} filled={contextMenu.item.favorite} />,
          onSelect: () => void quickFavorite(contextMenu.item)
        },
        {
          key: 'copy',
          label: '复制 pid',
          icon: <IconCopy width={13} height={13} />,
          disabled: !contextMenu.item.pixivId,
          onSelect: () => {
            const pid = contextMenu.item.pixivId
            if (!pid) return
            void api.copyText(pid).then(() => showToast('已复制 pid', 800))
          }
        },
        {
          key: 'open',
          label: '打开于…',
          icon: <IconExternal width={13} height={13} />,
          children: [
            {
              key: 'folder',
              label: '文件管理器',
              icon: <IconFolder width={13} height={13} />,
              disabled: contextMenu.item.fileStatus !== 'ready',
              onSelect: () => {
                void api.library.reveal(contextMenu.item.id).then((ok) => {
                  if (!ok) showToast('本地还没有这张图')
                })
              }
            },
            {
              key: 'pixiv',
              label: 'Pixiv',
              icon: <IconExternal width={13} height={13} />,
              disabled: !contextMenu.item.pixivId,
              onSelect: () => {
                const pid = contextMenu.item.pixivId
                if (pid) void api.openExternal('https://www.pixiv.net/artworks/' + pid)
              }
            }
          ]
        }
      ]
    : []

  return (
    <div
      className={`app${settings.sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
      style={{
        // 收起时交给 .sidebar-collapsed 的 64px。
        // 之前无条件写内联值，内联优先级更高，侧栏就永远收不起来了。
        ['--sidebar-w' as string]: (settings.sidebarCollapsed ? 64 : sidebarWidth) + 'px'
      }}
    >
      <div className="brand" data-component="App/Brand">
        {/* 品牌区同时是侧栏开关：鼠标移上去图标渐变为「展开/收起侧栏」 */}
        <button
          className="brand-mark"
          onClick={() => {
            triggerReflow()
            void onSettingsChange({ sidebarCollapsed: !settings.sidebarCollapsed }, { silent: true })
          }}
          title={settings.sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        >
          <span className="brand-logo">{appIconOk ? <img src="./app-icon.png" alt="" onError={() => setAppIconOk(false)} /> : '咕'}</span>
          <span className="brand-toggle">
            <IconSidebar />
          </span>
        </button>
        {!settings.sidebarCollapsed && (
          <div className="brand-text">
            <span className="brand-title">咕咕图库</span>
            <span className="brand-sub">来自 gugu 小站的爱~</span>
          </div>
        )}
      </div>

      <header className="topbar" data-component="App/TopBar">
        <button
          className="view-toggle"
          onClick={() => {
            triggerReflow()
            setDense((v) => !v)
          }}
          title={dense ? '切换到标准视图' : '切换到紧凑视图'}
        >
          <IconViewToggle dense={dense} />
        </button>

        <div className="search">
          <IconSearch />
          <input
            placeholder="搜索标题、标签、Pixiv ID…"
            value={filters.text}
            onChange={(e) => patchFilters({ text: e.target.value })}
            spellCheck={false}
          />
          {filters.text && (
            <button className="search-clear" onClick={() => patchFilters({ text: '' })}>
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="topbar-spacer" />

        {loadedPlugins.map((plugin) =>
          plugin.TopBarAction ? (
            <plugin.TopBarAction
              key={plugin.manifest.id}
              active={activeTool === plugin.manifest.id}
              toggle={() => setActiveTool((current) => (current === plugin.manifest.id ? null : plugin.manifest.id))}
            />
          ) : null
        )}

        {/* 自绘标题栏按钮：系统边框已在主进程关掉 */}
        <div className="win-controls" data-component="App/WindowControls">
          <button onClick={() => void api.window.minimize()} title="最小化" aria-label="最小化">
            <IconWinMin width={14} height={14} />
          </button>
          <button
            onClick={() => {
              void api.window.toggleMaximize().then((maximized) => setMaximized(maximized))
            }}
            title={maximized ? '向下还原' : '最大化'}
            aria-label={maximized ? '向下还原' : '最大化'}
          >
            {maximized ? <IconWinRestore width={14} height={14} /> : <IconWinMax width={13} height={13} />}
          </button>
          <button className="win-close" onClick={() => void api.window.close()} title="关闭" aria-label="关闭">
            <IconWinClose width={14} height={14} />
          </button>
        </div>
      </header>

      {/* 侧栏右边缘的拖动条 */}
      {!settings.sidebarCollapsed && (
        <div
          className="sidebar-resizer"
          onMouseDown={startSidebarResize}
          title="拖动调整侧栏宽度"
          role="separator"
          aria-orientation="vertical"
        />
      )}

      <Sidebar
        collapsed={settings.sidebarCollapsed}
        stats={stats}
        plates={plates}
        topTags={topTags}
        filters={filters}
        view={view}
        jobActive={jobActive}
        onNavigateGallery={() => setView('gallery')}
        onNavigateCrawl={() => setView('crawl')}
        onOpenSettings={() => setView('settings')}
        onOpenHelp={() => setHelpOpen(true)}
        onFilters={patchFilters}
        onToggleTag={toggleTag}
      />

      <main className={'main' + (reflowing ? ' reflowing' : '')} ref={scrollRef} onScroll={onScroll}>
        {view === 'gallery' && (
          <>
            <div
              className={`filter-bar${barHidden ? ' hidden' : ''}`}
              data-component="App/FilterBar"
            >
              <div className="sort-picker">
                <button
                  className={`pill${sortOpen ? ' active' : ''}`}
                  onClick={() => setSortOpen((v) => !v)}
                  title="排序方式"
                >
                  排序：{SORT_LABEL[filters.sort]}
                  <span className={`caret-inline${sortOpen ? ' open' : ''}`}>▾</span>
                </button>
                {sortOpen && (
                  <div className="sort-menu">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={`sort-item${filters.sort === option.value ? ' active' : ''}`}
                        onClick={() => {
                          patchFilters({ sort: option.value })
                          setSortOpen(false)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className={`pill${isAllScope ? ' active' : ''}`}
                onClick={() =>
                  patchFilters({
                    downloaded: 'any',
                    favorite: false,
                    plate: null,
                    word: null,
                    tags: [],
                    orientation: 'any',
                    minWidth: 0
                  })
                }
              >
                全部
              </button>
              <button
                className={`pill${filters.favorite ? ' active' : ''}`}
                onClick={() => patchFilters({ favorite: !filters.favorite })}
              >
                收藏
              </button>
              <button
                className={`pill${filters.downloaded === 'only' ? ' active' : ''}`}
                onClick={() => patchFilters({ downloaded: filters.downloaded === 'only' ? 'any' : 'only' })}
                title="仅已下载（只与「待下载」互斥）"
              >
                已下载
              </button>
              <button
                className={`pill${filters.downloaded === 'never' ? ' active' : ''}`}
                onClick={() => patchFilters({ downloaded: filters.downloaded === 'never' ? 'any' : 'never' })}
              >
                待下载
              </button>
              <button
                className={`pill${filters.orientation === 'landscape' ? ' active' : ''}`}
                onClick={() =>
                  patchFilters({ orientation: filters.orientation === 'landscape' ? 'any' : 'landscape' })
                }
              >
                横图
              </button>
              <button
                className={`pill${filters.orientation === 'portrait' ? ' active' : ''}`}
                onClick={() =>
                  patchFilters({ orientation: filters.orientation === 'portrait' ? 'any' : 'portrait' })
                }
              >
                竖图
              </button>

              {filters.plate && (
                <span className="pill active">
                  {filters.plate}
                  {filters.word ? ` / ${filters.word}` : ''}
                  <span
                    className="x"
                    onClick={() => patchFilters({ plate: null, word: null })}
                    role="button"
                  >
                    <IconClose width={11} height={11} />
                  </span>
                </span>
              )}
              {filters.tags.map((tag) => (
                <span key={tag} className="pill active">
                  #{tag}
                  <span className="x" onClick={() => toggleTag(tag)} role="button">
                    <IconClose width={11} height={11} />
                  </span>
                </span>
              ))}
              {activeChipCount > 0 && (
                <button className="pill" onClick={() => setFilters({ ...INITIAL_FILTERS, text: filters.text })}>
                  清空筛选
                </button>
              )}

              <span className="meta-line">
                共 {total.toLocaleString()} 条 · 已显示 {items.length}
              </span>
            </div>

            <GalleryGrid
              items={items}
              loading={loading}
              dense={dense}
              onContextMenu={(item, x, y) => setContextMenu({ item, x, y })}
              emptyHint={
                stats && stats.items === 0
                  ? '图库还是空的 —— 去「抓取」页面选一个分类开始吧'
                  : '没有符合条件的图片，试试放宽筛选条件'
              }
              onOpen={setOpenId}
              onQuickFavorite={(item) => void quickFavorite(item)}
            />
          </>
        )}

        {view === 'crawl' && (
          <CrawlPanel
            settings={settings}
            progress={progress}
            logs={logs}
            onClearLogs={() => setLogs([])}
            onFinished={async () => {
              await refreshMeta()
              await loadPage('reset')
            }}
            onToast={showToast}
          />
        )}

        {view === 'settings' && (
          <SettingsPanel
            settings={settings}
            info={info}
            stats={stats}
            onChange={onSettingsChange}
            onToast={showToast}
          />
        )}
      </main>

      {jobActive && progress && (
        <div className="statusbar" data-component="App/StatusBar">
          <span className={`dot ${progress.phase}`} />
          <span className="text">
            {progress.phase === 'indexing' ? '建立索引' : progress.phase === 'paused' ? '已暂停' : '下载中'}
            {progress.downloadTotal != null && ` · ${progress.downloaded}/${progress.downloadTotal}`}
            {progress.pagesTotal != null && progress.phase === 'indexing' && ` · 第 ${progress.pagesDone}/${progress.pagesTotal} 页`}
          </span>
          <div className={`bar${progress.downloadTotal == null ? ' indeterminate' : ''}`}>
            <i
              style={{
                width:
                  progress.downloadTotal && progress.downloadTotal > 0
                    ? `${Math.min(100, (progress.downloaded / progress.downloadTotal) * 100)}%`
                    : `${Math.min(100, (progress.pagesDone / Math.max(1, progress.pagesTotal ?? 50)) * 100)}%`
              }}
            />
          </div>
          <span className="text">
            {formatSpeed(progress.speedBps)} · 已下载 {formatBytes(progress.bytesDownloaded)}
          </span>
          <button className="btn sm" onClick={() => setView('crawl')}>
            查看详情
          </button>
        </div>
      )}

      {openId != null && (
        <Lightbox
          id={openId}
          items={items}
          progress={progress}
          onClose={() => setOpenId(null)}
          onSelect={setOpenId}
          onToggleTag={(tag) => {
            toggleTag(tag)
            setView('gallery')
            setOpenId(null)
          }}
          onChanged={(id, patch) =>
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
          }
          onToast={showToast}
        />
      )}

      {loadedPlugins.map((plugin) =>
        plugin.Overlay ? (
          <plugin.Overlay
            key={plugin.manifest.id}
            active={activeTool === plugin.manifest.id}
            onActiveChange={(active) => setActiveTool(active ? plugin.manifest.id : null)}
            view={openId != null ? 'lightbox' : view}
            appVersion={info?.version ?? ''}
            onToast={showToast}
          />
        ) : null
      )}

      {view === 'gallery' && (
        <button
          className={'to-top' + (showToTop ? ' show' : '')}
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          title="回到顶部"
          aria-label="回到顶部"
        >
          <IconArrowUp width={17} height={17} />
        </button>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entries={contextEntries}
          onClose={() => setContextMenu(null)}
        />
      )}

      {helpOpen && (
        <div className="modal-mask" onClick={() => setHelpOpen(false)}>
          <div className="modal" data-component="App/Help" onClick={(e) => e.stopPropagation()}>
            <h3>帮助</h3>
            <dl className="kv" style={{ gridTemplateColumns: '104px 1fr' }}>
              <dt>搜索</dt>
              <dd>标题、标签、Pixiv ID 都能搜</dd>
              <dt>卡片</dt>
              <dd>收藏 / 复制 pid / 打开于（文件管理器、Pixiv）</dd>
              <dt>灯箱</dt>
              <dd>左键拖动，滚轮缩放，← → 翻页，Esc 关闭</dd>
            </dl>
            <div className="sep" />
            <dl className="kv" style={{ gridTemplateColumns: '104px 1fr' }}>
              <dt>版本</dt>
              <dd className="mono">{info?.version ?? '—'}</dd>
              <dt>图库目录</dt>
              <dd className="mono" style={{ fontSize: 11 }}>{info?.libraryRoot ?? '—'}</dd>
            </dl>
            <div className="modal-actions">
              <button className="btn" onClick={() => void api.openExternal('https://www.guguxz.com/')}>
                访问网站
              </button>
              <button className="btn primary" onClick={() => setHelpOpen(false)}>
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

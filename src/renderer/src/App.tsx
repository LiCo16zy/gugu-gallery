import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppInfo,
  AppSettings,
  CrawlLogLine,
  CrawlProgress,
  Facet,
  GalleryQuery,
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
import SetupWizard from './components/SetupWizard'
import LoginGuide from './components/LoginGuide'
import { IconCopy, IconExternal, IconFolder, IconHeart } from './components/Icons'
import { visibleCategories } from '@shared/categories'
import type { SessionStatus } from '@shared/bridge'
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
  /** 来源分类（搜索类目标的关键词），null 表示不限 */
  targetWord: string | null
  /** 发布月份闭区间（YYYY-MM），空串表示不限 */
  monthFrom: string
  monthTo: string
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
  minWidth: 0,
  targetWord: null,
  monthFrom: '',
  monthTo: ''
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
  /** 登录态：只保存站点会话 cookie，账号密码不经过本应用 */
  const [session, setSession] = useState<SessionStatus | null>(null)
  const [sessionMsg, setSessionMsg] = useState<string | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)
  /** 关键词维度的分类计数（电脑壁纸这类有 plate，泳装分享这类没有） */
  const [wordFacets, setWordFacets] = useState<Facet[]>([])
  /** 来源分类计数：搜索类目标（泳装分享）没有 plate，只能靠 item_targets */
  const [targetFacets, setTargetFacets] = useState<Facet[]>([])
  const [topTags, setTopTags] = useState<Facet[]>([])

  /** 摊平分类：只保留应用定义的几栏，并挂上各自的条目数 */
  const categories = useMemo(() => {
    // 两类分类的计数来源不一样：
    //   · 有站点分类的（Pixiv萌图 / 电脑壁纸 / 手机壁纸）看 items.word
    //   · 搜索类目标在站点侧没有分类，看 item_targets 里记下的来源
    const wordCounts = new Map<string, number>()
    for (const word of wordFacets) wordCounts.set(word.name, word.count)
    const targetCounts = new Map<string, number>()
    for (const t of targetFacets) targetCounts.set(t.name, t.count)
    return visibleCategories(session?.loggedIn === true)
      .map((c) => ({
        id: c.id,
        name: c.name,
        word: c.word,
        kind: c.kind,
        count: (c.kind === 'search' ? targetCounts.get(c.word) : wordCounts.get(c.word)) ?? 0
      }))
      .filter((c) => c.count > 0)
  }, [wordFacets, targetFacets, session?.loggedIn])

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
  /** 登录引导弹窗：帮助里的「登录」按钮会把它叫起来 */
  const [loginOpen, setLoginOpen] = useState(false)
  /**
   * 帮助里登录按钮的本地状态机：
   *   normal（登录 / 已登录 / 登录已失效）→ 连点三次「已登录」→ confirm（退出登录?）→ signedOut（已退出）
   * 「已退出」要等下一次重新打开帮助才恢复成可点的「登录」。
   */
  const [loginPhase, setLoginPhase] = useState<'normal' | 'confirm' | 'signedOut'>('normal')
  const [loginTaps, setLoginTaps] = useState(0)
  const [loginJitter, setLoginJitter] = useState(0)
  /** 侧栏开合 / 密度切换时给内容页加一层「变暗 -> 重排 -> 变亮」的过渡 */
  const [reflowing, setReflowing] = useState(false)
  /** 品牌图标允许被外部图标覆盖，取不到就退回默认的「咕」字 */
  const [appIconOk, setAppIconOk] = useState(true)
  /** 侧栏宽度：拖动时走本地状态，松手才落盘 */
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SETTINGS.sidebarWidth)
  /** 首次启动向导：建议的图库位置 */
  const [suggestedRoot, setSuggestedRoot] = useState('')
  const [bootstrapped, setBootstrapped] = useState(false)
  /** 向下滚动时把过滤栏藏起来 */
  const [barHidden, setBarHidden] = useState(false)
  /** 向上滚动且已经离开首屏时，右下角出现回到顶部 */
  const [showToTop, setShowToTop] = useState(false)
  /** 每换一批结果就 +1：给网格做 key，让它整体重挂载并重播进场动画 */
  const [listEpoch, setListEpoch] = useState(0)
  const [sortOpen, setSortOpen] = useState(false)
  /** 日期面板开合 */
  const [dateOpen, setDateOpen] = useState(false)

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
      if (!s.setupCompleted) {
        setSuggestedRoot(await api.suggestedLibraryRoot())
      }
      setSession(await api.session.status())
      setBootstrapped(true)
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
      setWordFacets(f.words ?? [])
      setTargetFacets(f.targets ?? [])
      setTopTags(f.topTags)
    } catch {
      /* 图库目录刚切换时可能短暂读不到，忽略 */
    }
  }, [])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  // 会话失效：引擎侧已经去重，这里只负责呈现
  useEffect(() => {
    return api.session.onExpired((message) => {
      setSessionMsg(message)
      setToast({ id: Date.now(), text: '登录态已失效，请到「帮助 → 登录」里重新贴一次 cookie', duration: 4000, kind: 'warn' })
      void api.session.status().then(setSession)
    })
  }, [])

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
      targetWord: filters.targetWord || undefined,
      monthFrom: filters.monthFrom || undefined,
      monthTo: filters.monthTo || undefined,
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
    setListEpoch((e) => e + 1)
    void loadPage('reset')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText, filters.plate, filters.word, filters.tags, filters.tagMode, filters.favorite, filters.downloaded, filters.sort, filters.orientation, filters.minWidth, filters.targetWord, filters.monthFrom, filters.monthTo])

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

  // 帮助界面：打开时登录按钮回到初始态，关闭时红字提示不再留着
  useEffect(() => {
    if (helpOpen) {
      setLoginPhase('normal')
      setLoginTaps(0)
      setLoginJitter(0)
    } else {
      setSessionMsg(null)
    }
  }, [helpOpen])

  // 排序菜单 / 日期面板：点空白处关闭
  useEffect(() => {
    if (!sortOpen && !dateOpen) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Element
      if (sortOpen && !target.closest('.sort-picker')) setSortOpen(false)
      if (dateOpen && !target.closest('.date-picker')) setDateOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [sortOpen, dateOpen])

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
      // 换一级分类时要清掉二级分类，否则会留下跨分类的无效条件。
      // 但如果这次就把 word 一起给了（侧栏分类就是这么点的：plate=null + word=名字），
      // 那就不能清 —— 之前无条件清空，等于侧栏分类点了没反应。
      if (patch.plate !== undefined && patch.word === undefined) next.word = null
      // 站点分类与来源分类互斥：两个一起生效只会得到空集
      if (patch.word) next.targetWord = null
      if (patch.targetWord) {
        next.word = null
        next.plate = null
      }

      if (patch.downloaded === 'never') {
        next.favorite = false
        next.orientation = 'any'
        next.minWidth = 0
        next.plate = null
        next.word = null
        next.targetWord = null
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
    !filters.word &&
    !filters.targetWord &&
    filters.tags.length === 0 &&
    filters.orientation === 'any' &&
    filters.minWidth === 0 &&
    filters.monthFrom === '' &&
    filters.monthTo === ''

  /**
   * 「登录中」= 本地存了 cookie 且没被判失效。
   * 只看 loggedIn 的话，过期的 cookie 会一直显示成「已登录」，反而误导。
   */
  const sessionOk = session?.loggedIn === true && session?.verified !== false
  const sessionStale = session?.loggedIn === true && session?.verified === false

  const openLoginGuide = useCallback(() => {
    setHelpOpen(false)
    setLoginOpen(true)
  }, [])

  /**
   * 帮助里那颗登录按钮。
   * 未登录 / 凭据失效 → 打开登录引导；
   * 已登录 → 不跳转，点一下抖一下，第三下才切成「退出登录?」，避免误触把登录态清掉。
   */
  const onLoginButton = useCallback((): void => {
    if (loginPhase === 'signedOut') return
    if (loginPhase === 'confirm') {
      void (async () => {
        setSession(await api.session.clear())
        setLoginPhase('signedOut')
        setSessionMsg('已清除本地登录凭据')
        // 登录专属分类会立刻从侧栏消失，别把「来源分类」筛选留在那儿
        setFilters((prev) => (prev.targetWord ? { ...prev, targetWord: null } : prev))
        showToast('已退出登录', 1800, 'info')
      })()
      return
    }
    if (sessionOk) {
      setLoginJitter((n) => n + 1)
      const taps = loginTaps + 1
      if (taps >= 3) {
        setLoginTaps(0)
        setLoginPhase('confirm')
      } else {
        setLoginTaps(taps)
      }
      return
    }
    openLoginGuide()
  }, [loginPhase, loginTaps, sessionOk, showToast, openLoginGuide])

  /** 筛选栏上显示来源分类的显示名（「泳装分享」而不是站点关键词） */
  const activeTargetLabel = useMemo(() => {
    if (!filters.targetWord) return ''
    const found = visibleCategories(session?.loggedIn === true).find((c) => c.word === filters.targetWord)
    return found?.name ?? filters.targetWord
  }, [filters.targetWord, session?.loggedIn])

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
    if (filters.targetWord) n += 1
    if (filters.monthFrom || filters.monthTo) n += 1
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
      className={`app${settings.sidebarCollapsed ? ' sidebar-collapsed' : ''}${
        openId != null ? ' lightbox-open' : ''
      }`}
      style={{
        // 收起时交给 .sidebar-collapsed 的 64px。
        // 之前无条件写内联值，内联优先级更高，侧栏就永远收不起来了。
        ['--sidebar-w' as string]: (settings.sidebarCollapsed ? 64 : sidebarWidth) + 'px'
      }}
    >
      <div className="brand" data-component="App/Brand" data-tauri-drag-region>
        {/* 品牌区同时是侧栏开关：鼠标移上去图标渐变为「展开/收起侧栏」 */}
        <button
          className="brand-mark"
          onClick={() => {
            // 刻意不触发重排变暗动画：侧栏自己有 grid-template-columns 的宽度过渡，
            // 再叠一层压暗会显得拖沓
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

      <header className="topbar" data-component="App/TopBar" data-tauri-drag-region>
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
        categories={categories}
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

              <div className="date-picker">
                <button
                  className={`pill${filters.monthFrom || filters.monthTo ? ' active' : ''}`}
                  onClick={() => setDateOpen((v) => !v)}
                  title="按发布月份筛选（可与排序叠加）"
                >
                  日期
                  {filters.monthFrom || filters.monthTo
                    ? `：${filters.monthFrom || '…'} ~ ${filters.monthTo || '…'}`
                    : ''}
                  <span className={`caret-inline${dateOpen ? ' open' : ''}`}>▾</span>
                </button>
                {dateOpen && (
                  <div className="date-menu">
                    <label>
                      <span>从</span>
                      <input
                        type="month"
                        value={filters.monthFrom}
                        max={filters.monthTo || undefined}
                        onChange={(e) => patchFilters({ monthFrom: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>到</span>
                      <input
                        type="month"
                        value={filters.monthTo}
                        min={filters.monthFrom || undefined}
                        onChange={(e) => patchFilters({ monthTo: e.target.value })}
                      />
                    </label>
                    <div className="date-actions">
                      <button
                        className="btn sm ghost"
                        disabled={!filters.monthFrom && !filters.monthTo}
                        onClick={() => patchFilters({ monthFrom: '', monthTo: '' })}
                      >
                        清空日期
                      </button>
                    </div>
                    <p className="dim">按站点发布/上传月份筛，留空即不限</p>
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
                    minWidth: 0,
                    targetWord: '',
                    monthFrom: '',
                    monthTo: ''
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

              {filters.targetWord && (
                <span className="pill active">
                  {activeTargetLabel}
                  <span className="x" onClick={() => patchFilters({ targetWord: null })} role="button">
                    <IconClose width={11} height={11} />
                  </span>
                </span>
              )}
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
              key={listEpoch}
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
            loggedIn={session?.loggedIn === true}
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
            {sessionMsg && (
              <p className="setup-error" style={{ margin: '0 0 10px' }}>
                {sessionMsg}
              </p>
            )}

            <div className="modal-actions">
              <button
                className={`btn btn-left${
                  loginPhase === 'confirm'
                    ? ' quit'
                    : sessionOk || loginPhase === 'signedOut'
                      ? ' done'
                      : sessionStale
                        ? ' warn'
                        : ''
                }`}
                disabled={loginPhase === 'signedOut'}
                onClick={onLoginButton}
              >
                <span key={loginJitter} className={loginJitter > 0 ? 'jitter' : ''}>
                  {loginPhase === 'signedOut'
                    ? '已退出'
                    : loginPhase === 'confirm'
                      ? '退出登录?'
                      : sessionOk
                        ? '已登录'
                        : sessionStale
                          ? '登录已失效'
                          : '登录'}
                </span>
              </button>

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

      {loginOpen && (
        <LoginGuide
          session={session}
          onSession={setSession}
          onClose={() => setLoginOpen(false)}
          onToast={showToast}
        />
      )}

      {bootstrapped && !settings.setupCompleted && (
        <SetupWizard
          suggested={suggestedRoot}
          appVersion={info?.version ?? ''}
          packaged={info?.packaged === true}
          onConfirm={async (dir) => {
            const applied = await api.library.setRoot(dir)
            await onSettingsChange({ libraryRoot: applied, setupCompleted: true }, { silent: true })
            setFilters(INITIAL_FILTERS)
            setItems([])
            setCursor(null)
            setListEpoch((e) => e + 1)
            await refreshMeta()
            await loadPage('reset')
          }}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

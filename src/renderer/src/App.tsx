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
import { IconGrid, IconRows, IconSearch, IconSidebar, IconClose } from './components/Icons'

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
  const pageSize = 60

  const [view, setView] = useState<View>('gallery')
  const [openId, setOpenId] = useState<number | null>(null)

  const [progress, setProgress] = useState<CrawlProgress | null>(null)
  const [logs, setLogs] = useState<CrawlLogLine[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const requestId = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  /* ---------------------------------------------------------------- 初始化 */

  useEffect(() => {
    void (async () => {
      const [s, i] = await Promise.all([api.settings.get(), api.appInfo()])
      setSettings(s)
      setInfo(i)
      document.documentElement.dataset.theme = s.theme === 'light' ? 'light' : 'dark'
      document.documentElement.style.setProperty('--accent', s.accent)
    })()
  }, [])

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
  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget
      if (loading || !cursor) return
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 900) void loadPage('append')
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
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  /* ---------------------------------------------------------------- 交互 */

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      // 换分类时必须清掉二级分类，否则会留下跨分类的无效条件
      if (patch.plate !== undefined) next.word = null
      return next
    })
  }, [])

  const toggleTag = useCallback((name: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(name) ? prev.tags.filter((t) => t !== name) : [...prev.tags, name]
    }))
  }, [])

  const onSettingsChange = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await api.settings.set(patch)
      setSettings(next)
      if (patch.theme) document.documentElement.dataset.theme = next.theme === 'light' ? 'light' : 'dark'
      if (patch.accent) document.documentElement.style.setProperty('--accent', next.accent)
      if (patch.libraryRoot) {
        setFilters(INITIAL_FILTERS)
        setItems([])
        setCursor(null)
        await refreshMeta()
        await loadPage('reset')
      }
      setToast('设置已保存')
    },
    [refreshMeta, loadPage]
  )

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

  const cardMin = dense ? '160px' : '212px'

  return (
    <div className={`app${settings.sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark">咕</div>
        {!settings.sidebarCollapsed && (
          <div className="brand-text">
            <span className="brand-title">咕咕图库</span>
            <span className="brand-sub">GUGUXZ COLLECTOR</span>
          </div>
        )}
      </div>

      <header className="topbar">
        <button
          className="btn icon ghost"
          title="折叠/展开侧栏"
          onClick={() => void onSettingsChange({ sidebarCollapsed: !settings.sidebarCollapsed })}
        >
          <IconSidebar />
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
              <IconClose width={12} height={12} />
            </button>
          )}
        </div>

        <div className="topbar-spacer" />

        <select
          className="select"
          value={filters.sort}
          onChange={(e) => patchFilters({ sort: e.target.value as SortKey })}
          title="排序方式"
        >
          <option value="newest">最新发布</option>
          <option value="oldest">最早上传</option>
          <option value="views">浏览量</option>
          <option value="size">文件体积</option>
          <option value="resolution">分辨率</option>
          <option value="title">标题</option>
          <option value="random">随机</option>
        </select>

        <div className="seg">
          <button className={!dense ? 'active' : ''} onClick={() => setDense(false)} title="标准视图">
            <IconGrid width={13} height={13} />
          </button>
          <button className={dense ? 'active' : ''} onClick={() => setDense(true)} title="紧凑视图">
            <IconRows width={13} height={13} />
          </button>
        </div>

        <div className="seg">
          <button className={view === 'gallery' ? 'active' : ''} onClick={() => setView('gallery')}>
            图库
          </button>
          <button className={view === 'crawl' ? 'active' : ''} onClick={() => setView('crawl')}>
            抓取
            {jobActive && <span className="dot running" />}
          </button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
            设置
          </button>
        </div>
      </header>

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
        onFilters={patchFilters}
        onToggleTag={toggleTag}
      />

      <main className="main" ref={scrollRef} onScroll={onScroll}>
        {view === 'gallery' && (
          <>
            <div className="filter-bar">
              <button
                className={`pill${filters.downloaded === 'any' && !filters.favorite && !filters.plate && filters.tags.length === 0 ? ' active' : ''}`}
                onClick={() =>
                  patchFilters({ downloaded: 'any', favorite: false, plate: null, word: null, tags: [] })
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
              cardMin={cardMin}
              emptyHint={
                stats && stats.items === 0
                  ? '图库还是空的 —— 去「抓取」页面选一个分类开始吧'
                  : '没有符合条件的图片，试试放宽筛选条件'
              }
              onOpen={setOpenId}
              onQuickFavorite={async (item) => {
                await api.library.favorite(item.id, !item.favorite)
                setItems((prev) =>
                  prev.map((i) => (i.id === item.id ? { ...i, favorite: !i.favorite } : i))
                )
              }}
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
            onToast={setToast}
          />
        )}

        {view === 'settings' && (
          <SettingsPanel
            settings={settings}
            info={info}
            stats={stats}
            onChange={onSettingsChange}
            onToast={setToast}
          />
        )}
      </main>

      {jobActive && progress && (
        <div className="statusbar">
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
          onToast={setToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

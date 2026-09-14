/**
 * 渲染进程访问主进程能力的唯一入口（全部通过 preload 的 contextBridge）。
 * 这里只做类型收敛与展示层格式化，不含任何业务逻辑。
 */
import type {
  AppInfo,
  AppSettings,
  CrawlProgress,
  CrawlRequest,
  Facet,
  GalleryPage,
  GalleryQuery,
  ItemDetail,
  LibraryStats,
  PlateFacet,
  SourceRef
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

export interface CrawlSiteInfo {
  plates: { name: string; words: string[] }[]
  fetchedAt: number
}

export interface GuguBridge {
  appInfo(): Promise<AppInfo>
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  library: {
    stats(): Promise<LibraryStats>
    facets(): Promise<{ plates: PlateFacet[]; topTags: Facet[] }>
    query(query: GalleryQuery): Promise<GalleryPage>
    item(id: number): Promise<ItemDetail | null>
    favorite(id: number, value: boolean): Promise<boolean>
    rating(id: number, value: number): Promise<number>
    remove(ids: number[], deleteFiles: boolean): Promise<number>
    reveal(id: number): Promise<boolean>
    pickRoot(): Promise<string | null>
  }
  crawl: {
    siteInfo(): Promise<CrawlSiteInfo>
    start(request: CrawlRequest): Promise<number>
    pause(): Promise<boolean>
    resume(): Promise<boolean>
    cancel(): Promise<boolean>
    downloadItems(ids: number[]): Promise<number>
    progress(): Promise<CrawlProgress | null>
    jobs(): Promise<JobRow[]>
    onProgress(cb: (payload: { progress: CrawlProgress; logs: CrawlProgress['logs'] }) => void): () => void
  }
  sources: {
    list(): Promise<SourceRef[]>
    remove(id: number): Promise<boolean>
    toggle(id: number, enabled: boolean): Promise<boolean>
  }
  devlog: {
    list(): Promise<unknown>
    export(payload: unknown): Promise<unknown>
  }
  openExternal(url: string): Promise<void>
}

export interface JobRow {
  id: number
  phase: string
  summary: string
  stats: string
  started_at: string
  finished_at: string | null
}

declare global {
  interface Window {
    gugu?: GuguBridge
  }
}

const bridge = (): GuguBridge => {
  if (!window.gugu) throw new Error('主进程桥接不可用：请通过 Electron 启动本应用')
  return window.gugu
}

export const api: GuguBridge = {
  appInfo: () => bridge().appInfo(),
  settings: {
    get: async () => {
      if (!window.gugu) return DEFAULT_SETTINGS
      return bridge().settings.get()
    },
    set: (patch) => bridge().settings.set(patch)
  },
  library: {
    stats: () => bridge().library.stats(),
    facets: () => bridge().library.facets(),
    query: (query) => bridge().library.query(query),
    item: (id) => bridge().library.item(id),
    favorite: (id, value) => bridge().library.favorite(id, value),
    rating: (id, value) => bridge().library.rating(id, value),
    remove: (ids, deleteFiles) => bridge().library.remove(ids, deleteFiles),
    reveal: (id) => bridge().library.reveal(id),
    pickRoot: () => bridge().library.pickRoot()
  },
  crawl: {
    siteInfo: () => bridge().crawl.siteInfo(),
    start: (request) => bridge().crawl.start(request),
    pause: () => bridge().crawl.pause(),
    resume: () => bridge().crawl.resume(),
    cancel: () => bridge().crawl.cancel(),
    downloadItems: (ids) => bridge().crawl.downloadItems(ids),
    progress: () => bridge().crawl.progress(),
    jobs: () => bridge().crawl.jobs(),
    onProgress: (cb) => bridge().crawl.onProgress(cb)
  },
  sources: {
    list: () => bridge().sources.list(),
    remove: (id) => bridge().sources.remove(id),
    toggle: (id, enabled) => bridge().sources.toggle(id, enabled)
  },
  devlog: {
    list: () => bridge().devlog.list(),
    export: (payload) => bridge().devlog.export(payload)
  },
  openExternal: (url) => bridge().openExternal(url)
}

/* ------------------------------------------------------------ 展示层格式化 */

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export const formatSpeed = (bytesPerSecond: number): string =>
  bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : '—'

export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`
  return `${Math.floor(seconds / 3600)} 小时 ${Math.round((seconds % 3600) / 60)} 分`
}

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const formatRelative = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T')).getTime()
  if (Number.isNaN(d)) return value
  const diff = Date.now() - d
  const mins = Math.round(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} 天前`
  return formatDate(value)
}

export const megapixels = (width: number | null, height: number | null): string => {
  if (!width || !height) return '—'
  const mp = (width * height) / 1_000_000
  return `${mp.toFixed(1)} MP`
}

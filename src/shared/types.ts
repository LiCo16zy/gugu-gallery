/**
 * 主进程 <-> 渲染进程共享的领域类型。
 * 这里只放纯数据定义，任何一端都不应引入 Electron 或 Node API。
 */

export type ItemId = number

/* ------------------------------------------------------------------ 站点源 */

export type SourceKind = 'home' | 'category' | 'search' | 'ranking' | 'custom'

export interface SourceRef {
  id: number
  kind: SourceKind
  /** 一级分类，例如「ACG图片」 */
  plate: string | null
  /** 二级分类 / 关键词，例如「Pixiv萌图」 */
  word: string | null
  url: string
  title: string
  enabled: boolean
  itemCount: number
  lastCrawledAt: string | null
}

/** 抓取任务可以临时指定目标，不必先建源 */
export interface TargetInput {
  kind: SourceKind
  plate?: string | null
  word?: string | null
  url?: string
}

/* --------------------------------------------------------------- 图库条目 */

export type FileStatus = 'none' | 'ready' | 'missing'

export interface ItemSummary {
  id: ItemId
  title: string
  plate: string | null
  word: string | null
  width: number | null
  height: number | null
  /** 站点标注的文件大小（字节） */
  bytes: number | null
  publishedAt: string | null
  views: number | null
  tags: string[]
  /** Pixiv 作品 ID（详情页补全后才有） */
  pixivId: string | null
  favorite: boolean
  rating: number
  fileStatus: FileStatus
  ext: string | null
  fileBytes: number | null
  /** gugu://thumb/<id> 或 null */
  thumbUrl: string | null
  /** gugu://media/<id> 或 null */
  imageUrl: string | null
}

export interface ItemDetail extends ItemSummary {
  detailUrl: string
  sourceUrl: string | null
  uploader: string | null
  pixivArtistUrl: string | null
  likes: number
  collects: number
  remotePath: string | null
  previewUrl: string | null
  downloadUrl: string | null
  sha256: string | null
  relPath: string | null
  downloadedAt: string | null
  indexedAt: string | null
}

export type SortKey =
  | 'newest'
  | 'oldest'
  | 'views'
  | 'size'
  | 'resolution'
  | 'random'
  | 'title'

export type Orientation = 'any' | 'landscape' | 'portrait' | 'square'

export interface GalleryQuery {
  text?: string
  plate?: string | null
  word?: string | null
  tags?: string[]
  tagMode?: 'any' | 'all'
  /** 命中这些标签的条目将被排除 */
  excludeTags?: string[]
  favorite?: boolean
  downloaded?: 'any' | 'only' | 'never'
  minWidth?: number
  minHeight?: number
  orientation?: Orientation
  sort?: SortKey
  cursor?: string | null
  limit?: number
}

export interface GalleryPage {
  items: ItemSummary[]
  nextCursor: string | null
  total: number
}

export interface Facet {
  name: string
  count: number
}

/** 一级分类及其下属二级分类（用于侧栏分类树） */
export interface PlateFacet extends Facet {
  words: Facet[]
}

export interface LibraryStats {
  items: number
  downloaded: number
  favorites: number
  totalBytes: number
  plates: PlateFacet[]
  topTags: Facet[]
  sources: number
  libraryRoot: string
  dbBytes: number
}

/* --------------------------------------------------------------- 抓取任务 */

export type CrawlPhase =
  | 'queued'
  | 'indexing'
  | 'downloading'
  | 'paused'
  | 'done'
  | 'cancelled'
  | 'failed'

export interface CrawlRequest {
  targets: TargetInput[]
  /** 起始页（1 起） */
  pageFrom: number
  /** 结束页；null 表示一直翻到空页为止 */
  pageTo: number | null
  /** 最多处理多少条目，null 不限 */
  maxItems: number | null
  /** 只抓取列表页建立索引，不下载图片 */
  indexOnly: boolean
  /** 是否下载原图 */
  download: boolean
  /** 下载前先抓详情页，补全 Pixiv id / 画师 / 完整标签 */
  enrich: boolean
  /** 已下载的跳过 */
  skipExisting: boolean
  /** 列表页并发 */
  listConcurrency: number
  /** 下载并发 */
  downloadConcurrency: number
  /** 每次请求之间的基础间隔（毫秒） */
  delayMs: number
  retries: number
  /** 仅保留含这些标签的条目（任一命中） */
  includeTags: string[]
  /** 排除含这些标签的条目 */
  excludeTags: string[]
  /** 跳过 page_marks 里已抓过的页（中途取消后接着爬时打开） */
  resumeFromMarks: boolean
  /** 小于该像素宽度的图片跳过下载 */
  minWidth: number
  /** 小于该字节数的图片跳过下载 */
  minBytes: number
}

export interface CrawlLogLine {
  at: number
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface CrawlProgress {
  jobId: number
  phase: CrawlPhase
  startedAt: number
  elapsedMs: number
  pagesDone: number
  pagesTotal: number | null
  itemsFound: number
  itemsNew: number
  itemsMatched: number
  downloadTotal: number | null
  downloaded: number
  skipped: number
  failed: number
  bytesDownloaded: number
  speedBps: number
  etaSeconds: number | null
  currentLabel: string | null
  logs: CrawlLogLine[]
}

export interface JobRecord {
  id: number
  phase: CrawlPhase
  request: CrawlRequest
  summary: string
  stats: Record<string, number>
  startedAt: string
  finishedAt: string | null
}

/* ------------------------------------------------------------------- 设置 */

export interface AppSettings {
  libraryRoot: string
  /** 下载原图（dw=true）还是压缩预览图 */
  preferOriginal: boolean
  listConcurrency: number
  downloadConcurrency: number
  delayMs: number
  retries: number
  thumbSize: number
  theme: 'dark' | 'light' | 'system'
  accent: string
  /** 落盘时重命名策略 */
  naming: 'id-slug' | 'id' | 'pixiv' | 'hash'
  /** 代理，例如 http://127.0.0.1:7890 ；留空表示直连 */
  proxy: string
  sidebarCollapsed: boolean
  pageSize: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  libraryRoot: '',
  preferOriginal: true,
  listConcurrency: 2,
  downloadConcurrency: 3,
  delayMs: 220,
  retries: 4,
  thumbSize: 512,
  theme: 'dark',
  accent: '#7c9cff',
  naming: 'id-slug',
  proxy: '',
  sidebarCollapsed: false,
  pageSize: 60
}

/* --------------------------------------------------------------- IPC 契约 */

export interface CrawlSiteInfo {
  plates: { name: string; words: string[] }[]
  fetchedAt: number
}

export interface AppInfo {
  version: string
  electron: string
  node: string
  chrome: string
  platform: string
  libraryRoot: string
  dbPath: string
}

/**
 * preload 通过 contextBridge 暴露给渲染进程的 API 契约。
 * 放在 shared 里，是为了让「核心界面」和「插件界面」拿到同一份类型定义，
 * 插件不必反过来依赖应用源码。
 */
import type { AppInfo, AppSettings, CrawlProgress, GalleryPage, GalleryQuery, ItemDetail, LibraryStats, PlateFacet, SourceRef, Facet } from './types'
import type { PluginManifest } from './plugin'

/** 登录态（只保存站点会话 cookie，不保存账号密码） */
export interface SessionStatus {
  loggedIn: boolean
  fingerprint: string | null
  savedAt: string | null
  encrypted: boolean
  verified: boolean | null
  verifyMessage: string | null
}

export interface JobRow {
  id: number
  phase: string
  summary: string
  stats: string
  started_at: string
  finished_at: string | null
}

export interface CrawlSiteInfo {
  plates: { name: string; words: string[] }[]
  fetchedAt: number
}

/** 插件桥：核心对插件的唯一入口，新增插件不需要改这里 */
export interface PluginBridge {
  /** 当前已加载的插件清单 */
  list(): Promise<PluginManifest[]>
  /** 调用某个插件注册的方法 */
  invoke<T = unknown>(pluginId: string, method: string, payload?: unknown): Promise<T>
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
    /** 只选目录不切换（首次启动向导用） */
    chooseDir(defaultPath?: string): Promise<string | null>
    /** 直接切到指定目录（首次启动向导用），返回最终路径 */
    setRoot(dir: string): Promise<string>
  }
  /** 建议的图库位置：安装版是安装目录下的子文件夹 */
  suggestedLibraryRoot(): Promise<string>
  crawl: {
    siteInfo(): Promise<CrawlSiteInfo>
    /** 某个目标的总页数 / 总条数，用于在界面上给个规模预期 */
    targetInfo(target: unknown): Promise<{ totalPages: number | null; totalItems: number | null }>
    start(request: unknown): Promise<number>
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
  session: {
    status(): Promise<SessionStatus>
    /** 保存 cookie 并立即去站点校验一次 */
    set(cookie: string): Promise<{ status: SessionStatus; verify: { ok: boolean; message: string } }>
    clear(): Promise<SessionStatus>
    verify(): Promise<{ status: SessionStatus; verify: { ok: boolean; message: string } }>
    /** 会话失效时回调一次（引擎侧已去重） */
    onExpired(cb: (message: string) => void): () => void
  }
  plugins: PluginBridge
  openExternal(url: string): Promise<void>
  copyText(text: string): Promise<boolean>
  /** 自绘标题栏用：系统边框已被关闭 */
  window: {
    minimize(): Promise<boolean>
    toggleMaximize(): Promise<boolean>
    close(): Promise<boolean>
    state(): Promise<{ maximized: boolean }>
  }
}

declare global {
  interface Window {
    gugu?: GuguBridge
  }
}

/**
 * preload 通过 contextBridge 暴露给渲染进程的 API 契约。
 * 放在 shared 里，是为了让「核心界面」和「插件界面」拿到同一份类型定义，
 * 插件不必反过来依赖应用源码。
 */
import type { AppInfo, AppSettings, CrawlProgress, GalleryPage, GalleryQuery, ItemDetail, LibraryStats, PlateFacet, SourceRef, Facet } from './types'
import type { PluginManifest } from './plugin'

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
  }
  crawl: {
    siteInfo(): Promise<CrawlSiteInfo>
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
  plugins: PluginBridge
  openExternal(url: string): Promise<void>
  copyText(text: string): Promise<boolean>
}

declare global {
  interface Window {
    gugu?: GuguBridge
  }
}

/**
 * 渲染进程 <-> 主进程的 IPC 契约实现。
 * 所有能力都通过 contextBridge 暴露，渲染进程不直接碰 Node / fs。
 */
import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import type {
  AppInfo,
  AppSettings,
  CrawlRequest,
  GalleryPage,
  GalleryQuery,
  ItemDetail,
  LibraryStats,
  SourceRef,
  TargetInput
} from '@shared/types'
import type { AppContext } from './context'
import { defaultLibraryRoot } from './config'

export const IPC = {
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  libraryStats: 'library:stats',
  libraryFacets: 'library:facets',
  libraryQuery: 'library:query',
  libraryItem: 'library:item',
  libraryFavorite: 'library:favorite',
  libraryRating: 'library:rating',
  libraryDelete: 'library:delete',
  libraryReveal: 'library:reveal',
  libraryPickRoot: 'library:pickRoot',
  openExternal: 'app:openExternal',
  siteInfo: 'crawl:siteInfo',
  crawlStart: 'crawl:start',
  crawlPause: 'crawl:pause',
  crawlResume: 'crawl:resume',
  crawlCancel: 'crawl:cancel',
  crawlDownloadItems: 'crawl:downloadItems',
  crawlProgress: 'crawl:progress',
  crawlJobs: 'crawl:jobs',
  sourcesList: 'sources:list',
  sourcesRemove: 'sources:remove',
  sourcesToggle: 'sources:toggle',
  progressEvent: 'crawl:progress-event'
} as const

export function registerIpc(ctx: AppContext, getWindow: () => BrowserWindow | null): void {
  const handle = <T>(channel: string, fn: (...args: never[]) => Promise<T> | T): void => {
    ipcMain.handle(channel, async (_event, ...args) => fn(...(args as never[])))
  }

  handle(IPC.appInfo, (): AppInfo => {
    const s = ctx.settingsValue()
    return {
      version: __APP_VERSION__,
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      libraryRoot: s.libraryRoot,
      dbPath: ctx.library.dbPath
    }
  })

  handle(IPC.settingsGet, (): AppSettings => ctx.settingsValue())
  handle(IPC.settingsSet, (patch: Partial<AppSettings>): Promise<AppSettings> => ctx.updateSettings(patch))

  handle(IPC.libraryStats, (): LibraryStats => ctx.repository.stats(ctx.library.root))
  handle(IPC.libraryFacets, () => ctx.repository.facets())
  handle(IPC.libraryQuery, (query: GalleryQuery): GalleryPage => ctx.repository.listItems(query))
  handle(IPC.libraryItem, (id: number): ItemDetail | null => ctx.repository.getItem(id))

  handle(IPC.libraryFavorite, (id: number, favorite: boolean): boolean => {
    ctx.repository.setFavorite(id, favorite)
    return favorite
  })

  handle(IPC.libraryRating, (id: number, rating: number): number => {
    ctx.repository.setRating(id, rating)
    return rating
  })

  handle(IPC.libraryDelete, async (ids: number[], deleteFiles: boolean): Promise<number> => {
    const files = ctx.repository.getFilesForItems(ids)
    if (deleteFiles) {
      for (const rel of files.values()) {
        await ctx.library.remove(rel)
      }
      for (const id of ids) await ctx.library.remove(ctx.library.thumbRelPath(id))
    }
    ctx.repository.deleteItems(ids)
    return ids.length
  })

  handle(IPC.libraryReveal, (id: number): boolean => {
    const item = ctx.repository.getItem(id)
    if (!item?.relPath) return false
    const abs = ctx.library.resolveInside(item.relPath)
    if (!existsSync(abs)) return false
    shell.showItemInFolder(abs)
    return true
  })

  handle(IPC.libraryPickRoot, async (): Promise<string | null> => {
    const win = getWindow()
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: '选择图库目录',
      defaultPath: ctx.settingsValue().libraryRoot || defaultLibraryRoot(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    await ctx.switchLibrary(result.filePaths[0])
    return result.filePaths[0]
  })

  handle(IPC.openExternal, async (url: string): Promise<void> => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  handle(IPC.siteInfo, () => ctx.crawler.fetchSiteInfo(false))

  handle(IPC.crawlStart, async (request: CrawlRequest): Promise<number> => {
    const jobId = await ctx.crawler.start(request)
    const progress = ctx.crawler.currentProgress()
    if (progress) emitProgress(getWindow(), progress, progress.logs)
    return jobId
  })

  handle(IPC.crawlPause, (): boolean => {
    ctx.crawler.pause()
    return true
  })

  handle(IPC.crawlResume, (): boolean => {
    ctx.crawler.resume()
    return true
  })

  handle(IPC.crawlCancel, (): boolean => {
    ctx.crawler.cancel()
    return true
  })

  handle(IPC.crawlDownloadItems, async (ids: number[]): Promise<number> => {
    const jobId = await ctx.crawler.downloadItems(ids)
    const progress = ctx.crawler.currentProgress()
    if (progress) emitProgress(getWindow(), progress, progress.logs)
    return jobId
  })

  handle(IPC.crawlProgress, () => ctx.crawler.currentProgress())
  handle(IPC.crawlJobs, () => ctx.repository.recentJobs(30))

  handle(IPC.sourcesList, (): SourceRef[] => ctx.repository.listSources())
  handle(IPC.sourcesRemove, (id: number): boolean => {
    ctx.repository.removeSource(id)
    return true
  })
  handle(IPC.sourcesToggle, (id: number, enabled: boolean): boolean => {
    ctx.repository.setSourceEnabled(id, enabled)
    return true
  })

  // 引擎进度 -> 渲染进程
  ctx.onProgress((progress, logs) => emitProgress(getWindow(), progress, logs))
}

function emitProgress(
  win: BrowserWindow | null,
  progress: unknown,
  logs: unknown
): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC.progressEvent, { progress, logs })
}

export type { TargetInput }
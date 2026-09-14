/**
 * 预加载脚本：通过 contextBridge 暴露一组白名单 API。
 * 渲染进程永远拿不到 ipcRenderer / require / fs。
 *
 * 插件能力统一走 plugins.invoke(id, method, payload)，
 * 核心不需要为每个插件单独开通道，插件也不需要改这里。
 */
import { contextBridge, ipcRenderer } from 'electron'

const IPC = {
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

const pluginIpc = {
  list: 'plugin:list',
  invoke: 'plugin:invoke'
} as const

const api = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch: unknown) => ipcRenderer.invoke(IPC.settingsSet, patch)
  },
  library: {
    stats: () => ipcRenderer.invoke(IPC.libraryStats),
    facets: () => ipcRenderer.invoke(IPC.libraryFacets),
    query: (query: unknown) => ipcRenderer.invoke(IPC.libraryQuery, query),
    item: (id: number) => ipcRenderer.invoke(IPC.libraryItem, id),
    favorite: (id: number, value: boolean) => ipcRenderer.invoke(IPC.libraryFavorite, id, value),
    rating: (id: number, value: number) => ipcRenderer.invoke(IPC.libraryRating, id, value),
    remove: (ids: number[], deleteFiles: boolean) => ipcRenderer.invoke(IPC.libraryDelete, ids, deleteFiles),
    reveal: (id: number) => ipcRenderer.invoke(IPC.libraryReveal, id),
    pickRoot: () => ipcRenderer.invoke(IPC.libraryPickRoot)
  },
  crawl: {
    siteInfo: () => ipcRenderer.invoke(IPC.siteInfo),
    start: (request: unknown) => ipcRenderer.invoke(IPC.crawlStart, request),
    pause: () => ipcRenderer.invoke(IPC.crawlPause),
    resume: () => ipcRenderer.invoke(IPC.crawlResume),
    cancel: () => ipcRenderer.invoke(IPC.crawlCancel),
    downloadItems: (ids: number[]) => ipcRenderer.invoke(IPC.crawlDownloadItems, ids),
    progress: () => ipcRenderer.invoke(IPC.crawlProgress),
    jobs: () => ipcRenderer.invoke(IPC.crawlJobs),
    onProgress: (cb: (payload: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on(IPC.progressEvent, listener)
      return () => ipcRenderer.removeListener(IPC.progressEvent, listener)
    }
  },
  sources: {
    list: () => ipcRenderer.invoke(IPC.sourcesList),
    remove: (id: number) => ipcRenderer.invoke(IPC.sourcesRemove, id),
    toggle: (id: number, enabled: boolean) => ipcRenderer.invoke(IPC.sourcesToggle, id, enabled)
  },
  plugins: {
    list: () => ipcRenderer.invoke(pluginIpc.list),
    invoke: (pluginId: string, method: string, payload?: unknown) =>
      ipcRenderer.invoke(pluginIpc.invoke, pluginId, method, payload)
  },
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url)
}

contextBridge.exposeInMainWorld('gugu', api)

export type GuguApi = typeof api

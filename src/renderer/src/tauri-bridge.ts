/**
 * Tauri 外壳下安装 window.gugu。
 *
 * 为什么还叫 window.gugu：渲染层的 6166 行界面只通过这一个对象访问后端
 * （29 个方法 / 33 处调用，没有任何 Node 或 Electron API），
 * 所以换外壳时只要在这里把同一份契约重新实现一遍，界面一行都不用改。
 *
 * 注意：这个模块必须**先于** api.ts 被求值 —— api.ts 在模块加载时就把
 * window.gugu 抓走了，晚一步就只能拿到会抛错的空壳。
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { GuguBridge } from '@shared/bridge'

/** Electron 下已经有 window.gugu，这里只负责 Tauri；两者可以共存便于对照 */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)

function buildBridge(): GuguBridge {
  const win = getCurrentWindow()
  return {
    appInfo: () => invoke('app_info'),
    settings: {
      get: () => invoke('settings_get'),
      set: (patch) => invoke('settings_set', { patch })
    },
    library: {
      stats: () => invoke('library_stats'),
      facets: () => invoke('library_facets'),
      query: (query) => invoke('library_query', { query }),
      item: (id) => invoke('library_item', { id }),
      favorite: (id, value) => invoke('library_favorite', { id, value }),
      rating: (id, value) => invoke('library_rating', { id, value }),
      remove: (ids, deleteFiles) => invoke('library_remove', { ids, deleteFiles }),
      reveal: (id) => invoke('library_reveal', { id }),
      pickRoot: () => invoke('library_pick_root'),
      chooseDir: (defaultPath) => invoke('library_choose_dir', { defaultPath }),
      setRoot: (dir) => invoke('library_set_root', { dir })
    },
    suggestedLibraryRoot: () => invoke('suggested_library_root'),
    crawl: {
      siteInfo: () => invoke('crawl_site_info'),
      targetInfo: (target) => invoke('crawl_target_info', { target }),
      start: (request) => invoke('crawl_start', { request }),
      pause: () => invoke('crawl_pause'),
      resume: () => invoke('crawl_resume'),
      cancel: () => invoke('crawl_cancel'),
      downloadItems: (ids) => invoke('crawl_download_items', { ids }),
      progress: () => invoke('crawl_progress'),
      jobs: () => invoke('crawl_jobs'),
      onProgress: (cb) => {
        const pending = listen<Parameters<typeof cb>[0]>('crawl://progress', (event) => cb(event.payload))
        return () => {
          void pending.then((un) => un())
        }
      }
    },
    sources: {
      list: () => invoke('sources_list'),
      remove: (id) => invoke('sources_remove', { id }),
      toggle: (id, enabled) => invoke('sources_toggle', { id, enabled })
    },
    session: {
      status: () => invoke('session_status'),
      set: (cookie) => invoke('session_set', { cookie }),
      clear: () => invoke('session_clear'),
      verify: () => invoke('session_verify'),
      onExpired: (cb) => {
        const pending = listen<string>('session://expired', (event) => cb(event.payload))
        return () => {
          void pending.then((un) => un())
        }
      }
    },
    plugins: {
      list: () => invoke('plugins_list'),
      invoke: (pluginId, method, payload) => invoke('plugins_invoke', { pluginId, method, payload })
    },
    openExternal: async (url) => {
      await invoke('open_external', { url })
    },
    copyText: (text) => invoke('copy_text', { text }),
    window: {
      minimize: async () => {
        await win.minimize()
        return true
      },
      toggleMaximize: async () => {
        await win.toggleMaximize()
        return true
      },
      close: async () => {
        await win.close()
        return true
      },
      state: async () => ({ maximized: await win.isMaximized() })
    }
  }
}

if (isTauri() && !window.gugu) {
  window.gugu = buildBridge()
}

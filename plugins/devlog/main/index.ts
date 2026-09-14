/**
 * devlog 插件（主进程侧）。
 *
 * 只做两件事：把轮次列出来、把一次标注导出成一整个轮次目录。
 * 注册的方法通过 window.gugu.plugins.invoke('devlog', '<method>') 调用。
 */
import type { BrowserWindow } from 'electron'
import type { MainPluginHost, MainPluginModule, PluginManifest } from '@shared/plugin'
import type { ExportPayload, ExportResult, RoundInfo } from '../shared/types'
import { DevlogStore } from './store'
import manifestJson from '../plugin.json'

const manifest = manifestJson as PluginManifest

let store: DevlogStore | null = null

const plugin: MainPluginModule = {
  manifest,

  activate(host: MainPluginHost): void {
    store = new DevlogStore(host.workspaceRoot)

    host.method('listRounds', async (): Promise<RoundInfo[]> => store!.listRounds())

    host.method('exportAnnotations', async (payload, ctx): Promise<ExportResult> => {
      const data = payload as ExportPayload
      if (!data || !Array.isArray(data.annotations)) {
        throw new Error('导出参数不合法：缺少 annotations')
      }
      return store!.exportAnnotations(data, ctx.window as BrowserWindow | null)
    })

    host.log(`轮次档案目录: ${store.roundsDir}`)
  }
}

export default plugin

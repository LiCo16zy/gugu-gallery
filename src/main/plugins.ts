/**
 * 插件宿主（主进程侧）。
 *
 * 核心应用不知道任何具体插件的存在：宿主只认「插件注册了哪些方法」。
 * 插件产物在 out/main/plugins/<id>.js，由构建期按 plugins.json 决定是否生成；
 * 找不到文件就跳过，所以关掉插件时这里完全不会报错。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ipcMain } from 'electron'
import type {
  MainPluginHost,
  MainPluginModule,
  PluginInvokeContext,
  PluginManifest,
  PluginMethodHandler
} from '@shared/plugin'

declare const __GUGU_PLUGINS__: PluginManifest[]

export const PLUGIN_IPC = {
  list: 'plugin:list',
  invoke: 'plugin:invoke'
} as const

interface LoadedPlugin {
  manifest: PluginManifest
  module: MainPluginModule
  methods: Map<string, PluginMethodHandler>
}

export interface PluginHostOptions {
  workspaceRoot: string
  getLibraryRoot: () => string
  getWindow: () => unknown
}

export class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>()
  private manifests: PluginManifest[] = []

  get list(): PluginManifest[] {
    return this.manifests
  }

  async load(options: PluginHostOptions): Promise<void> {
    for (const manifest of __GUGU_PLUGINS__) {
      const entry = join(__dirname, 'plugins', `${manifest.id}.js`)
      if (!existsSync(entry)) {
        console.warn(`[gugu] 插件 ${manifest.id} 没有构建产物，已跳过`)
        continue
      }
      try {
        const url = pathToFileURL(entry).href
        const mod = (await import(/* @vite-ignore */ url)) as { default?: MainPluginModule } & Partial<MainPluginModule>
        const plugin: MainPluginModule = mod.default ?? (mod as MainPluginModule)
        if (typeof plugin?.activate !== 'function') {
          console.warn(`[gugu] 插件 ${manifest.id} 没有导出 activate()，已跳过`)
          continue
        }

        const loaded: LoadedPlugin = {
          manifest: plugin.manifest ?? manifest,
          module: plugin,
          methods: new Map()
        }

        const hostApi: MainPluginHost = {
          manifest: loaded.manifest,
          workspaceRoot: options.workspaceRoot,
          method: (name, handler) => {
            loaded.methods.set(name, handler)
          },
          log: (message) => console.log(`[${loaded.manifest.id}] ${message}`)
        }

        await plugin.activate(hostApi)
        this.plugins.set(loaded.manifest.id, loaded)
        this.manifests.push(loaded.manifest)
        console.log(`[gugu] 已装载插件 ${loaded.manifest.id}（${loaded.methods.size} 个方法）`)
      } catch (err) {
        // 插件坏了不能拖垮应用
        console.error(`[gugu] 插件 ${manifest.id} 装载失败:`, err instanceof Error ? err.message : err)
      }
    }
  }

  /** 渲染进程调用插件方法的唯一入口 */
  async invoke(pluginId: string, method: string, payload: unknown, options: PluginHostOptions): Promise<unknown> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) throw new Error(`插件未加载: ${pluginId}`)
    const handler = plugin.methods.get(method)
    if (!handler) throw new Error(`插件 ${pluginId} 没有方法: ${method}`)

    const ctx: PluginInvokeContext = {
      window: options.getWindow(),
      workspaceRoot: options.workspaceRoot,
      libraryRoot: options.getLibraryRoot(),
      log: (message) => console.log(`[${pluginId}] ${message}`)
    }
    return handler(payload, ctx)
  }

  registerIpc(options: PluginHostOptions): void {
    ipcMain.handle(PLUGIN_IPC.list, () => this.manifests)
    ipcMain.handle(PLUGIN_IPC.invoke, (_event, pluginId: string, method: string, payload: unknown) =>
      this.invoke(pluginId, method, payload, options)
    )
  }

  async deactivateAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.module.deactivate?.()
      } catch {
        /* 退出阶段的异常忽略 */
      }
    }
    this.plugins.clear()
    this.manifests = []
  }
}

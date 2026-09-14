/**
 * 插件宿主（渲染进程侧）。
 *
 * 汇总构建期按 plugins.json 生成的插件入口。一个插件都没装时，
 * 这里就是一个空数组，界面自然退化成「没有工具按钮」的纯图库应用。
 */
import { rendererPlugins } from 'virtual:gugu-plugins'
import type { LoadedRendererPlugin, RendererPluginModule } from '@shared/plugin'

export type { LoadedRendererPlugin }

export const loadedPlugins: LoadedRendererPlugin[] = (rendererPlugins ?? [])
  .filter((plugin): plugin is RendererPluginModule => Boolean(plugin?.manifest?.id))
  .map((plugin) => ({
    manifest: plugin.manifest,
    TopBarAction: plugin.TopBarAction,
    Overlay: plugin.Overlay
  }))

/** 便于面板/关于页展示当前装载了哪些工具 */
export const pluginSummaries = loadedPlugins.map((p) => ({
  id: p.manifest.id,
  name: p.manifest.name,
  version: p.manifest.version,
  description: p.manifest.description
}))

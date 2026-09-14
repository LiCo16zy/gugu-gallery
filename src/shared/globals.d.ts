/** 构建期由 electron.vite.config.ts 注入 */
declare const __APP_VERSION__: string
declare const __GUGU_PLUGINS__: import('./plugin').PluginManifest[]

/** 由 electron.vite.config.ts 按 plugins.json 生成的渲染侧插件入口 */
declare module 'virtual:gugu-plugins' {
  import type { RendererPluginModule } from './plugin'
  export const rendererPlugins: RendererPluginModule[]
}

/**
 * 插件契约（主进程 / 渲染进程共用）。
 *
 * 设计目标：核心应用不应该知道任何具体插件的存在。
 *  - 主进程只认「注册方法」这一件事，渲染进程只认「给我一个按钮和一个覆盖层」。
 *  - 新增插件 = 在 plugins/ 下建目录 + 在 plugins.json 里登记，不需要动核心代码。
 *  - 关闭插件时，构建产物里不会出现它的任何代码（见 electron.vite.config.ts）。
 */
import type { ComponentType } from 'react'

/** 插件目录下的 plugin.json */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  /** 依赖的其它插件 id；缺失时该插件不会被加载 */
  dependsOn?: string[]
  /** 界面入口形态，宿主据此决定渲染什么 */
  ui?: {
    /** 顶栏右侧的开关按钮 */
    topBarAction?: boolean
    /** 全屏覆盖层 */
    overlay?: boolean
  }
}

/* ------------------------------------------------------------- 主进程侧 */

/** 插件方法被调用时拿到的上下文 */
export interface PluginInvokeContext {
  /** 当前主窗口，可能为空 */
  window: unknown
  /** 仓库/工作区根目录（打包态下回退到用户数据目录） */
  workspaceRoot: string
  /** 当前图库根目录 */
  libraryRoot: string
  log: (message: string) => void
}

export type PluginMethodHandler = (payload: unknown, ctx: PluginInvokeContext) => unknown | Promise<unknown>

/** 宿主交给插件的装配接口 */
export interface MainPluginHost {
  readonly manifest: PluginManifest
  readonly workspaceRoot: string
  /** 注册一个可以从渲染进程调用的方法 */
  method(name: string, handler: PluginMethodHandler): void
  log(message: string): void
}

export interface MainPluginModule {
  manifest: PluginManifest
  /** 应用就绪后被调用一次 */
  activate(host: MainPluginHost): void | Promise<void>
  /** 应用退出前调用 */
  deactivate?(): void | Promise<void>
}

/* ------------------------------------------------------------- 渲染进程侧 */

export interface PluginTopBarActionProps {
  active: boolean
  toggle: () => void
}

export interface PluginOverlayProps {
  active: boolean
  onActiveChange: (active: boolean) => void
  /** 当前界面标识（gallery / lightbox / crawl / settings） */
  view: string
  appVersion: string
  onToast: (message: string) => void
}

/** 渲染侧插件模块：两个插槽都是可选的 */
export interface RendererPluginModule {
  manifest: PluginManifest
  TopBarAction?: ComponentType<PluginTopBarActionProps>
  Overlay?: ComponentType<PluginOverlayProps>
}

/** 运行时装配好的渲染侧插件 */
export interface LoadedRendererPlugin {
  manifest: PluginManifest
  TopBarAction?: ComponentType<PluginTopBarActionProps>
  Overlay?: ComponentType<PluginOverlayProps>
}

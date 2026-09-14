import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin as VitePlugin } from 'vite'

/* --------------------------------------------------------------- 基础信息 */

// app.getVersion() 在开发态下返回的是 Electron 版本（应用目录不是仓库根），
// 所以版本号在构建期直接注入，保证界面与档案里显示的都是真实的应用版本。
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

/* --------------------------------------------------------------- 插件发现 */

interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  dependsOn?: string[]
  ui?: { topBarAction?: boolean; overlay?: boolean }
}

const pluginsRoot = resolve('plugins')

/**
 * 决定这一轮构建装载哪些插件。
 *   GUGU_PLUGINS=devlog    -> 只装指定插件
 *   GUGU_PLUGINS=          -> 一个都不装（发布用，产物里不会出现插件代码）
 *   未设置                  -> 读 plugins/plugins.json
 */
function resolveEnabledPluginIds(): string[] {
  const fromEnv = process.env.GUGU_PLUGINS
  const ids =
    fromEnv !== undefined
      ? fromEnv.split(',').map((s) => s.trim()).filter(Boolean)
      : ((JSON.parse(readFileSync(resolve(pluginsRoot, 'plugins.json'), 'utf8')) as { enabled?: string[] })
          .enabled ?? [])
  return ids.filter((id) => existsSync(resolve(pluginsRoot, id, 'plugin.json')))
}

function readManifest(id: string): PluginManifest {
  return JSON.parse(readFileSync(resolve(pluginsRoot, id, 'plugin.json'), 'utf8')) as PluginManifest
}

const enabledIds = resolveEnabledPluginIds()

/** 依赖缺失的插件会被剔除并告警，避免构建期直接炸掉 */
const loadableManifests = enabledIds.map(readManifest).filter((m) => {
  const missing = (m.dependsOn ?? []).filter((dep) => !enabledIds.includes(dep))
  if (missing.length > 0) {
    console.warn(`[gugu] 插件 ${m.id} 依赖缺失，已跳过: ${missing.join(', ')}`)
    return false
  }
  return true
})
const loadableIds = loadableManifests.map((m) => m.id)

const define = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __GUGU_PLUGINS__: JSON.stringify(loadableManifests)
}

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@plugins': resolve('plugins')
}

/* ----------------------------------------------- 渲染侧插件入口（虚拟模块） */

/**
 * 把启用的插件渲染入口聚合成一个虚拟模块。
 * 一个插件都不装时这里生成空数组，产物里自然就没有插件的任何代码。
 */
function virtualPluginEntries(): VitePlugin {
  const virtualId = 'virtual:gugu-plugins'
  const resolvedId = '\0' + virtualId
  return {
    name: 'gugu:virtual-plugins',
    resolveId: (id) => (id === virtualId ? resolvedId : null),
    load(id) {
      if (id !== resolvedId) return null
      const entries = loadableIds
        .map((pid) => resolve(pluginsRoot, pid, 'renderer', 'index.tsx'))
        .filter((file) => existsSync(file))
      const imports = entries
        .map((file, i) => `import plugin${i} from ${JSON.stringify(file)}`)
        .join('\n')
      const list = entries.map((_, i) => `plugin${i}`).join(', ')
      return `${imports}\nexport const rendererPlugins = [${list}]\n`
    }
  }
}

const mainInput: Record<string, string> = {
  index: resolve('src/main/index.ts'),
  cli: resolve('src/main/cli.ts')
}
for (const id of loadableIds) {
  const entry = resolve(pluginsRoot, id, 'main', 'index.ts')
  if (existsSync(entry)) mainInput[`plugins/${id}`] = entry
}

/* ------------------------------------------------------------------ 配置 */

export default defineConfig({
  main: {
    define,
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: mainInput,
        // 插件产物固定为 out/main/plugins/<id>.js，宿主按这个名字动态加载
        output: { entryFileNames: '[name].js' }
      }
    }
  },
  preload: {
    define,
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve('src/preload/index.ts') } }
    }
  },
  renderer: {
    define,
    root: resolve('src/renderer'),
    resolve: { alias },
    plugins: [react(), virtualPluginEntries()],
    build: {
      rollupOptions: { input: { index: resolve('src/renderer/index.html') } }
    }
  }
})

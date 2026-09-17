/**
 * 渲染层构建配置（Tauri 外壳）。
 *
 * 与 electron.vite.config.ts 的 renderer 段保持一致：同一套 define / alias /
 * 插件虚拟模块，产物同样落到 out/renderer —— 这样界面代码与插件代码完全不用改。
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin as VitePlugin } from 'vite'

interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  dependsOn?: string[]
  ui?: { topBarAction?: boolean; overlay?: boolean }
}

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }
const pluginsRoot = resolve('plugins')

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
const loadableManifests = enabledIds.map(readManifest).filter((m) => {
  const missing = (m.dependsOn ?? []).filter((dep) => !enabledIds.includes(dep))
  if (missing.length > 0) console.warn(`[gugu] 插件 ${m.id} 依赖缺失，已跳过: ${missing.join(', ')}`)
  return missing.length === 0
})
const loadableIds = loadableManifests.map((m) => m.id)

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

export default defineConfig({
  root: resolve('src/renderer'),
  // Tauri 用自定义协议提供静态资源，相对路径最稳
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GUGU_PLUGINS__: JSON.stringify(loadableManifests)
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@plugins': resolve('plugins')
    }
  },
  plugins: [react(), virtualPluginEntries()],
  build: {
    outDir: resolve('out/renderer'),
    emptyOutDir: true,
    rollupOptions: { input: { index: resolve('src/renderer/index.html') } }
  },
  server: { port: 5173, strictPort: true }
})

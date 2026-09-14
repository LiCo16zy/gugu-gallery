# 插件开发指南

插件是**可选的能力扩展**，默认不进发布产物。适合放：开发期工具、协作工具、
实验性功能、只在内部用的诊断面板。

## 目录约定

```
plugins/<id>/
├── plugin.json            必需：清单
├── SKILL.md               建议：给使用者/智能体的操作手册
├── README.md              建议：实现说明
├── shared/                可选：与其它插件共享的类型
├── main/index.ts          可选：主进程侧（会被编译成独立 chunk）
├── renderer/index.tsx     可选：渲染进程侧（会被打进界面 bundle）
└── bin/*.mjs              可选：可复用的命令行程序
```

在 `plugins/plugins.json` 的 `enabled` 里登记才会被装载。

## plugin.json

```json
{
  "id": "my-tool",
  "name": "我的工具",
  "version": "1.0.0",
  "description": "一句话说明它解决什么问题",
  "dependsOn": ["devlog"],
  "ui": { "topBarAction": true, "overlay": true }
}
```

`dependsOn` 在构建期校验：依赖不在 `enabled` 里就自动跳过并告警，不会让构建失败。

## 主进程侧

```ts
// plugins/my-tool/main/index.ts
import type { MainPluginHost, MainPluginModule, PluginManifest } from '@shared/plugin'
import manifestJson from '../plugin.json'

const manifest = manifestJson as PluginManifest

const plugin: MainPluginModule = {
  manifest,
  activate(host: MainPluginHost) {
    // workspaceRoot 由宿主注入：开发态是仓库根，打包后回退到用户数据目录
    host.log('工作区: ' + host.workspaceRoot)

    host.method('doSomething', async (payload, ctx) => {
      // ctx.window    当前主窗口（可能为空）
      // ctx.libraryRoot 当前图库根目录
      return { ok: true }
    })
  }
}

export default plugin
```

渲染进程这样调用：

```ts
const result = await window.gugu.plugins.invoke('my-tool', 'doSomething', { foo: 1 })
```

**核心不需要为插件新增任何 IPC 通道**，preload 与 ipc.ts 都不用改。

## 渲染进程侧

```tsx
// plugins/my-tool/renderer/index.tsx
import type { PluginOverlayProps, PluginTopBarActionProps, RendererPluginModule } from '@shared/plugin'
import manifestJson from '../plugin.json'

function TopBarAction({ active, toggle }: PluginTopBarActionProps) { /* ... */ }
function Overlay({ active, onActiveChange, view, appVersion, onToast }: PluginOverlayProps) { /* ... */ }

const plugin: RendererPluginModule = {
  manifest: manifestJson as RendererPluginModule['manifest'],
  TopBarAction,
  Overlay
}

export default plugin
```

两个插槽都是可选的：

- `TopBarAction` —— 顶栏右侧的开关按钮
- `Overlay` —— 全屏覆盖层，自行决定要不要渲染内容

宿主在 `src/renderer/src/App.tsx` 里遍历所有已加载插件渲染这两个插槽，
同一时刻只允许一个插件的覆盖层处于 `active`。

## 构建时发生了什么

`electron.vite.config.ts` 读取装载清单后：

1. 主进程：把每个 `plugins/<id>/main/index.ts` 加成独立入口，产物落在 `out/main/plugins/<id>.js`
2. 渲染进程：生成虚拟模块 `virtual:gugu-plugins`，把所有启用的渲染入口聚合起来
3. 注入 `__GUGU_PLUGINS__`（清单数组），宿主据此决定运行时加载哪些 chunk

一个插件都不装时，虚拟模块是空数组，主进程也没有插件 chunk —— 产物里就是干净的图库应用。

`scripts/release.mjs` 会在构建后**实际扫描产物**：
检查 `out/main/plugins/` 是否为空、渲染 bundle 里有没有插件特征串。
「以为排除了其实没有」这种事必须被自动抓住。

## 开发流程

```bash
# 开发（装载 plugins.json 里登记的插件）
npm run dev

# 只装某几个插件调试
GUGU_PLUGINS=devlog npm run dev

# 确认发布产物里没有插件
npm run build:release
```

## 注意事项

- **插件可以读环境变量，但不要依赖主进程的内部模块路径** ——
  用 `host` 给的上下文，别自己算 `__dirname`
- **插件异常不应该拖垮应用**：宿主对 `activate()` 做了 try/catch，
  装载失败的插件会被跳过并打日志
- **渲染侧插件不要 import 应用源码**（`src/renderer/...`）。
  需要类型就从 `@shared/*` 拿，需要能力就走 `window.gugu`
- 插件之间的共享类型放在**被依赖方**的 `shared/` 里，并在 `dependsOn` 中声明，
  依赖关系在类型层面就是显式的

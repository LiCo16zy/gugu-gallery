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
├── renderer/index.tsx     可选：渲染进程侧（会被打进界面 bundle）
└── bin/*.mjs              可选：可复用的命令行程序
```

在 `plugins/plugins.json` 的 `enabled` 里登记才会被装载。

> 主进程侧不再是插件目录里的 TS 模块 —— Tauri 没有 Node 运行时，
> 需要主进程能力时把实现写在 `src-tauri/src/plugins/` 里（见下）。

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

`dependsOn` 在构建期与运行时都校验：依赖不在 `enabled` 里就自动跳过并告警，不会让构建失败。

## 主进程侧（Rust）

```rust
// src-tauri/src/plugins/my_tool.rs
use serde_json::{json, Value as Json};

pub fn do_something(
    app: &tauri::AppHandle,
    workspace: &std::path::Path,
    payload: Json,
) -> Result<Json, String> {
    let _ = (app, workspace, payload);
    Ok(json!({ "ok": true }))
}
```

然后在 `src-tauri/src/plugins/mod.rs` 的分发里登记：

```rust
match (plugin_id, method) {
    ("my-tool", "doSomething") => my_tool::do_something(app, &workspace_root(), payload.unwrap_or(Json::Null)),
    // ...
    _ => Err(format!("插件 {plugin_id} 没有注册方法 {method}")),
}
```

渲染进程这样调用（与旧版一模一样）：

```ts
const result = await window.gugu.plugins.invoke('my-tool', 'doSomething', { foo: 1 })
```

**核心不需要为插件新增任何 IPC 通道**，`window.gugu` 的契约不用改。

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

## 构建与启用时发生了什么

1. `vite.renderer.config.ts` 读装载清单，生成虚拟模块 `virtual:gugu-plugins`，
   把所有启用的渲染入口聚合进界面 bundle；
2. Rust 侧的清单由 `src-tauri/src/plugins/mod.rs` 在**运行时**读 `plugins/plugins.json`；
3. **插件只在 debug 构建里启用**（`debug_assertions` + 仓库根存在）——
   发布版返回空清单，也不用担心装了插件工具的用户看到一堆开发按钮。

一个插件都不装（`GUGU_PLUGINS=`）时，虚拟模块是空数组，界面就是干净的图库应用。

`scripts/release.mjs` 会在构建后**实际扫描产物**：渲染 bundle 与可执行文件里有没有插件特征串。
「以为排除了其实没有」这种事必须被自动抓住。

## 开发流程

```bash
# 开发（装载 plugins.json 里登记的插件）
npm run tauri:dev

# 只装某几个插件调试
GUGU_PLUGINS=devlog npm run dev:web

# 确认发布产物里没有插件
npm run dist
```

## 注意事项

- **插件不要依赖仓库里的绝对路径** —— 工作区根目录由宿主解析
  （`GUGU_WORKSPACE` → 仓库根 → 用户数据目录）
- **插件异常不应该拖垮应用**：宿主对每次调用做了错误返回，
  装载失败的插件会被跳过并打日志
- **渲染侧插件不要 import 应用源码**（`src/renderer/...`）。
  需要类型就从 `@shared/*` 拿，需要能力就走 `window.gugu`
- 插件之间的共享类型放在**被依赖方**的 `shared/` 里，并在 `dependsOn` 中声明，
  依赖关系在类型层面就是显式的

# devlog · 开发过程档案

把每一轮有体量的迭代归档下来，让开发过程可回溯、可展示。

- **怎么用**：看 [`SKILL.md`](SKILL.md)
- **目录长什么样**：见仓库根 `devlog/`
- **宿主契约**：实现 `MainPluginModule`，用 `host.method()` 注册两个方法

## 对外方法

渲染进程通过 `window.gugu.plugins.invoke('devlog', '<method>', payload)` 调用：

| 方法 | 入参 | 返回 |
| --- | --- | --- |
| `listRounds` | — | `RoundInfo[]` |
| `exportAnnotations` | `ExportPayload` | `ExportResult` |

`exportAnnotations` 会：截图整页 → 按 devicePixelRatio 换算并裁切每条标注的局部图 →
写出 `annotations.json` / `annotations.md` / `README.md` 骨架。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `main/index.ts` | 插件入口，注册方法 |
| `main/store.ts` | 轮次目录管理与导出落盘 |
| `main/render.ts` | Markdown / README 生成 |
| `shared/types.ts` | 标注与轮次类型（annotator 复用） |
| `bin/round.mjs` | 轮次 CLI：list / new / finalize / inbox |

## 为什么把类型放在 shared

标注工具需要构造 `ExportPayload`，档案工具需要消费它。
放在 devlog 的 `shared/` 里，annotator 通过 `@plugins/devlog/shared/types` 引用，
与 `plugin.json` 中 `"dependsOn": ["devlog"]` 的声明一一对应 —— 依赖关系在类型层面就是显式的。

# 插件（可选工具）

这里放的是**开发与协作期**才需要的工具。它们默认**不会进入发布产物** ——
`npm run dist` 走的是 `scripts/release.mjs`，会把 `GUGU_PLUGINS` 置空，
构建完还会实际校验产物里没有插件代码。

```
plugins/
├── plugins.json              装载清单，构建期读取
├── annotator/                页面标注工具（依赖 devlog）
│   ├── plugin.json
│   ├── SKILL.md              给使用者/智能体的操作手册
│   ├── README.md
│   ├── renderer/             界面部分（被渲染进程打包）
│   └── bin/check.mjs         自检程序
└── devlog/                   开发过程档案
    ├── plugin.json
    ├── SKILL.md
    ├── README.md
    ├── shared/types.ts       标注与轮次类型（annotator 复用它）
    ├── main/                 主进程部分（编译成独立 chunk，运行时按需加载）
    └── bin/round.mjs         轮次管理程序
```

## 装载与卸载

`plugins/plugins.json`：

```json
{ "enabled": ["devlog", "annotator"] }
```

- 去掉某一项 → 它的代码**完全不会**进入构建产物
- 依赖缺失（`annotator` 需要 `devlog`）→ 构建期告警并自动跳过，不会炸
- 临时改动不想动文件时，用环境变量覆盖：`GUGU_PLUGINS=devlog npm run build`

## 现有插件

| 插件 | 作用 | 入口 | 依赖 |
| --- | --- | --- | --- |
| `annotator` | 在真实界面上点选/框选写批注，导出成可执行的修改说明 | 应用内 `Ctrl+Shift+A` 或顶栏笔形按钮 | `devlog` |
| `devlog` | 把每轮迭代的标注、截图与代码差异归档到 `devlog/rounds/` | 无界面，被 annotator 调用，另配 CLI | — |

## 写一个新插件

见 `docs/plugin-development.md`。
最小插件只需要两个文件：`plugin.json` 和一个 `main/index.ts` 或 `renderer/index.tsx`。

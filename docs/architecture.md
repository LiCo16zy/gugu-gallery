# 架构与目录结构

## 一句话

Electron + React + TypeScript 的桌面应用：主进程负责抓取与数据，
渲染进程只负责画界面；可选工具以插件形式挂载，默认不进发布产物。

## 目录结构

```
gugu/
├── src/                       应用本体（发布产物只含这里）
│   ├── main/                  Electron 主进程
│   │   ├── index.ts           入口：窗口、自定义协议、截图自检钩子
│   │   ├── cli.ts             无界面 CLI 抓取
│   │   ├── context.ts         依赖装配（设置 / 库 / 库表 / 引擎）
│   │   ├── config.ts          设置持久化
│   │   ├── ipc.ts             核心 IPC（不含任何插件相关通道）
│   │   ├── plugins.ts         插件宿主
│   │   ├── workspace.ts       工作区根目录解析
│   │   ├── crawler/           site / parser / http / engine
│   │   ├── store/             schema / db(sql.js) / repository
│   │   └── media/             library / thumbnail
│   ├── preload/index.ts       contextBridge 白名单
│   ├── renderer/              React 界面
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx        壳：布局、路由、状态
│   │       ├── plugins.ts     插件宿主（渲染侧）
│   │       ├── api.ts         桥接 + 展示层格式化
│   │       ├── styles.css     手写设计系统
│   │       └── components/    Sidebar / GalleryGrid / Lightbox / CrawlPanel / SettingsPanel / Icons
│   └── shared/                两端共享的纯类型
│       ├── types.ts           领域模型
│       ├── bridge.ts          preload 暴露的 API 契约
│       ├── plugin.ts          插件契约
│       └── globals.d.ts       构建期注入的全局声明
├── plugins/                   可选工具（默认不进发布产物）
├── scripts/                   仓库级工具
│   ├── shot.mjs               界面截图
│   ├── uicheck.mjs            界面交互回归
│   ├── e2e.mjs                真实站点端到端
│   └── release.mjs            无插件发布构建 + 产物校验
├── tests/                     单元测试与真实 HTML 样本
├── docs/                      文档
├── devlog/                    开发过程档案
└── data/                      本地运行产物（gitignored）
```

## 分层与边界

```
渲染进程 (React)
   │  只能通过 window.gugu（preload 白名单）访问外部能力
   ▼
preload  ──  contextBridge 暴露 GuguBridge
   │
   ▼
主进程
   ├── ipc.ts        核心能力：设置 / 图库查询 / 抓取控制
   ├── plugins.ts    插件路由：plugin:list / plugin:invoke
   ├── crawler/      站点适配 → HTTP（重试/限速/校验）→ 引擎调度
   ├── store/        SQLite(WASM) 仓储
   └── media/        磁盘布局、缩略图、下载
```

**安全边界**：渲染进程没有 Node 集成、开了 `contextIsolation`，
所有文件访问都过 `Library.resolveInside()` 做越权检查，
图片只能来自 `gugu:` 自定义协议或本地，页面加载了 CSP。

## 数据流

**抓取**

```
列表页 ──解析──> items 索引 ──过滤──> 下载队列 ──详情页补全──> 原图下载 ──> 落盘 ──> 缩略图
```

两阶段的理由：索引极快（1430 页约十几分钟，几乎不耗流量），
可以先把全站元数据拿下来，再从容决定下载哪些。

**浏览**

```
React 组件 ──gugu://thumb/<id>──> protocol.handle ──> 本地缩略图流
           ──gugu://media/<id>──> 同上（查看原图）
```

## 为什么这么选

| 决定 | 理由 | 代价 |
| --- | --- | --- |
| sql.js（WASM SQLite） | 本机没有 MSVC，原生模块装不上；换来零编译 | 整库常驻内存，写盘靠整库导出 |
| 缩略图用 Electron 的 nativeImage | 免掉 sharp/jimp 这类依赖，1080p→512px 约 10ms | 只能在主进程用 |
| 无 UI 库，手写 CSS | 设计可控、依赖少 | 样式要自己维护 |
| 插件默认不进产物 | 工具代码不该出现在给用户的应用里 | 需要一套构建期装载机制 |
| 分页用 LIMIT/OFFSET | 几万条量级下更快也更简单 | 到百万级要换 keyset |

## 相关文档

- [站点逆向笔记](./site-analysis.md)
- [插件开发指南](./plugin-development.md)
- [开发档案说明](../devlog/README.md)

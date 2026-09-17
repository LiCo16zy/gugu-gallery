# 架构与目录结构

## 一句话

**Tauri 2（Rust）+ React + TypeScript**：Rust 侧负责抓取、索引、文件、会话与系统集成，
React 只负责画界面；两边靠 `window.gugu` 这一份契约对话。
可选工具（页面标注、开发过程档案）以插件形式挂载，默认不进发布产物。

## 目录结构

```
gugu/
├── src-tauri/                  应用本体（Rust，发布产物就是它）
│   ├── src/
│   │   ├── main.rs             入口：命令注册、窗口、自定义协议、自检钩子
│   │   ├── cli.rs              无界面命令行模式 + imgdiff
│   │   ├── shot.rs             窗口截图（PrintWindow）与 GUGU_SHOT 流程
│   │   ├── library.rs          图库目录布局、越权检查、文件名规则
│   │   ├── settings.rs         设置持久化（userData/settings.json）
│   │   ├── session.rs          会话 cookie（Windows 凭据管理器）与校验
│   │   ├── media.rs            自定义协议 gugu:// → 缩略图 / 原图
│   │   ├── store/              schema / 查询 / 写入（rusqlite）
│   │   ├── crawler/            site / parser / http / engine（+ 解析器单测）
│   │   └── plugins/            插件宿主 + devlog（轮次档案 / 标注导出）
│   ├── build.rs                版本号与仓库根注入
│   ├── tauri.conf.json         窗口、CSP、打包配置
│   └── icons/                  应用图标
├── src/renderer/               React 界面
│   ├── index.html
│   └── src/
│       ├── App.tsx             壳：布局、路由、状态、插件插槽
│       ├── tauri-bridge.ts     把 Tauri 的 invoke/listen 装成 window.gugu
│       ├── plugins.ts          插件宿主（渲染侧）
│       ├── api.ts              桥接 + 展示层格式化
│       ├── styles.css          手写设计系统
│       └── components/         Sidebar / GalleryGrid / Lightbox / CrawlPanel / SettingsPanel / Icons
├── src/shared/                 两端共享的纯类型与纯函数
│   ├── types.ts                领域模型
│   ├── bridge.ts               window.gugu 的 API 契约（外壳唯一耦合点）
│   ├── plugin.ts               插件契约
│   └── categories.ts           应用分类表（含单测）
├── plugins/                    可选工具（默认不进发布产物）
├── scripts/                    仓库级工具（起 Vite / 跑应用 / 截图 / 自检 / 发布）
├── tests/                      前端单测与真实 HTML 样本
├── docs/                       文档
├── devlog/                     开发过程档案
└── data/                       本地运行产物（gitignored）
```

## 分层与边界

```
React 渲染层
   │  只能通过 window.gugu（contract 在 src/shared/bridge.ts）
   ▼
src/renderer/src/tauri-bridge.ts   ── 把 invoke / listen 装成 window.gugu
   │  Tauri IPC（命令名与 bridge 一一对应）
   ▼
src-tauri/src/main.rs
   ├── 命令层        设置 / 图库查询 / 抓取控制 / 登录态 / 插件 / 窗口
   ├── plugins/      插件路由：(插件 id, 方法名) → Rust 实现
   ├── crawler/      站点适配 → HTTP（重试/限速/校验）→ 引擎调度
   ├── store/        索引库（rusqlite，bundled SQLite）
   └── media.rs      磁盘布局、缩略图、自定义协议
```

**安全边界**：渲染层没有 Node 集成，只能调用注册过的命令；
所有文件访问都过 `Library::resolve_inside()` 做越权检查；
页面加载了 CSP，图片只能来自 `gugu://` 自定义协议或 `data:`/`blob:`，外链只放行 `http/https`；
会话 cookie 存在 Windows 凭据管理器里，账号密码从不经过本应用。

## 数据流

**抓取**

```
列表页 ──解析──> items 索引 ──过滤──> 下载队列 ──详情页补全──> 原图下载 ──> 落盘 ──> 缩略图
```

两阶段的理由：索引极快（1430 页约十几分钟，几乎不耗流量），
可以先把全站元数据拿下来，再从容决定下载哪些。

**浏览**

```
React 组件 ──http://gugu.localhost/thumb/<id>──> register_asynchronous_uri_scheme_protocol
           ──http://gugu.localhost/media/<id>──> 同上（查看原图）
```

（`gugu://` 是同一个协议的 Tauri 写法；Windows 上 WebView2 走的是 `http://gugu.localhost` 形式，
路径形状 `/thumb/<id>`、`/media/<id>` 与旧版保持一致。）

## 为什么这么选

| 决定 | 理由 | 代价 |
| --- | --- | --- |
| 外壳换 Tauri 2，界面原样复用 | `window.gugu` 是唯一耦合点，换外壳不用改界面 | 主进程侧（爬虫 / 存储 / 会话 / 插件）全部重写成 Rust |
| rusqlite（bundled SQLite） | 不再整库常驻内存，"零原生编译依赖"换成"自带 SQLite" | 需要 Rust 工具链才能构建 |
| 图片走自定义协议 | 渲染层拿不到文件路径，也不需要 `file://` 权限 | 协议层要把路径与越权检查再做一遍 |
| 无 UI 库，手写 CSS | 设计可控、依赖少 | 样式要自己维护 |
| 插件默认不进产物、只在 debug 启用 | 工具代码不该出现在给用户的应用里 | 需要构建期装载机制 + Rust 侧宿主 |
| 分页用 LIMIT/OFFSET | 几万条量级下更快也更简单 | 到百万级要换 keyset |

## 相关文档

- [站点逆向笔记](./site-analysis.md)
- [插件开发指南](./plugin-development.md)
- [发布流程](./release-process.md)
- [开发档案说明](../devlog/README.md)

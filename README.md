# 咕咕图库 · GuguGallery

> 针对 [咕咕小站](https://www.guguxz.com/)（ACG 图片分享站）的**桌面端爬虫 + 本地图库浏览器**。
> 抓取 → 索引 → 下载原图 → 生成缩略图 → 用漂亮的界面翻看，全流程离线可用。

Electron + React + TypeScript，索引用 WebAssembly 版 SQLite（**零原生编译依赖**，`npm install` 之后直接能跑）。

---

## 目录

- [它长什么样](#它长什么样)
- [功能](#功能)
- [快速开始](#快速开始)
- [图库目录结构](#图库目录结构)
- [数据模型](#数据模型)
- [爬虫是怎么设计的](#爬虫是怎么设计的)
- [命令行模式](#命令行模式)
- [插件机制](#插件机制)
- [页面标注工具](#页面标注工具)
- [开发过程档案](#开发过程档案)
- [开发与测试](#开发与测试)
- [已知限制](#已知限制)
- [合规声明](#合规声明)

---

## 它长什么样

界面分三块：**左侧资料库导航**（全部 / 收藏 / 已下载 / 待下载 / 分类树 / 热门标签）、
**顶部搜索与排序**、**主区瀑布流网格**。点开任意一张进入灯箱，右侧是完整元数据面板，
支持缩放、键盘翻页、一键跳到 Pixiv 原作品、在资源管理器中定位本地文件。

四个主界面：图库网格、灯箱详情、抓取任务、设置。

> 想自己看到效果：`npm run build && npm run shot`，截图会输出到 `screenshots/`。

---

## 功能

**爬虫**

- 分类 / 关键词搜索 / 月排行 / 首页最新，四种抓取入口
- 两阶段流水线：先建立**索引**（只抓列表页，极省流量），再按条件**下载原图**
- 下载的是**真·原图**（站点 `dw=true` 通道），不是列表页那个压缩预览图（体积差 ~5 倍）
- 自动抓详情页补全 **Pixiv 作品 ID、画师主页、完整标签**
- 标签包含 / 排除、最小宽度 / 最小体积、最大条数、页码范围等过滤条件
- 实时进度（页数 / 条目 / 下载数 / 速率 / 预计剩余）、运行日志、暂停 / 继续 / 取消
- 崩溃友好的**断点续爬**：已抓过的列表页记录在 `page_marks`，可跳过
- 下载落 `.part` 再原子改名，中断不会在库里留下半个文件

**图库**

- 瀑布流网格，滚动到底自动翻页加载
- 按分类 / 标签 / 收藏 / 下载状态 / 横竖构图筛选，支持多标签 AND、7 种排序
- 灯箱查看：缩放、拖拽、键盘 ←/→/Esc/±/F，缩略图条快速跳转
- 收藏、评分、`在资源管理器中打开`、单张下载、连同本地文件一起删除
- 深色 / 浅色主题 + 7 种主题色

**稳健性**（这个站点的接口**很不稳**，这部分不是可选功能）

- 请求带 `Referer`，否则图片接口直接 403
- 完整性校验：HTML 必须以 `</html>` 收尾、图片必须 Content-Length 对得上
- 指数退避重试（默认 4 次）+ 请求节流 + 并发闸门
- 用**魔数**判断真实图片格式（站点大量存在 `.png` 实际是 JPEG 的货不对板）
- 单条失败不影响整体，队列继续推进并记入日志

---

## 快速开始

```bash
# 需要 Node >= 20
npm install

# 开发模式（主进程 + 渲染进程热更新）
npm run dev

# 构建 + 本地预览
npm run build
npm start

# 打包（release/ 下产出免安装目录与安装包）
npm run pack     # 只生成 release/win-unpacked，快
npm run dist     # 生成 NSIS 安装包
```

> **Windows 打包提示**：`electron-builder` 解压 `winCodeSign` 时会创建符号链接，
> 普通用户权限下会报 `Cannot create symbolic link`。此时 `release/win-unpacked/` 已经生成完毕，
> 里面的 `GuguGallery.exe` 是可以直接运行的免安装版本；想要安装包则需要以管理员身份运行，
> 或者打开「设置 → 隐私和安全性 → 开发者选项 → 开发人员模式」后重试。

首次启动会提示图库目录，默认 `<图片>/GuguGallery`。也可以在「设置 → 图库位置」里随时更改，
换目录会切换到另一套独立的索引与文件（旧库原样保留）。

> **网络提示**：`npm install` 需要下载 Electron 二进制。若卡住，在项目根目录建一个 `.npmrc`：
>
> ```
> electron_mirror=https://npmmirror.com/mirrors/electron/
> ```
>
> 之后正常 `npm install` 即可。

### 第一次抓取建议

1. 打开「抓取」页 → 选择 `ACG图片 / Pixiv萌图`
2. 「最多处理条目」填 `20`，「结束页」填 `2` —— 先跑个小样看看效果
3. 点「开始抓取」
4. 回到「图库」页，图片会随着抓取陆续出现

确认没问题后，把页码范围放开，让它在后台慢慢跑整站索引。

---

## 图库目录结构

图库是完全自包含的，拷走就能用，没有本应用也能直接翻图：

```
<图库根目录>/
├── index.db                           SQLite 索引（元数据 + 标签 + 文件表）
├── originals/
│   └── ACG图片/
│       └── Pixiv萌图/
│           ├── 19519_碧蓝档案-小鸟游星野泳装-pid115534247.png
│           └── 19518_女孩子-插画-pid118770165.jpg
├── thumbs/
│   └── 19519.jpg                      最长边 512px 的 JPEG 缩略图
└── .tmp/                              下载中转，程序启动时自动清空
```

文件命名可在设置里切换：`编号_标签`（默认）/ `仅编号` / `Pixiv ID` / `内容哈希`。

---

## 数据模型

索引库是标准 SQLite，可以直接用任何工具打开查询。六张表：

| 表 | 作用 |
| --- | --- |
| `items` | 站点条目（一次投稿 = 一张图）：编号、标题、尺寸、体积、上传者、浏览量、发布时间、Pixiv ID、画师、分类、原图相对路径、收藏 / 评分 |
| `tags` / `item_tags` | 标签字典与多对多关系 |
| `files` | 本地已下载文件：相对路径、缩略图路径、真实格式 / 尺寸 / 体积、SHA-256 |
| `sources` | 抓取源（一级分类 + 二级分类 / 关键词），含条目数与最后抓取时间 |
| `jobs` | 抓取任务留痕：阶段、参数、统计、起止时间 |
| `page_marks` | 每个列表页的抓取记录，断点续爬的依据 |

设计上的两个取舍：

- **`items` 与 `files` 分开**：站点的一条投稿未来可能对应多张图（或多种规格），
  拆开之后「只索引不下载」和「下载了但没有元数据」两种状态都能自然表达。
- **缩略图路径不入 `items` 而入 `files`**：它描述的是本地文件，不是站点数据。
  删除本地文件时只清 `files` 那一行，索引里的元数据还在，重新下载即可。

分页用 **LIMIT/OFFSET**（`cursor` 字段就是 offset 的字符串形式）。在几万条量级下 SQLite
走覆盖索引扫偏移非常快，比 keyset 分页少一大截复杂度；真到了百万级再换成 keyset 即可。

---

## 爬虫是怎么设计的

完整的站点逆向笔记见 [`docs/site-analysis.md`](docs/site-analysis.md)，这里只讲结论。

### 站点要点

| 项目 | 结论 |
| --- | --- |
| 列表页 | `/search/index/plate/{一级}/wd/{二级}.html?page=N`，每页 10 条，页码超界返回空列表 |
| 详情页 | `/archives/image/plate/{一级}/wd/{二级}/id/{id}.html` |
| 预览图 | `/index/imageBed?item=<base64(相对路径)>` → 302 到 CDN，**压缩过** |
| 原图 | `/index/imageBed?item=<相对路径>&dw=true` → 302 到 CDN，**无损原图** |
| 防盗链 | `imageBed` 必须带 `Referer: https://www.guguxz.com/`，否则 403 |
| 拿到 CDN 签名地址后 | 再请求 CDN **不需要** Referer |
| 扩展名 | 完全不可信，`.png` 经常实际是 JPEG，必须靠魔数判断 |
| robots.txt | `Disallow:`（全站允许），本项目仍保持保守的抓取速率 |

### 关键的工程决策

**1. 为什么能从列表页直接拿到原图地址？**

列表页每张卡片的 HTML 注释里藏着原图相对路径：

```html
<!--https://files.guguxz.com/tc/?item=d/y/orig/acbab8/item/0b70bb331c620d066380564c077ed4f5.png-->
<img src="https://www.guguxz.com/index/imageBed?item=ZC95L29yaWcvYWNiYWI4L2l0ZW0v...png" ... />
```

把 `item=` 后面的 base64 解出来就是 `d/y/orig/<桶>/item/<md5>.<ext>`。有了它就能直接拼
`...&dw=true` 拿原图，**不必为了下载而先访问详情页**。详情页只在需要 Pixiv ID / 完整标签时
才抓一次（可开关）。

**2. 为什么重试不是可选项？**

实测这个站点的失败率：

```
直连顺序请求 12 个列表页 → 3 次失败（连接挂死 20s 或响应被截断在 618 字节）
并发 4~6 请求           → 失败率约 30%
```

失败表现是「连接挂住到超时」或「响应在中途断掉但 HTTP 状态仍是 200」。两种都不会抛网络异常，
所以必须靠**内容校验**发现：HTML 要求以 `</html>` 结尾，图片要求实际字节数等于 `Content-Length`。
发现异常就退避重试，几乎总能成功。

**3. 两阶段流水线**

```
列表页 ──解析──> items 索引（元数据 + 标签 + 原图路径）
                      │
                      ├── 按标签/尺寸/数量过滤 ──> 下载队列
                      │                              │
                      │                        详情页补全（可选）
                      │                              │
                      └──────────────────────> 原图下载 ──> 魔数嗅探 ──> 落盘 ──> 缩略图
```

这样设计的好处：索引极快（1430 页大约十几分钟，几乎不耗流量），你可以先把整站元数据拿下来，
再从容决定要下载哪些标签的图。

**4. 并发与限速**

默认列表页并发 2、下载并发 3、请求间隔 220ms。实测这个组合既能跑满带宽（约 1.4 MB/s），
失败率也压得比较低。调高会更频繁地触发上面的截断问题，但因为有重试兜底，不一定更慢 —— 建议
自己试几组。

---

## 命令行模式

不打开界面直接抓取，适合放进计划任务：

```bash
npm run build

# 抓 3 页并下载，最多 60 张
npm run crawl:dev -- --plate ACG图片 --word Pixiv萌图 --pages 3 --max 60

# 只建索引，抓 50 页
npm run crawl:dev -- --index-only --pages 50

# 只保留含指定标签的图，排除另一些
npm run crawl:dev -- --max 100 --include 碧蓝档案,女孩子 --exclude 泳装

# 指定图库目录与限速
npm run crawl:dev -- --library D:/Pictures/GuguGallery --delay 300 --concurrency 2
```

| 参数 | 说明 |
| --- | --- |
| `--plate` / `--word` | 一级 / 二级分类，默认 `ACG图片 / Pixiv萌图` |
| `--from` / `--pages` | 起始页与页数 |
| `--max` | 最多处理多少条 |
| `--index-only` | 只建索引不下载 |
| `--no-enrich` | 不抓详情页（更快，但没有 Pixiv ID） |
| `--include` / `--exclude` | 标签白名单 / 黑名单，逗号分隔 |
| `--delay` / `--concurrency` | 请求间隔与并发 |
| `--library` | 图库目录（也可用环境变量 `GUGU_LIBRARY_ROOT`） |
| `--quiet` | 不打日志 |

---

## 插件机制

标注工具和开发档案都是**可选插件**，默认不进发布产物 —— 工具代码不该出现在给最终用户的应用里。

```jsonc
// plugins/plugins.json
{ "enabled": ["devlog", "annotator"] }   // 去掉哪项，它的代码就完全不会被打包
```

- 主进程插件产物按需生成在 `out/main/plugins/<id>.js`，运行时动态加载
- 渲染进程用虚拟模块聚合插件入口，禁用时生成空数组
- 渲染进程统一走 `window.gugu.plugins.invoke(id, method, payload)` ——
  **新增插件不需要改 preload / ipc，核心代码零改动**
- 依赖缺失（`annotator` 需要 `devlog`）会在构建期告警并自动跳过，插件装载失败也不会拖垮应用
- `npm run build:release` 构建完会**实际扫描产物**，确认没有插件残留：
  主进程无 `out/main/plugins/`，渲染 bundle 330KB → 303KB，CSS 36.2KB → 25.3KB

完整的插件契约与开发指南见 [`docs/plugin-development.md`](docs/plugin-development.md)，
插件索引见 [`plugins/README.md`](plugins/README.md)。

## 页面标注工具

> 这是一个**可选插件**（`plugins/annotator`），发布构建时不会打进应用。
> 详见 [`plugins/annotator/SKILL.md`](plugins/annotator/SKILL.md)。

专门为「审阅界面 → 提修改意见」做的工具，开发模式下**按 `Ctrl+Shift+A` 打开**（顶栏右侧也有个笔形按钮）。

用法：

1. 打开后默认是**浏览**模式，不拦截任何点击 —— 正常操作应用，翻到你想提意见的那一屏
   （比如打开某张图的灯箱、切到抓取面板、把窗口拖成你常用的尺寸）
2. 切到**点选**：鼠标悬停时实时高亮元素并显示它属于哪个组件；点一下某个元素即可写批注
3. 或者切到**框选**：按住左键拖出一个矩形，给一整片区域提意见
4. 每条批注可以标类别（视觉样式 / 布局结构 / 文案内容 / 交互行为 / 缺陷 / 其它）
   和优先级（必须改 / 建议改 / 锦上添花）
5. 右下角「标注清单」可以回看、跳转、编辑、删除
6. 点「导出标注」→ 填一句总体说明 → 确认

导出会在 `devlog/rounds/` 下生成一个新轮次目录，包含：

- `annotations.md` / `annotations.json` —— 每条批注的**原文**，外加自动采集的执行信息：
  **组件名、CSS 选择器、父级链、元素文本、关键计算样式（字号/颜色/间距/圆角/阴影…）、WCAG 对比度**、
  以及标注框的坐标尺寸
- `screenshots/00-full.png` —— 导出时的整页截图
- `screenshots/001-xxx.png` —— **每条标注自动裁切的局部截图**

> 为什么记录得这么细：批注里写「这个按钮太小」是无法执行的，而执行改动的人（或 AI）
> 未必看得到界面。所以工具把选择器、当前字号、当前颜色、当前间距全都记下来，
> 拿到 `annotations.md` 就能直接定位到源码位置、并知道当前值是多少、要改成什么。

标注只会写进 `devlog/`，**不会修改任何代码**，可以放心多点几下。

## 开发过程档案

> 这也是一个**可选插件**（`plugins/devlog`）。详见 [`plugins/devlog/SKILL.md`](plugins/devlog/SKILL.md)。

每一轮迭代的「快照 + 说明 + 前后对照截图」都归档在 `devlog/`，用于回溯与对外展示。
轮次索引见 `devlog/index.json`。

**平时改代码只管 commit 就行，不需要每次都建档案。**
只在有体量的迭代（一批界面修改、一次重构、一个功能从无到有）时才开一轮。

```bash
npm run round -- inbox               # 打印最新未收尾轮次的内容（拿到反馈的标准入口）
npm run round -- list                # 列出所有轮次
npm run round -- new <slug>          # 开一轮：建目录 + 起始截图 + 元数据
npm run round -- finalize <轮次ID>   # 收尾：改动后截图 + 代码 diff + 更新说明 + 打 tag
```

每个轮次目录长这样：

```
devlog/rounds/0002-xxx/
├── README.md             背景 / 改动 / 验证 / 遗留
├── annotations.md        界面标注原文（人会读的版本）
├── annotations.json      界面标注原始数据（机器可读）
├── changes.md            代码差异概览（变更文件清单 + 统计）
├── changes.patch         完整代码差异，可 git apply
├── screenshots/          本轮界面截图
├── screenshots-before/   改动前（用于前后对照）
└── screenshots-after/    改动后（用于前后对照）
```

收尾时会自动打一个 `round/<轮次ID>` 的 git tag，
所以任何一轮都能用 `git checkout round/0002-xxx` 完整复原。
起点是 [`devlog/rounds/0001-baseline/`](devlog/rounds/0001-baseline/README.md)。

## 开发与测试

```bash
npm run dev        # 开发模式（主进程 + 渲染进程热更新）
npm run typecheck  # 主进程 / 渲染进程分别做严格类型检查
npm test           # 单元测试：解析器、URL 规则、格式嗅探（23 例）
npm run e2e        # 真连目标站点跑一次端到端，校验索引与磁盘产物
npm run uicheck    # 启动真实界面点一遍关键路径（17 项交互断言）
npm run annotatecheck  # 驱动标注工具走完「点选 → 批注 → 框选 → 导出」（18 项断言）
npm run shot       # 自动截图四个界面到 screenshots/
npm run build:release  # 无插件构建，并校验产物里确实没有插件代码
npm run dist       # 打包安装包（自动走无插件构建）
```

四层验证各有分工：

| 命令 | 覆盖范围 | 是否需要联网 |
| --- | --- | --- |
| `npm test` | HTML 解析、URL 规则、base64、格式嗅探 | 否 |
| `npm run uicheck` | 渲染、筛选、搜索、灯箱、键盘、主题、分类树 | 否（用本地图库） |
| `npm run annotatecheck` | 标注工具的交互与导出产物 | 否（用临时目录） |
| `npm run e2e` | 真实抓取 → 下载 → 落盘 → 缩略图 | 是 |
| `npm run build:release` | 产物里不含任何插件代码 | 否 |

- 单元测试用的是**真实抓下来的 HTML 样本**（`tests/fixtures/`），
  站点改版时测试会第一时间失败，比人肉发现快。
- `npm run e2e` / `uicheck` / `shot` 支持 `GUGU_LIBRARY_ROOT` 指定图库目录、
  `GUGU_SETTINGS_FILE` 指定配置文件，可以用一份隔离的数据集做回归，不会污染日常使用中的配置。
- `uicheck` 与 `shot` 靠应用内建的 `GUGU_SHOT` / `GUGU_EVAL` 钩子驱动：
  主进程会在加载完成后注入一段脚本、采集 `capturePage()` 截图和 DOM 体检数据。

### 代码结构

```
src/                          应用本体 —— 发布产物只含这里
├── main/                     Electron 主进程
│   ├── index.ts              入口：窗口、自定义协议、截图自检钩子
│   ├── cli.ts                无界面 CLI 抓取
│   ├── context.ts            依赖装配（设置 / 图库 / 库表 / 引擎）
│   ├── config.ts             设置持久化（userData/settings.json）
│   ├── ipc.ts                核心 IPC —— 不含任何插件相关通道
│   ├── plugins.ts            插件宿主
│   ├── workspace.ts          工作区根目录解析
│   ├── crawler/              site / parser / http / engine
│   ├── store/                schema / db(sql.js) / repository
│   └── media/                library / thumbnail
├── preload/index.ts          contextBridge 白名单
├── renderer/                 React 界面（无 UI 库，纯手写 CSS 设计系统）
│   └── src/
│       ├── App.tsx           壳：布局、路由、状态、插件插槽
│       ├── plugins.ts        插件宿主（渲染侧）
│       ├── api.ts            桥接 + 展示层格式化
│       ├── styles.css        设计系统
│       └── components/       Sidebar / GalleryGrid / Lightbox / CrawlPanel / SettingsPanel / Icons
└── shared/                   两端共享的纯类型
    ├── types.ts              领域模型
    ├── bridge.ts             preload 暴露的 API 契约
    ├── plugin.ts             插件契约
    └── globals.d.ts          构建期注入的全局声明

plugins/                      可选工具 —— 默认不进发布产物
├── plugins.json              装载清单
├── annotator/                页面标注工具（renderer + bin）
└── devlog/                   开发过程档案（main + shared + bin）

scripts/                      仓库级工具
├── shot.mjs                  界面截图
├── uicheck.mjs               界面交互回归
├── e2e.mjs                   真实站点端到端
└── release.mjs               无插件发布构建 + 产物校验
```

完整分层说明与设计取舍见 [`docs/architecture.md`](docs/architecture.md)。

**安全边界**：渲染进程没有 Node 集成、开了 `contextIsolation`，只能调用 preload 暴露的
白名单方法；所有文件访问都经过 `Library.resolveInside()` 做越权检查；
页面加载了 CSP，图片只能来自 `gugu:` 自定义协议或本地。

---

## 已知限制

- **没有做登录态**：站点需要登录才能看的内容（收藏、投稿、评论）不在抓取范围内。
- **索引在内存里**：sql.js 是 WASM 版 SQLite，整库常驻内存、写盘靠整库导出（1.5s 防抖）。
  十万条量级（索引约 100 MB）仍可用，再大就该换 `better-sqlite3` 之类了 —— 本机没有 MSVC
  工具链，装不了原生模块，所以才这么选。
- **不做图片去重**：同一张图重复投稿会各自存一份。`files.sha256` 已经存下来了，将来加
  硬链接去重很容易。
- **站点改版即失效**：解析全部基于当前 HTML 结构，改版后需要更新 `parser.ts`（有样本测试兜底）。
- **抓取速率保守**：默认并发 2~3、间隔 220ms，抓完 Pixiv 萌图全站（约 1.4 万张、几百 GB）
  需要很久。这是有意为之。

---

## 合规声明

- 本项目仅用于**个人离线浏览与学习研究**，请勿用于商业用途或大规模镜像。
- 抓取到的图片**版权归原作者与投稿人所有**，转载 / 二次使用请遵守原站规则与 Pixiv 作者授权。
- 请遵守目标站点的 `robots.txt` 与服务条款，**保持合理抓取速率**，不要给站点造成压力。
  项目默认值偏保守，调高并发与降低间隔造成的后果由使用者自行承担。
- 仓库内 `tests/fixtures/` 下的 HTML 样本仅用于解析器回归测试。

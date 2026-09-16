# 轮次 0014-phase2-refactor-and-multiplatform

- 时间：2026-09-16
- 起点提交：`3408d51`（= **v0.6.3 首个发布版**，已推到 GitHub 并联带安装包发布）
- 阶段目标：**项目重构与优化 + 多端移植（Windows + Android）**
- 本轮状态：**分析 / 技术验证完成，等待用户确认后再动重构**

---

## 一、开工前确认：仓库完整性（用户要求先确认）

| 项目 | 状态 |
| --- | --- |
| master | `3408d51`，与本地 HEAD 完全一致（`git status` 干净） |
| 标签 | 14 个：`round/0001`…`round/0013` + `v0.6.3`（指向 `3408d51`） |
| Release | **已发布**：`v0.6.3` 页面列出附件 `GuguGallery-Setup-0.6.3.exe` |
| 源码可复现性 | 全部源码 + `package.json` / `package-lock.json` + 构建脚本（`scripts/release.mjs`、`scripts/fix-wincodesign.mjs`）都在仓库里，任一台机器 `npm ci && npm run dist` 即可重建安装包 |

**结论：第一次发布的构建版本已经完整保存在 GitHub 上** —— 源码、标签、安装包三样齐全，本地工作目录损坏不影响它。本地独有、但**可再生**的东西：`release/`（安装包与免安装目录）、`data/`（图库，含精简后的 demo）、`out/`（构建产物）、`node_modules/`；它们的生成方式都在仓库文档与脚本里。

> 本机限制（实测）：能从 GitHub 拉代码（SSH/Git 正常），但**下载 GitHub Release 资产不通**（`objects.githubusercontent.com` 连不上，`curl -r 0-1023` 返回 000）。这条在后面的工具链下载里会再遇到一次。

---

## 二、上下文压缩（这一阶段的「项目速查」）

**是什么**：针对 guguxz.com 的桌面爬虫 + 本地图库浏览器。抓取 → 索引 → 下载原图 → 缩略图 → 界面浏览。

**技术栈（重构前基线）**：Electron 33 + React 18 + TypeScript（electron-vite 构建）；
索引 = WASM 版 SQLite（`sql.js`，零原生模块，因为本机没有 MSVC 工具链）；缩略图 = Electron `nativeImage`。

**代码规模（13,184 行）**

| 部分 | 文件 | 行数 |
| --- | --- | --- |
| 主进程（后端：爬虫 / 存储 / 媒体 / IPC） | 17 | 4,164 |
| preload 桥 | 1 | 126 |
| shared（类型 / 分类 / 桥契约） | 5 | 550 |
| 渲染层（React + CSS 设计系统） | 15 | 6,166 |
| 插件（标注工具 1,778 / 开发档案 400） | 8 | 2,178 |

**关键约束**：本机无 MSVC 工具链（所以当初选 sql.js 而不是 better-sqlite3）；抓的是第三方站点，接口不稳（约 25~30% 请求失败，靠重试 + 完整性校验兜底）；登录态只存会话 cookie（DPAPI 加密）。

**自检体系**（重构后的等价性验收要靠它们）：`npm test` 30 例、`npm run uicheck` 63 项交互断言、
`npm run annotatecheck` 37 项、`npm run e2e`（真连站点）、`npm run build:release`（产物不含插件）。

**开发流程**：每轮有体量的迭代建一个 `devlog/rounds/<id>/`（截图 + 标注 + diff + 说明 + `round/<id>` 标签）；
界面意见用内置的页面标注工具（Ctrl+Shift+A）导出结构化标注驱动下一轮。

---

## 三、体积分析：为什么这么大（实测）

`release/win-unpacked` = **292 MB**，安装包（NSIS/LZMA）= **85 MB**。拆开看：

| 组成 | 体积 | 说明 |
| --- | --- | --- |
| `GuguGallery.exe` | **180.1 MB** | Electron 运行时 = Chromium + V8 + Node，**这是地板，改不掉** |
| `locales/` | 41 MB | Chromium 的 50 多种语言包，我们只用中文/英文 |
| `resources/app.asar` | 24 MB | 应用代码 + 生产依赖 |
| GPU / 多媒体 DLL | ~11 MB | libGLESv2 8.0、vk_swiftshader 5.3、d3dcompiler 4.7、ffmpeg 2.8 |
| 其余 | ~36 MB | 各种 .pak / .bin / v8 快照等 |

**asar 里的 24 MB 有 23 MB 是浪费**：我们只用到 `sql.js` 的 `dist/sql-wasm.wasm`(658 KB) + `sql-wasm.js`(46 KB)，
但打包时把整个 npm 包塞进去了 —— 里面还躺着 `sql-asm-debug.js`(5.6 MB)、`worker.sql-asm-debug.js`(5.6 MB)、
`sqljs-all.zip`(4.4 MB)、多个 asm.js 变体与调试 wasm。**光这一项就能省下 ~23 MB 解包体积（安装包约 -7 MB）。**

**留在 Electron 能榨出多少**：删多余 locales（-40 MB 解包）+ 过滤 sql.js（-23 MB）+ 可选去掉 swiftshader
→ 安装包从 85 MB 大致能到 **60~65 MB**。**天花板就在 Chromium 那 180 MB。**

---

## 四、技术选型分析

### 约束（这台机器上的实测）

| 约束 | 现状 |
| --- | --- |
| 目标平台 | Windows + Android（Mac/Linux 暂不考虑） |
| 动画与交互 | 必须与现有桌面端一致或接近（瀑布流、灯箱缩放/拖拽、进场动画、沉浸模式…） |
| MSVC / Visual Studio | **没有** |
| Rust | 原来没有，**本轮已装好并通过验证**（1.98.1，GNU 宿主） |
| JDK | 有（21.0.10） |
| Flutter / Dart | 没有 |
| Android SDK / NDK | 没有（`ANDROID_HOME` 未设置） |
| WebView2 运行时 | **已存在**（`EdgeWebView\Application\145.0.3800.82`） |
| 磁盘 | C: 26 GB 可用，D: 12 GB 可用 |

### 候选对比

| 方案 | Windows 安装包 | Android | UI 复用 | 需要装什么 | 判断 |
| --- | --- | --- | --- | --- | --- |
| **A. Electron 瘦身** | 85→60 MB | **不支持** | 100% | 无 | 到不了 Android，只能当过渡 |
| **B. Tauri 2**（Rust + WebView2） | **~3 MB** | 支持（系统 WebView） | **~100%（现有 React 原样跑）** | Rust✓（已装）、Android SDK/NDK | **推荐** |
| C. Compose Multiplatform（Kotlin） | ~40~60 MB（含 JRE） | 支持 | **0%（整个 UI 用 Kotlin 重写）** | Gradle、Android SDK | 备选：UI 全重写，成本最高 |
| D. Flutter | ~20 MB | 支持 | 0%（Dart 重写） | Flutter SDK + **Visual Studio/MSVC** | 本机缺 MSVC，被卡住 |
| E. .NET MAUI / Avalonia | ~30 MB | 支持 | 0% | .NET SDK（本机损坏）+ VS | 不现实 |

### 为什么推荐 Tauri：先量了一下「UI 与 Electron 的耦合度」

- 渲染层调用 Electron 的入口**只有一个**：`window.gugu.*`，共 **29 个方法 / 33 处调用**；
- 渲染层里**没有任何** Node / Electron API（`require` / `ipcRenderer` / `process` 都没有），
  唯一出现 "electron" 的地方是设置页显示版本号的文案；
- 图片 URL（`gugu://thumb/<id>`、`gugu://media/<id>`）是**主进程拼好**再交给渲染层的 → 换一套自定义协议即可。

也就是说：**6,166 行界面 + 整套 CSS 设计系统与动画几乎可以原样搬过去**，要重写的只有 4,840 行后端（爬虫 / 存储 / 媒体 / IPC）。
对比 Compose 方案要把 6,166 行 React 全量重写成 Kotlin —— 交互细节还得重新对齐一遍，风险和工作量都大一个量级。

---

## 五、技术验证（本轮已完成）

| 验证项 | 结果 |
| --- | --- |
| Rust 工具链（无 MSVC） | **通过**：rustup（GNU 宿主）+ `rustc 1.98.1`；`rustc main.rs` 编译链接并运行成功（用 MSYS2 的 gcc 做链接器，全程不需要 MSVC） |
| crates.io | 可达，`cargo add serde_json` 正常解析依赖 |
| WebView2 运行时 | 本机已有 `145.0.3800.82` → 不需要随包分发浏览器内核 |
| **Tauri 2 端到端 PoC** | **通过**：`cargo build --release` 成功（release profile 开了 `lto + strip + opt-level=s`），产物 **gugu-poc.exe = 3.1 MB** |
| PoC 真机运行 | **通过**：启动后弹出一个 1014×738 的原生窗口，内容由 WebView2 渲染我方 HTML（见下方截图） |
| NSIS 安装包 | **未完成**：打包器要下 `nsis-3.11.zip`（GitHub Releases 资产），本机连不上 `objects.githubusercontent.com`，下载卡住 |
| Android 目标 | 未验证（需先装 Android SDK + NDK + Rust Android target） |

对比同口径的 Electron：**3.1 MB vs 180 MB（可执行文件）**；安装包预计 2~3 MB vs 85 MB。
WebView2 在 Win10 1803+ 基本都自带，即使没有，Tauri 也能引导用户装（几百 KB 的 bootstrapper 或提示）。

验证截图：`screenshots-verify/tauri-poc-window.png`（Tauri 窗口 + WebView2 渲染的 HTML）。

---

## 六、重构方案（**待用户确认后才动手**）

**目标架构**：Tauri 2 外壳（Rust 后端）+ **复用现有 React 渲染层**。

需要迁移的部分：

| 现在（Electron） | 迁移到 | 工作量 |
| --- | --- | --- |
| 38 个 preload 方法 / IPC 通道 | Tauri commands + events | 机械活，但数量多 |
| `gugu://thumb|media` 自定义协议 | Tauri 自定义协议（同名保留，渲染层无感） | 小 |
| `sql.js`（WASM SQLite，整库在内存里） | **rusqlite / sqlx**（原生 SQLite，且不再整库进内存） | 中，顺带解决「十万条后内存吃紧」 |
| Electron `nativeImage` 缩略图 | Rust `image` crate（WebP/JPEG 编码） | 小 |
| `safeStorage`（DPAPI） | `windows` crate 直接调 DPAPI（或 keyring） | 小 |
| Electron `net`（代理） | `reqwest` + proxy | 小 |
| 爬虫（http/parser/engine，约 2.5k 行） | Rust 重写 | **最大的一块** |
| 打包（electron-builder → Tauri bundler） | 重写发布脚本 | 小 |

**分阶段**（每阶段都保持可运行、可回退；分支开发，不动 master）：

1. **骨架**：Tauri 2 工程 + 把现有 `out/renderer` 原样接进来（用一个 mock 桥先把界面跑起来，验证视觉/动画一致）
2. **桥 + 库**：Rust 侧实现 settings / library（stats、facets、query、item、收藏、删除、reveal）
3. **爬虫**：http（重试/限速/完整性校验）、parser（列表/详情/分页）、engine（索引 + 下载 + 进度事件）
4. **媒体**：原图落盘、魔数嗅探、缩略图、自定义协议
5. **登录态 / 设置 / CLI**
6. **打包 + 自检**：Tauri bundler 出 NSIS；`uicheck` 等脚本改指向新壳
7. **对等性验收**：现有 **30 单测 + 63 项 uicheck + 37 项标注自检** 全部通过（脚本照旧跑同一套界面）

**验收口径（重要）**：界面与交互**不允许回退** —— 现有 63 项 uicheck 断言就是逐条交互契约，
重构后必须同样通过；新增 Rust 侧的单测覆盖解析与存储。

**风险**
- 站点接口；GNU 宿主下个别 crate 的构建（PoC 已验证主流链路 OK）
- Tauri 的 NSIS 打包需要下载 GitHub 资产（本机不通）→ 可能需要换下载源或手工放缓存
- Android 侧需要 Android SDK + NDK（数 GB），本机 C 盘 26 GB 可用但不宽裕

---

## 七、遗留与待确认

1. **确认技术方向**：按 Tauri 2（复用 React UI + Rust 后端）重构 —— 用户确认后动手。
2. 确认后要装的东西：Android SDK + NDK（可延后到 Android 阶段）、NSIS 工具（打包阶段）。
3. 重构期间**不对外发布**：只在本地/分支迭代，重构完成 + 用户实测通过后再提 PR。

---

## 八、里程碑 1：Tauri 骨架跑通（已完成）

分支 `refactor/tauri-2`。这一步只干一件事：**证明「界面可以原样搬到 Tauri」**。

**新增**

- `src-tauri/`：`Cargo.toml`（tauri 2 + serde）、`build.rs`（注入 package.json 的版本号）、
  `tauri.conf.json`（无边框窗口、CSP 放行 IPC、NSIS 打包配置）、`src/main.rs`（按 @shared/bridge 契约注册了 35 个命令，先返回占位数据）、`icons/`
- `vite.renderer.config.ts`：与 `electron.vite.config.ts` 的 renderer 段同源（同一套 define / alias / 插件虚拟模块），产物同样落 `out/renderer`
- 脚本：`dev:web` / `build:web` / `tauri:dev` / `tauri:build`

**渲染层的改动只有一个文件**：`src/renderer/src/tauri-bridge.ts`（在 `main.tsx` 里最先求值，
因为 `api.ts` 在模块加载时就把 `window.gugu` 抓走了）。它把 38 个桥方法逐一映射到 `invoke`，
**6,166 行界面与 CSS 一行未改** —— 这正是选 Tauri 的核心收益。

**踩到的坑**：`index.html` 里原有的 CSP `default-src 'self'` 会把 Tauri 的 IPC 全部拦掉，
必须补 `connect-src 'self' ipc: http://ipc.localhost`（自定义协议后面也要加进 `img-src`）。

**证据**：`screenshots-verify/tauri-ui-milestone1.png` —— 真实界面在 Tauri 窗口里渲染出来了：
侧栏资料库、筛选栏（排序 / 日期 / 全部 / 收藏 / 已下载 / 待下载 / 横图 / 竖图）、
空态文案、深色主题与主题色全部正确；数据来自 Rust 侧占位实现。

**体积对照**：debug 产物 213MB（带调试信息，不代表最终体积）；release + `lto` + `strip` 的 PoC 实测 **3.1MB**。

**下一步**：按模块把占位实现换成真实现 —— store（rusqlite + repository）→ media（落盘 / 魔数 / 缩略图 → 自定义协议）
→ crawler（http / parser / engine）→ session（DPAPI）→ 打包（NSIS）→ 对等性验收（30 单测 + 63 uicheck + 37 标注断言）。

---

## 九、里程碑 2：存储层 + 图片协议（已完成）

**存储层换成原生 SQLite**（`rusqlite`，bundled 编译，不需要装 SQLite）：`src-tauri/src/store/`
把 `schema.ts` + `repository.ts` 整段搬过来，筛选 / 排序 / 分页 / facets / stats / 收藏 / 评分 / 删除
逐条对齐，SQL 语句与 `buildWhere` / `buildOrder` 保持同一语义 —— 否则界面上那 63 项交互断言就失去意义了。
顺带解决了老架构的一个遗留问题：**索引不再整库常驻内存**（sql.js 是 WASM 版，写盘靠整库导出）。

**其他新模块**

- `library.rs`：图库布局、越权检查（`resolve_inside`）、命名策略（`safe_segment` / `build_slug` / `ext_of`）
- `settings.rs`：`settings.json` 读写，沿用 `%APPDATA%/gugu-gallery` —— 老用户升级后设置与登录凭据都还在
- `media.rs`：图片协议。渲染层拿到的地址本来由后端拼，所以这里保持 `/thumb/<id>` `/media/<id>` 的路径形状，
  按 WebView2 的约定换成 `http://gugu.localhost/...`，**渲染层无感**
- 自检钩子：`GUGU_EVAL` 注入脚本 + `debug_report` 命令把结果以 `__EVAL__` 前缀打回 stdout，
  沿用 Electron 版的 harness 约定（`scripts/uicheck.mjs` 将来只需换掉 spawn 的那一行）

**验证（真机）**

| 检查 | 结果 |
| --- | --- |
| 真实数据 | 侧栏 2,129 条、已下载 5、待下载 2,124、分类 Pixiv萌图 2129、热门标签 15 个全部正确（直接读 demo 库） |
| 图片协议 | 切到「已下载」→ 共 5 条，5 张缩略图全部经 `http://gugu.localhost/thumb/<id>` 加载成功（尺寸 512×512 / 512×353 / 315×512 …） |
| 踩坑记录 | 给桥加 `__report` 时手滑把 `return {` 改成 `const bridge = {`，导致 `window.gugu` 变成 undefined、整页白屏 —— 自检钩子上线后，这类问题一条 eval 就能定位（后来干脆删掉了那个自检专用 API，harness 直接走 `__TAURI_INTERNALS__`） |

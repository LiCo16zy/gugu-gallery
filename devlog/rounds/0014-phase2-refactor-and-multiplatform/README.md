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

---

## 十、里程碑 3：爬虫迁移完成（索引 + 下载全链路）

**新增** `src-tauri/src/crawler/`：

- `site.rs`：URL 规则 / 路径编解码 / 人类可读体积换算（与 site.ts 对齐）
- `parser.rs`：列表页 / 详情页 / 分页 / 导航解析（与 parser.ts 对齐）
- `http.rs`：reqwest 客户端 —— 重试 + 退避、请求节流、并发闸门、HTML 完整性校验、
  下载落 `.part` 后原子改名、魔数嗅探
- `engine.rs`：两阶段流水线（索引 → 下载），进度事件走 `crawl://progress`，
  支持暂停 / 继续 / 取消；页码范围同时作用于索引与下载
- `probe` 模式：`gugu-gallery.exe probe [页码]` 无界面探一条列表页，
  爬虫改动不用起界面就能验证（也是将来 CLI 的种子）

**真机验证**：索引 1 页 → 10 条；按 `maxItems=3` 下载 → 3 张全部成功，
文件名与旧版一致（`19542_碧蓝档案-紧身裤.png`），缩略图生成、魔数修正扩展名
（`.png` 实际是 JPEG 的情况会改名）、`files` 表与真实尺寸/体积都写对。

**踩坑记录（值得记下来）**

1. **reqwest 关掉 default-features 会顺手关掉 TLS** —— 请求直接失败且报错含糊。
   Windows 上加回 `default-tls`（走 schannel，不需要 OpenSSL）。
2. **Rust 的 regex 不支持 lookahead** —— `size_re` 里的 `(?=…)` 直接 panic。
   改成「把分隔符也捕获进来」的等价写法。
3. **模板套模板时反斜杠会被吃掉** —— `\s` 写成 `\s` 之外的形式会静默变成 `s`，
   正则不报错、只是永远匹配不到（表现为「第 1 页没有内容」）。
   现在解析器里的正则统一用 `[[:space:]]` / `[0-9]` 这类**不含反斜杠**的写法，
   必须用反斜杠的地方一律写双反斜杠并额外 grep 校验。

---

## 十一、里程碑 4：自检体系搬到 Tauri，交互断言全绿

**改了什么**

- `scripts/uicheck.mjs` 改成驱动 Tauri 应用：先起 Vite 开发服务器（debug 构建走 devUrl），
  再用 `GUGU_EVAL` 注入同一段自检脚本；harness 约定不变（`__EVAL__{ok,result,consoleErrors}`）
- Rust 侧补上 `GUGU_EVAL` 钩子 + `debug_report` 命令（结果直接打到 stdout）
- 新增 `GUGU_SESSION_EPHEMERAL=1`：自检时不读写系统凭据库，
  否则「未登录」类断言会被开发机上的真实登录态污染（第一次跑就踩到了）
- 窗口尺寸对齐 Electron 版（1480×940 / 最小 1040×660）
- 三条与分辨率耦合的断言改成不依赖窗口宽度：
  「标准视图 4 栏 / 紧凑 6 栏 / 切回 4 栏」→「至少 2 栏 / 紧凑多于标准 / 切回恢复原列数」
  （列数是容器宽度的函数，钉死 4/6 只对开发机那台屏幕成立）

**结果**：`node scripts/uicheck.mjs` **63 项全部通过**（跑在 Tauri 应用上）。
Rust 侧的解析器单测也补齐了：`cargo test` **16 项全部通过**（样本与 Electron 版同一批 `tests/fixtures/`）。

至此，界面的交互契约在新外壳下逐条复核完毕。

---

## 十二、里程碑 5：登录态、系统集成、目录选择器

- `session.rs`：会话 cookie 交给**系统凭据库**（Windows 凭据管理器，DPAPI 保护、绑定当前账户），
  不保存账号密码；校验沿用旧版三信号判据（泳装类分享 / 退出 / 登录注册）；
  指纹只暴露头尾 4 位；`GUGU_SESSION_EPHEMERAL=1` 时不碰凭据库（自检用）
- 系统集成：`openExternal`（只放行 http/https）、`copyText`（剪贴板插件）、
  `reveal`（资源管理器定位文件）
- 目录选择器接上 dialog 插件：回调式 API + oneshot 回传，不阻塞主线程
- 引擎支持会话变化时更新 cookie（`set_cookie`）

**真机验证**：把一份 cookie 存进去 → 校验返回 `state=out`（这份 cookie 已被站点轮换掉），
指纹显示 `8i77…gk34`，与 curl 直接验证的结果一致 —— 说明校验逻辑对了，而不是「总是失败」。

**遗留（下一批）**：GUGU_SHOT 截图（devlog / uicheck 的截图输出）、插件宿主（标注导出 / 轮次档案）、
删除 Electron 代码、README 与文档更新。NSIS 打包的工具链缓存已备好（见第十三节），实际出包留到重构验收后。

---

## 十三、发布链路（GitHub Release 资产）实测

用户要求「暂时不打包，但先把 GitHub Release 资产这条路讲清楚」，于是把打包器与上传通路都实测了一遍。

**本机网络事实（实测）**

| 通路 | 结果 |
| --- | --- |
| `github.com` / `api.github.com` / `uploads.github.com`（HTTPS 直连） | ✗ 全部 `000` |
| `git@github.com`（SSH） | ✓ 正常（v0.6.3 的代码与标签就是这么推的） |
| `objects.githubusercontent.com`（资产直链） | ✗ `000` |
| `ghproxy.net`（GitHub 资产镜像） | ✓ `206`，下回来的文件 SHA1 与官方一致 |
| `go.microsoft.com` → `msedge.sf.dl.delivery.mp.microsoft.com` | ✓ `301`/`206` |

> 顺带确认：Windows 系统代理配置里存着 `127.0.0.1:10808`，但 `ProxyEnable=0` 且该端口没有监听 ——
> 所以「浏览器能上 GitHub、命令行不能」不是错觉，是代理没开。

**读打包器源码得到的确切事实**（`tauri-bundler 2.9.4`，比文档更可靠）

- NSIS 工具链：`nsis-3.11.zip`（SHA1 `EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D`）
  + `nsis_tauri_utils.dll`（v0.5.3，SHA1 `75197FEE3C6A814FE035788D1C34EAD39349B860`），
  缓存目录 `%LOCALAPPDATA%\tauri\NSIS\`（必需文件清单见 `NSIS_REQUIRED_FILES`）；
  WebView2 引导程序单独缓存在 `%LOCALAPPDATA%\tauri\MicrosoftEdgeWebview2Setup.exe`
- 镜像支持：`TAURI_BUNDLER_TOOLS_GITHUB_MIRROR`（基础 URL，直接拼路径）与
  `TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE`（占位符 `<owner>/<repo>/<version>/<asset>`）；
  两者都只对 `https://github.com/…` 生效，另外标准代理环境变量也认

**做完的事**：把工具链缓存一次性放好（NSIS 7.9 MB + WebView2 1.84 MB，共 9.7 MB），
13 个必需文件逐个核验存在，两个下载物的 SHA1 与官方完全一致。
**打包阶段现在可以完全离线跑**，不再受「下不了 GitHub 资产」影响。

**上传的三条路**（详见新增的 `docs/release-process.md`）：浏览器上传 / `gh` CLI / REST API ——
三条都需要能访问 `github.com`；外加第四条**推荐通路**：标签推送触发 GitHub Actions
（`tauri-apps/tauri-action`）在云端出包并挂资产，GitHub 的机器走内网，本机只需要 `git push`（SSH，通）。

新增文档：`docs/release-process.md`（版本号同步、产物命名、工具链补法、本地打包、四种上传方式、
发布前检查清单）。

---

## 十四、里程碑 6：截图自检（GUGU_SHOT）搬到 Tauri

- 新增 `src-tauri/src/shot.rs`：窗口截图走 PrintWindow（`PW_CLIENTONLY | PW_RENDERFULLCONTENT`）
  + `GetDIBits` 取像素 → BGRA 转 RGBA → PNG / JPEG 编码。
  契约与 Electron 版逐字一致：视图切换仍用 `gugu:navigate` 事件，
  `GUGU_SHOT / GUGU_SHOT_VIEW / GUGU_SHOT_DELAY / GUGU_SHOT_SETTLE / GUGU_SHOT_FORMAT / GUGU_DIAG / GUGU_EVAL` 全部照旧，
  产物仍是 `<视图|home>.<png|jpg>` 与 `<视图>-after-eval.<ext>`
- 新增两个命令：`debug_diag`（沿用 `__DIAG__<视图>__<json>` 约定）与
  `shot_after_eval`（渲染进程跑完 eval 后回调，补拍再退出）
- 退出时机：有 `GUGU_EVAL` → 补拍后退出；只有体检 → 体检输出后退出；两者都没有 → 截图完就退出
- `windows` 依赖 0.58 → 0.61：必须与 tauri 用同一个 crate 版本，否则 `WebviewWindow::hwnd()`
  拿到的 HWND 与自己声明的那套类型对不上
- 脚本：新增 `scripts/tauri-app.mjs`（找产物 / 起 Vite / 跑一次应用并收输出），
  `scripts/shot.mjs` 改成用它，不再依赖 Electron 二进制与 `out/main`

**真机验证**：`node scripts/shot.mjs gallery crawl settings` 三个视图都出图（1850×1092，
窗口被屏幕高度收窄是正常的），`__DIAG__` 输出正常（2,129 条、60 张卡片、28 个标签 chip）；
`node scripts/uicheck.mjs` 在「截图 → 体检 → eval → 补拍 → 退出」新流程下**仍然全绿**，
并产出 `screenshots/uicheck/home.png` 与 `home-after-eval.png`。

**踩坑**：Windows 上 `npm run dev:web` 会再 fork 一层，`child.kill()` 只干掉中间那层，
孙进程继续握着管道，Node 脚本就僵着不退出（第一次跑把 10 分钟墙钟直接耗光）。
现在开发服务器的输出写进 `data/dev-server.log` 而不是管道，收工用 `taskkill /T /F` 连整棵树一起收，
脚本末尾再显式退出。

---

## 十五、里程碑 7：插件宿主搬到 Tauri（标注导出 / 轮次档案）

Electron 版的主进程插件是运行时 import 的 JS 模块；Tauri 没有 Node 运行时，
于是把**主进程侧**直接实现成 Rust：

- `src-tauri/src/plugins/mod.rs`：宿主 —— 读 `plugins.json` 出清单（含依赖齐全判据），
  按 `(插件 id, 方法名)` 分发，核心代码不知道具体插件的存在
- `src-tauri/src/plugins/devlog.rs`：轮次目录管理 + 标注导出，与 `main/{store,render}.ts` 行为对齐

**方法面只有两个**，与旧版逐个对齐：`devlog.listRounds`、`devlog.exportAnnotations`。

**导出产物逐项对齐**：

- `screenshots/00-full.png` 整页截图（复用 `shot::capture_rgba`，为此把抓屏函数开放出来）
- 每条标注一张裁片：DPR 换算 + 12/24 像素留白 + 边界钳制
- `annotations.json` 直接落**原始 payload** 的 annotations（不过结构体再序列化，避免丢 `pageRect/scroll`）
- `annotations.md` / `README.md`（后者只在缺失时写）：类别/优先级中文标签、父级链、
  关键样式与属性、引用块、`slugify`（清半角+全角标点、空白转 `-`、截 28 字符）全部照搬

**启用条件**：插件只在 debug 构建里启用（`debug_assertions` + 仓库根存在）。
发布产物本来就不打包插件代码，所以清单直接返回空 —— 与渲染层 `GUGU_PLUGINS` 的闸门一致。

`plugins/annotator/bin/check.mjs` 改指 Tauri 应用（Vite + debug exe）。

**真机验证**：`node plugins/annotator/bin/check.mjs` **37 项全部通过** ——
工具开关、点选/框选、批注框、图钉、导出提示、轮次目录、`annotations.json`（2 条）、
`annotations.md`、整页截图、2 张裁片、无控制台错误，全部与旧版一致：

```
devlog/rounds/0001-20260916-1917/
  README.md  annotations.md  annotations.json
  screenshots/00-full.png  001-….png  002-….png
```

---

## 十六、里程碑 8：Electron 代码清空 + 命令行模式搬到 Rust

**这一节开始，仓库里再没有 Electron。**

删除：

| 删除物 | 说明 |
| --- | --- |
| `src/main/**`、`src/preload/**` | Electron 主进程与预加载（爬虫 / 存储 / 会话 / 插件宿主全部已由 Rust 侧承担） |
| `electron.vite.config.ts` | 渲染层由 `vite.renderer.config.ts` 承担 |
| `plugins/devlog/main/**` | 主进程侧插件，已由 `src-tauri/src/plugins/devlog.rs` 承担 |
| `scripts/{fix-wincodesign,imgdiff.cjs,make-icon.mjs}` | electron-builder / nativeImage 专用 |
| `tests/parser.test.ts`、`tsconfig.node.json` | 前者覆盖已由 Rust 侧 16 项解析单测承担（同一批 fixtures），后者只为 Electron 主进程存在 |
| `release/`（旧安装包与免安装目录）、`out/{main,preload}` | 首个发布版在 GitHub 上有存档，本地不再需要 |

依赖瘦身：Electron / electron-builder / electron-vite / sql.js 全部移除，
`node_modules` 从 ~700 MB 级降到 **92 MB**；`package.json` 去掉 `main` 与 electron-builder 的 `build` 段。

**命令行模式搬到 Rust**（`src-tauri/src/cli.rs`）：参数与旧版逐个对齐 ——
`--plate`、`--word`、`--pages`、`--from`、`--max`、`--index-only`、`--no-enrich`、
`--search`、`--library`、`--delay`、`--concurrency`、`--include`、`--exclude`、`--quiet`；
无参数照旧进界面。进展行按「稳定字段变化或每 2 秒」打印，不刷屏；
`imgdiff` 也从 `nativeImage` 版改成 Rust 子命令。新增 `scripts/crawl.mjs` 包装，
`e2e.mjs` 改成驱动应用本体的命令行模式。

**验证（全部在删干净之后重跑）**

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 干净 |
| `npm test`（vitest） | 7 项通过（分类表） |
| `npm run build:web` | 245 KB JS / 47 KB CSS |
| `node scripts/uicheck.mjs` | **63 项全绿** |
| `node plugins/annotator/bin/check.mjs` | **37 项全绿** |
| `node scripts/e2e.mjs`（真连站点） | 5 项全绿：索引 10 条、下载 4 张、缩略图 4 张、5779 KB |

---

## 十七、里程碑 9：文档改写、0.7.0 打包，以及一个只有打包后才会暴露的缺陷

**文档**

- `README.md` 全量改写（章节结构保持不动）：技术栈、下载与安装、为什么开发、命令行模式、
  开发与测试、代码结构、安全边界、已知限制全部换成 Tauri 版；体积数字用**实测值**而不是估计值
- `docs/architecture.md` 重写：分层图、目录结构、数据流（`gugu.localhost` 自定义协议）、
  「为什么这么选」表格换成 Tauri / rusqlite / 自定义协议的取舍
- `docs/plugin-development.md` 重写：主进程侧现在是 Rust（写在哪、怎么登记分发）
- `docs/site-analysis.md`、`docs/release-process.md`、`plugins/*/README.md` 的过时引用跟着改

**版本与打包**

- 版本升到 **0.7.0**（`package.json` / `tauri.conf.json` / `Cargo.toml` 三处，`build.rs` 从前者注入）
- `docs/release-notes/v0.7.0.md` 写好，可直接做 Release 正文
- NSIS 安装包出包成功，全程**离线**（第九节准备的工具链缓存生效）：

| 产物 | 体积 | 对比 Electron 版 |
| --- | --- | --- |
| `GuguGallery_0.7.0_x64-setup.exe` | **2.76 MB** | 85 MB（1/31） |
| `gugu-gallery.exe` | **7.42 MB** | 180 MB（1/24） |
| `node_modules` | **92 MB** | ~700 MB |

- 打包产物实测：release 版加载内嵌前端正常（2,129 条、60 张卡片）、自定义协议出图正常、
  截图与 DOM 体检正常、exe 版本信息 0.7.0

**发现并修掉一个真实缺陷（只有跑打包产物才会暴露）**

拿 release exe 做「首次启动」测试时发现：**欢迎向导不出现**，直接进了空图库，
并且悄悄在 `图片\GuguGallery` 建了库。根因 ——

- 渲染层桥里调用的是 `invoke('suggested_library_root')`，Rust 侧却注册成了 `suggested_library_root_cmd`；
- 初始化那段 `await Promise.all([...])` 里正好有这一句，命令不存在 → 整个 effect 抛错 →
  `setBootstrapped(true)` 永远不会执行 → 依赖 `bootstrapped` 的向导不渲染；
- 而图库本体不依赖这个标志，所以界面看起来「一切正常」——**只有首次安装的用户会撞上**。

修法与对账：

- 把 Rust 命令改名为 `suggested_library_root`（顺带解决与 settings 里同名函数的冲突）
- 顺手做了一次**系统性对账**：桥里 35 个 `invoke` 的**名字与参数名**逐个比对 Rust 注册的 38 个命令 ——
  现在全部对得上（多出来的两个 `debug_report` / `debug_diag` 只给自检脚本注入用，不在桥里）
- 修完重打安装包，首次启动实测：向导出现、默认建议 `图片\GuguGallery`

> 教训：**自检跑在 debug 构建 + devUrl 上，覆盖不到"打包后的首次启动"这条路径。**
> 这次的验证方式是把 release exe 拿 `GUGU_SHOT` 跑一遍首次启动 —— 建议以后每次出包都跑这一条。

---

## 十八、全量自检结果（0.7.0）

| 检查 | 结果 |
| --- | --- |
| `cargo test`（解析器 / URL 规则） | 16 项通过 |
| `npm test`（应用分类表） | 7 项通过 |
| `node scripts/uicheck.mjs`（真实界面交互） | 63 项通过 |
| `node plugins/annotator/bin/check.mjs`（标注工具） | 37 项通过 |
| `node scripts/e2e.mjs`（真连站点抓取下载） | 5 项通过 |
| 打包产物（release exe） | 内嵌前端正常、自定义协议出图、首次启动向导正常 |

---

## 十九、交付物与人工验收清单

**交付物**

| 东西 | 位置 |
| --- | --- |
| 安装包 | `release/GuguGallery_0.7.0_x64-setup.exe`（2.76 MB） |
| 校验值 | `release/SHA256SUMS.txt`（`d5416949…0741d`） |
| 发布说明 | `docs/release-notes/v0.7.0.md` |
| 分支 | `refactor/tauri-2`（本地已提交，**尚未推送**） |

**人工验收清单（用户只需走一遍）**

1. 双击安装包 → 若 SmartScreen 提示「未知发布者」→ 更多信息 → 仍要运行；
2. 首次启动应看到**「欢迎使用咕咕图库」向导**，默认建议 `图片\GuguGallery`，可改；
3. 若已有 0.6.3 建的图库：向导里直接选那个目录，索引（schema v3）应直接可用；
4. 抓取任务页：选分类 / 页数 → 开始；看进度、暂停 / 继续 / 取消；抓几张后看缩略图与灯箱；
5. 日常操作：筛选、搜索、收藏、评分、主题切换、侧栏拖宽、灯箱缩放与键盘翻页、两步删除；
6. 登录态（可选）：设置里贴一份**新的** cookie（旧的已失效），校验通过后「泳装分享」出现；
7. 命令行：`npm run crawl -- --pages 1 --max 3 --library <目录>`（或直接跑 exe）；
8. 卸载（可选）：确认图库目录不会被删掉。

**用户确认后要做的三件事**（都需要能访问 github.com 的网络）

1. `git push origin refactor/tauri-2`（SSH，本机可做）；
2. 浏览器打开 compare 链接建 PR（本机 HTTPS 到 github.com 不通，这一步得由用户在浏览器里点）；
3. 合并到 master → 打 tag `v0.7.0` → 推送 → 把安装包与 `SHA256SUMS.txt` 挂到 Release
   （或走 `docs/release-process.md` 里的 CI 方案，本地只需推 tag）。

---

## 二十、发布前发现并修复：安装后打不开（WebView2Loader.dll 缺失）

用户实测反馈「安装包装完后程序打不开」，本地复现与定位：

**复现**

1. 只把 `gugu-gallery.exe` 拷到干净目录运行 → 进程立刻退出，命令行报
   `error while loading shared libraries: WebView2Loader.dll: cannot open shared object file`（exit 127）；
   把 `target/release/WebView2Loader.dll` 放到旁边 → 正常出窗口。
2. 用 `cmd //c "...setup.exe /S /D=<临时目录>"` 静默安装 → 安装目录里**只有 exe 和 uninstall.exe**，
   没有 `WebView2Loader.dll` → 装完当然打不开。
3. 查生成的 `target/release/nsis/x64/installer.nsi`：确认没有任何 `File` 行带上这个 DLL。

**根因**：windows-gnu 工具链下 `WebView2Loader` 是**动态依赖**（MSVC 工具链会静态链接掉）。
tauri-bundler 里确实有一段「target 以 `-gnu` 结尾就自动带上这个 DLL」的逻辑，
但本机这次 `tauri build` 没走 `--target`，那段判断没命中，于是安装包里就少了运行库。

**修法**（双保险，且不依赖打包器的隐式行为）

- `scripts/release.mjs`：编译完 release 后把 `target/release/WebView2Loader.dll` 复制到 `src-tauri/`
  （复制不到就直接失败，不许出一个注定打不开的包）；
- `src-tauri/tauri.conf.json`：`bundle.resources` 把它映射到程序目录根；
- `src-tauri/WebView2Loader.dll` 进 `.gitignore`（构建产物，不入库）。

**验证**

1. 重新生成的 `installer.nsi` 里有 `File /a "/oname=WebView2Loader.dll" …`；
2. 静默安装到临时目录 → 目录里 `WebView2Loader.dll` / `gugu-gallery.exe` / `uninstall.exe` 三件齐全；
3. 直接启动**安装后**的 exe → 正常出窗口、截图与 DOM 体检正常；
4. 首次启动向导正常出现（`setupMask: true`，建议 `图片\GuguGallery`）；
5. `uninstall.exe /S` 正常卸载（图库目录不动）。

**顺带记两个坑**

- **Git Bash 会吃掉安装参数**：`./setup.exe /S /D=D:\path` 里的 `/S`、`/D=…` 被 MSYS 当路径转换，
  结果是退出码 1、什么都没装；要用 `cmd //c "…"` 或 PowerShell。
- 新安装包 2.83 MB（多了 160 KB 的 DLL，压缩后约 65 KB）。

---


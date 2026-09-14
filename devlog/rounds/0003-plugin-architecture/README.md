# 轮次 0003-plugin-architecture · 插件化与目录重组

- 时间：2026-09-14
- 起点提交：`2f88207`
- 结果提交：`b170197`
- 状态：**已收尾**
- 本轮无界面标注（属于结构性重构，不是反馈驱动的迭代）

## 背景

原始需求：

> 整理一下项目里文件，规划一下清晰的项目文件结构。
> 将页面标注工具，开发过程档案工具，作为应用的 tool 或 plugin 独立加载，
> 写好对应的 skill 和可复用的程序，以供最后发布应用时不加入，仅作为可选项。
> 关于代码修改，版本更新等均提交 commit，开发过程档案仅在有一定体量的更新迭代后建立，
> 不必每次 commit 都建立档案。

三条要求：

1. **目录要清晰** —— 应用本体、可选工具、仓库脚本三者不能混在一起
2. **工具要能独立装卸** —— 发布时不带，开发时可用，而且新增工具不该改核心代码
3. **要写 skill 与可复用程序** —— 让工具能被别人（或别的智能体）直接操作

### 起点的问题

上一轮把标注工具和档案工具直接塞进了应用本体：

```
src/main/devlog.ts                     ← 打包进主进程
src/renderer/src/devtools/            ← 打包进界面 bundle
scripts/{round,annotatecheck}.mjs     ← 虽然不打进产物，但和普通脚本混在一起
```

具体坏在哪：

- 发布构建会把工具代码一起打进去（渲染 bundle 330KB、CSS 36.2KB，其中一大截是标注工具）
- 核心的 `ipc.ts` 里硬编码了 `devlog:list` / `devlog:export` 两个通道 —— 加一个工具就要改一次核心
- 工具之间没有依赖表达，annotator 悄悄依赖 devlog，但没有任何地方声明这件事

## 改动

### 一、插件契约（`src/shared/plugin.ts`）

三层，都很薄：

| 层 | 形态 |
| --- | --- |
| 主进程 | 插件导出 `{ manifest, activate(host) }`，用 `host.method(name, fn)` 注册方法 |
| 渲染进程 | 插件默认导出 `{ manifest, TopBarAction?, Overlay? }`，由宿主渲染两个插槽 |
| 桥接 | 渲染进程统一走 `window.gugu.plugins.invoke(id, method, payload)` |

**最关键的一条：核心不需要知道任何具体插件的存在。**
`ipc.ts` 里不再有任何 `devlog:*` 通道，preload 里也只有一个通用的 `plugins.invoke`。
新增一个工具 = 建个目录 + 在 `plugins.json` 里登记，核心代码零改动。

### 二、构建期装载（`electron.vite.config.ts`）

- `plugins/plugins.json` 决定装载哪些；`GUGU_PLUGINS` 环境变量可临时覆盖
- 主进程：把每个插件的主入口加成独立 rollup entry，产物落在 `out/main/plugins/<id>.js`，
  宿主运行时按名字动态 import
- 渲染进程：一个虚拟模块 `virtual:gugu-plugins` 把启用的渲染入口聚合起来；
  禁用时生成空数组，打包产物里自然就没有插件代码
- `dependsOn` 在构建期校验：annotator 依赖 devlog，缺了就自动跳过并告警，不会让构建失败

### 三、发布构建的产物校验（`scripts/release.mjs`）

只把插件排除掉还不够 —— 得能**证明**它被排除了。构建完脚本会实际扫描：

- `out/main/plugins/` 是否存在且为空
- 渲染 bundle 里有没有 `gugu-anno-toolbar`、`annotations.json`、`页面标注工具` 这些特征串

「以为排除了其实没有」这种事必须被自动化抓住，不能靠人肉检查。

实测结果：

| | 含插件 | 发布构建 |
| --- | --- | --- |
| 主进程插件产物 | `out/main/plugins/devlog.js` | 不存在 |
| 渲染 bundle | 330.06 kB | 303.06 kB |
| 渲染 CSS | 36.23 kB | 25.29 kB |
### 四、目录重组

```
src/          应用本体 —— 发布产物只含这里
  main/       index / cli / context / config / ipc / plugins(宿主) / workspace
              crawler/ store/ media/
  preload/
  renderer/   App / plugins(宿主) / api / styles / components/
  shared/     types / bridge / plugin / globals

plugins/      可选工具 —— 默认不进发布产物
  plugins.json
  annotator/   plugin.json SKILL.md README.md renderer/ bin/
  devlog/      plugin.json SKILL.md README.md shared/ main/ bin/

scripts/      仓库级工具
  shot.mjs  uicheck.mjs  e2e.mjs  release.mjs  imgdiff.cjs

docs/         文档
  architecture.md  plugin-development.md  site-analysis.md
```

顺带把类型契约也归位了：`GuguBridge` 从 `renderer/api.ts` 挪到 `shared/bridge.ts`，
这样插件界面能拿到同一份类型，不必反过来依赖应用源码。

### 五、skill 与可复用程序

每个插件都配了 `SKILL.md`（带 frontmatter 的 name/description，写清何时用、怎么用、产物格式、常见问题），
另外新增两个可复用程序：

- `npm run round -- inbox` —— 打印最新未收尾轮次的内容。
  这是「拿到用户反馈」的标准入口，不用再手动翻目录找文件
- `scripts/imgdiff.cjs` —— 粗略比较两张截图的差异面积，用来判断「视觉上是否真的没变」

## 验证

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 23 / 23 |
| `npm run uicheck` | 17 / 17 |
| `npm run annotatecheck` | 18 / 18（现在跑的是 `plugins/annotator/bin/check.mjs`） |
| `npm run e2e` | 通过（240 条索引 / 4 张原图 / 0 失败） |
| `npm run build:release` | 产物中没有任何插件代码 |

**插件化的视觉透明性**：重构前后各截一轮四个界面做像素比对：

```
home:     差异像素 0.00%  最大通道差 7
lightbox: 差异像素 0.00%  最大通道差 6
crawl:    差异像素 0.01%  （只差「站点分类读取于 HH:MM:SS」这行时间文案）
settings: 差异像素 0.00%  最大通道差 0
```

也就是说顶栏那个标注按钮从「硬编码」换成「插件提供」之后，界面**一像素都没变**。

## 过程存档

- 起始截图（4 张）：`screenshots-before/`（取自轮次 0002 的改动后状态）
- 改动后截图（4 张）：`screenshots-after/`
- 代码差异：`changes.md` / `changes.patch`
- 本轮无界面标注

## 遗留

- 插件目前只能在**构建期**决定装载，没有运行期热插拔。
  对当前场景（发布不带、开发带）够用，但如果以后想让用户自己装插件就得再设计
- 渲染侧插件没有样式隔离，靠命名前缀 `gugu-anno-` 自觉避让
- 插件之间只有「方法调用」这一种通信方式，没有事件总线；
  两个以上插件需要互相通知时可能要补
- `npm run pack` 仍然带着插件（方便本地验证带工具的打包产物），
  `npm run dist` 走无插件构建 —— 这个差异值得在文档里更醒目一点

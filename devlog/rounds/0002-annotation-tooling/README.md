# 轮次 0002-annotation-tooling · 页面标注工具与开发过程档案

- 时间：2026-09-14
- 起点提交：`343a0e6`
- 结果提交：`c4c09eb`
- 状态：**已收尾**
- 本轮无界面标注（这一轮交付的是「提出标注的工具」本身）

## 背景

原始需求：

> 给我一个页面标注工具，我详细告诉你如何修改和设计前端页面。
> 创建一个子目录在子目录下保存每次开发的快照和版本说明，为后续需要展示该项目的所有开发流程时提供资料。

也就是说，审阅者需要一个**能指着界面说话**的手段，而且这些反馈要能被留档、被追溯。
这带来两条互相关联的需求：

1. **标注工具** —— 在真实界面上点选元素 / 框选区域写批注，导出成可直接执行的说明
2. **过程档案** —— 每轮迭代的快照、说明、前后对照，可回溯可展示

### 关键约束

批注里写「这个按钮太小」是**无法执行的**。而执行改动的一方未必看得到界面
（比如由模型来改），所以标注必须自带足够的技术上下文：
选择器、组件名、当前字号、当前颜色、当前间距、坐标尺寸等等，一个都不能少。

这条约束直接决定了工具的设计：**不是画个箭头截个图就完事，而是要做元素自省**。

## 改动

### 一、标注工具（`src/renderer/src/devtools/`）

**三种模式**，解决「想标注就得先能翻到那一屏」的矛盾：

| 模式 | 行为 |
| --- | --- |
| 浏览 | 完全不拦截点击，正常使用应用，翻到要提意见的地方 |
| 点选 | 悬停实时高亮元素 + 显示所属组件，点一下即可写批注 |
| 框选 | 按住左键拖出矩形，给一整片区域提意见 |

**元素自省**（`inspect.ts`）——这是工具的核心价值。每条标注自动附带：

- `data-component` 组件名（例：`Sidebar/TagChip`）与父级链，一步定位到源码
- 唯一 CSS 选择器
- 元素可见文本
- 关键计算样式：display/flex/gap/width/padding/font-size/font-weight/line-height/
  color/background-color/border/border-radius/box-shadow/transition… （过滤掉无信息量的默认值）
- **WCAG 对比度**：文本色与背景色不透明时自动计算并给出 AA/AAA 评级 ——
  「好看」里最硬的一条指标，顺手算掉省得来回问
- 标注框的坐标与尺寸

**批注元数据**：类别（视觉样式 / 布局结构 / 文案内容 / 交互行为 / 缺陷 / 其它）
+ 优先级（必须改 / 建议改 / 锦上添花），便于执行方排期。

**导出产物**（`src/main/devlog.ts`）：

```
devlog/rounds/<自动编号>/
├── README.md           轮次说明骨架
├── annotations.md      人读版：每条批注 + 全部采集信息
├── annotations.json    机读版：原始数据
└── screenshots/
    ├── 00-full.png     导出时整页截图
    └── 001-xxx.png     每条标注自动裁切的局部截图
```

截图裁切要注意 DPR：`capturePage()` 给的是物理像素，标注框是 CSS 像素，两者差一个
`devicePixelRatio`（本机实测 1.425），换算错就会裁偏。

**实现上的两个决定**：

1. **用 document 捕获阶段的监听器拦截事件，而不是铺一层遮罩**。
   好处是能直接用 `e.target` 拿到真实元素（遮罩方案得反过来用 `elementFromPoint` 穿透自己），
   而且工具栏、图钉、编辑框这些自己的 UI 不会被误拦截（靠 `closest('.gugu-anno-root')` 放行）。
2. **位置同时记录视口坐标与文档坐标**。视口坐标用于截图裁切，文档坐标用于滚动后把标注钉在原地；
   导出时再按当前滚动位置换算回视口坐标，保证裁切和标注框对齐。

标注工具用一套**暖色调**（橙）与应用的冷色主题区分开，避免误判当前处于哪种模式。

### 二、开发过程档案（`devlog/`）

```
devlog/
├── README.md       档案用法说明
├── index.json      轮次索引（编号、时间、起止提交、状态）
└── rounds/
    ├── 0001-baseline/
    └── 0002-annotation-tooling/
```

配套工具 `scripts/round.mjs`：

| 命令 | 作用 |
| --- | --- |
| `list` | 列出所有轮次 |
| `new <slug>` | 开一轮：建目录 + 采集起始截图 + 写元数据 + README 骨架 |
| `finalize <轮次ID>` | 收尾：采集改动后截图 + 生成 `changes.md`/`changes.patch` + 更新说明 + 打 tag |

每个轮次都打一个 `round/<轮次ID>` 的 git tag，任何一轮都能 `git checkout` 完整复原。

档案里刻意同时保留**人和机器两种格式**：`annotations.md` 给人读，
`annotations.json` 给工具读；`changes.md` 给概览，`changes.patch` 给 `git apply`。

### 三、顺带修掉的两个问题

1. **应用版本号显示成了 Electron 版本**（`33.4.11`）。
   开发态下 `app.getAppPath()` 指向的不是仓库根，`app.getVersion()` 拿不到 package.json。
   改为构建期用 Vite `define` 注入 `__APP_VERSION__`。
2. **标注截图文件名里残留全角冒号**等标点，跨文件系统拷贝有风险。
   扩宽了 slug 过滤的字符集（半角 + 全角标点全清）。

## 验证

新增 `npm run annotatecheck`：程序化驱动真实界面走完
「Ctrl+Shift+A 打开 → 切点选 → 悬停识别 → 点选写批注 → 提交 → 切框选 → 拖拽 → 提交 →
导出 → 校验落盘产物」，共 **18 项断言**，全部通过。

导出产物实测（自检脚本生成的样例）：

```
组件：Sidebar/TagChip
选择器：div.app > aside.sidebar > div.side-section:nth-of-type(3) > div.tag-cloud:nth-of-type(2) > button.tag-chip:nth-of-type(1)
父级链：div.tag-cloud ← div.side-section ← aside.sidebar ← div.app ← div
元素文本：女孩子94
位置尺寸：x=16 y=367 69×23
关键样式：padding: 3px 9px; font-size: 11.5px; color: rgb(151, 161, 181);
          background-color: rgb(20, 25, 36); border-radius: 99px; ── 对比度: 6.77:1（AA）
```

回归确认：

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 23 / 23 |
| `npm run uicheck` | 17 / 17 |
| `npm run annotatecheck` | 18 / 18 |
| 运行期控制台错误 | 0 |

## 过程存档

- 起始截图（4 张）：`screenshots-before/`（取自轮次 0001 的界面状态）
- 改动后截图（4 张）：`screenshots-after/`（顶栏多了标注工具入口）
- 代码差异：`changes.md` / `changes.patch`
- 本轮无界面标注

## 遗留

- 标注不支持跨界面关联（比如「图库页的卡片」和「灯箱里的同一张图」之间建立联系）
- 标注没有「已解决 / 待确认」的状态流转，执行完一轮只能靠导出新轮次来区分
- 框选标注的坐标是固定的，如果之后界面布局大改，旧截片仍可看，但对应位置会对不上

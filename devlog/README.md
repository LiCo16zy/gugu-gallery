# 开发过程档案

这里保存本项目每一轮迭代的**快照、说明与截图**，目的是让整个开发过程可以完整回溯、复盘与对外展示。

## 目录结构

```
devlog/
├── README.md              本文件：档案使用说明
├── index.json             轮次索引（编号、时间、起止提交、状态）
└── rounds/
    ├── 0001-baseline/     基线：初始可用版本
    │   ├── README.md              本轮说明（背景 / 改动 / 验证 / 遗留）
    │   ├── annotations.md         界面标注原文（人会读的版本）
    │   ├── annotations.json       界面标注原始数据（机器可读）
    │   ├── changes.md             代码差异概览（变更文件清单 + 统计）
    │   ├── changes.patch          完整代码差异（可 git apply）
    │   ├── screenshots/           本轮界面截图
    │   ├── screenshots-before/    改动前截图（用于前后对照）
    │   └── screenshots-after/     改动后截图（用于前后对照）
    └── 0002-.../
```

## 一轮是怎么产生的

一条完整的轮次记录由**两部分**拼成：

**1）界面标注工具产出**（你来做）

在应用里按 `Ctrl+Shift+A` 打开标注工具：

1. 先留在「浏览」模式正常操作，翻到你想提意见的那一屏（比如打开某张图的灯箱、切到抓取面板）
2. 切到「点选」——鼠标悬停时会实时高亮元素并显示它属于哪个组件；点一下即可写批注
3. 或者切到「框选」——按住左键拖出一个矩形，给一整片区域提意见
4. 每条批注可以标类别（视觉样式 / 布局结构 / 文案内容 / 交互行为 / 缺陷 / 其它）和优先级（必须改 / 建议改 / 锦上添花）
5. 点「导出标注」，填一句总体说明，确认

导出会在 `devlog/rounds/` 下自动生成一个新轮次目录，包含：

- `annotations.md` / `annotations.json`：每条批注的文字、**组件名、CSS 选择器、父级链、元素文本、关键计算样式、WCAG 对比度**，以及标注框的坐标尺寸
- `screenshots/00-full.png`：导出时的整页截图
- `screenshots/001-xxx.png`：**每条标注自动裁切的局部截图**

> 为什么记录这么细：批注只有「这个按钮太小」这种话是无法执行的，
> 而执行改动的人（或 AI）不一定看得到界面截图。所以工具会把选择器、组件名、字号颜色间距一并记下来，
> 拿到 `annotations.md` 就能直接定位到源码位置并知道当前值是多少。

**2）轮次工具产出**（我来做）

```bash
npm run round -- inbox              # 打印最新未收尾轮次的内容
npm run round -- list               # 看有哪些轮次
npm run round -- new <slug>         # 开一轮：建目录 + 起始截图 + 元数据
npm run round -- finalize <轮次ID>  # 收尾：改动后截图 + 代码 diff + 更新说明 + 打 git tag
```

> 这套工具是**可选插件**（`plugins/devlog`），发布构建时不会打进应用。
> 操作手册见 [`plugins/devlog/SKILL.md`](../plugins/devlog/SKILL.md)。

`finalize` 会自动补上 `changes.md`、`changes.patch`、`screenshots-after/`，
并在 `README.md` 追加「过程存档」小节，最后打一个 `round/<轮次ID>` 的 git tag。
每个轮次都能用 `git checkout round/<轮次ID>` 完整复原。

## 什么时候建轮次

**平时改代码只管 commit**，不需要每次都建档案 —— 每次 commit 都开一轮会把档案淹掉。

只在有体量的迭代时建：

- 用户提了一批界面修改意见，准备动手改
- 做了一次结构性重构、换了技术方案、增删了主要功能
- 一个功能从无到有做完了

## 命名规范

- 轮次编号四位递增：`0001`、`0002`……
- slug 用简短英文或中文，描述本轮主题，例如 `0002-tighten-typography`
- git tag 与目录同名：`round/0002-tighten-typography`

## 怎么用它做展示

按轮次顺序读 `README.md`，配合 `screenshots-before/` 与 `screenshots-after/` 做前后对照，
再翻 `annotations.md` 看当时的原始反馈、`changes.patch` 看具体改了什么 —— 一条完整的
「提出意见 → 落地实现 → 验证结果」链路就有了。

## 归档说明

- `rounds/0001`–`0013`：Electron 时代的过程记录，已在 `index.json` 里标 `archived: true`，内容保持原样只作回溯；
- `rounds/0014` 起：Tauri 重构与新架构下的开发轮次；
- `archive/`：旧架构的 README 与发布说明（从 `docs/` 移入）。

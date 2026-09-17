# 开发过程档案

这里保存本项目每一轮迭代的**快照、说明与截图**，目的是让整个开发过程可以完整回溯、复盘与对外展示。

## 目录结构

```
devlog/
├── README.md              本文件：档案使用说明
├── index.json             轮次索引（ID、slug、标题、时期、状态、起止提交、归档标记、产物清单）
├── rounds/                每一轮一个目录（ID 即目录名）
│   └── 0001-baseline/
│       ├── README.md              本轮说明（背景 / 改动 / 验证 / 遗留）
│       ├── annotations.md         界面标注原文（人会读的版本）
│       ├── annotations.json       界面标注原始数据（机器可读）
│       ├── changes.md             代码差异概览（变更文件清单 + 统计）
│       ├── changes.patch          完整代码差异（可 git apply）
│       ├── screenshots/           本轮界面截图（标注工具导出）
│       ├── screenshots-before/    改动前截图（前后对照）
│       ├── screenshots-after/     改动后截图（前后对照）
│       └── screenshots-verify/    验证截图为个别轮次特有
└── archive/               旧架构的 README 与发布说明（从 docs/ 移入）
```

## 轮次一览

| 轮次 | 标题 | 时期 | 状态 | 一句话 |
| --- | --- | --- | --- | --- |
| 0001-baseline | 初始可用版本 | Electron | 归档 | 爬虫 + 图库 + SQLite 索引的第一版跑通 |
| 0002-annotation-tooling | 页面标注工具与开发过程档案 | Electron | 归档 | 标注工具 + 轮次档案工具落地（本档案体系的开端） |
| 0003-plugin-architecture | 插件化与目录重组 | Electron | 归档 | 两个工具改造成可选插件；目录与构建整理 |
| 0004 | 界面大改：瀑布流、侧栏顶栏、灯箱交互 | Electron | 归档 | 用户 34 条标注驱动的一次界面大改 |
| 0005 | 交互补全与关键缺陷修复 | Electron | 归档 | 验收回合：补交互、修上一轮引入的回归 |
| 0006 | 标注工具易用性 + 沉浸模式与抓取面板 | Electron | 归档 | 工具自身可用性 + 灯箱沉浸模式与抓取面板调整 |
| 0007 | 标注工具栏可拖动 / 简易形态 + 动效调整 | Electron | 归档 | 工具栏交互形态重构与动效节奏调整 |
| 0008 | 回退重排动画速度 + 灯箱下锁定窗口拖动 | Electron | 归档 | 纯反馈修正轮 |
| 0009-installer-polish | 应用图标、可选安装位置、首次启动选择图库目录 | Electron | 归档 | 安装与首启体验打磨 |
| 0010-categories-login-and-range | 分类摊平、页码范围、日期筛选、登录态入口 | Electron | 归档 | 方向转向「少动前端、多做后端」 |
| 0011 | 登录态链路验证与修复 | Electron | 归档 | 会话 cookie 全链路打通与验证 |
| 0012-session-keepalive-and-item-targets | 会话保活与 item_targets 拆分 | Electron | 归档 | 登录态保活；站点分类与应用分类解耦 |
| 0013 | 登录 / 退出交互重做（帮助面板三击确认） | Electron | 归档 | Electron 时代的最后一批轮次 |
| 0014-phase2-refactor-and-multiplatform | 阶段二：Electron → Tauri 2 重构（含多端规划） | Tauri 重构 | **进行中** | 桌面重构完成并发布 v0.7.1；Android 部分待做 |
| 0015 | 实测反馈：下载损坏 / 登录反馈 / 速度 | Tauri 新架构 | 已收尾 | 详情补全补齐、文件缺失自愈、失败原因提示 |
| 0016 | 暂停/继续、日志去重、标题条与关于面板 | Tauri 新架构 | 已收尾 | 暂停相关三处缺陷 + 标题条串图 + 关于面板字段 |

> 带 slug 的目录名（如 `0009-installer-polish`）与时间戳式目录名（如 `0011-20260915-0232`）都是合法 ID：
> 后者是**页面标注工具自动导出**时生成的，友好名记在 `index.json` 的 `slug` / `title` 里（上表也是按它汇总的）。
> `0015`、`0016` 由标注工具导出，没有 `round/*` tag；`0001`–`0013` 都有 tag，可 `git checkout round/<ID>` 完整复原。

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
npm run round -- inbox              # 打印最新未收尾轮次的内容（拿到反馈的标准入口）
npm run round -- list               # 看有哪些轮次
npm run round -- new <slug>         # 开一轮：建目录 + 起始截图 + 元数据
npm run round -- finalize <轮次ID>  # 收尾：改动后截图 + 代码 diff + 更新说明 + 打 git tag
```

> 这套工具是**可选插件**（`plugins/devlog`），发布构建时不会打进应用。
> 操作手册见 [`plugins/devlog/SKILL.md`](../plugins/devlog/SKILL.md)。

`finalize` 会自动补上 `changes.md`、`changes.patch`、`screenshots-after/`，
并在 `README.md` 追加「过程存档」小节，最后打一个 `round/<轮次ID>` 的 git tag。

## 什么时候建轮次

**平时改代码只管 commit**，不需要每次都建档案 —— 每次 commit 都开一轮会把档案淹掉。

只在有体量的迭代时建：

- 用户提了一批界面修改意见，准备动手改
- 做了一次结构性重构、换了技术方案、增删了主要功能
- 一个功能从无到有做完了

## 命名与 ID 规则

- 轮次 ID = **目录名 = git tag 名**（`round/<ID>`），创建之后**不再改动**（tag 指向历史，改名会断链）；
- ID 有两种形态：`00NN-<slug>`（轮次工具创建）与 `00NN-<yyyyMMdd-HHmm>`（标注工具自动导出）；
- 友好名（`slug` / `title` / 一句话说明）统一记在 `index.json`，`npm run round -- list` 会读它；
- 每轮的产物不强制齐全（有的轮次没有标注、有的没打 tag），`index.json` 的 `artifacts` 字段列了实际都有什么。

## 归档说明

- `rounds/0001`–`0013`：**Electron 时代**的过程记录，在 `index.json` 里标 `archived: true`，内容保持原样只作回溯；
- `rounds/0014`：Tauri 重构轮（**进行中**，Android 迁移还没做），后续同架构的迭代继续挂在这一轮下；
- `rounds/0015`、`0016`：Tauri 新架构下的实测反馈轮次；
- `archive/`：旧架构的 README 与发布说明（从 `docs/` 移入）。

## 怎么用它做展示

按轮次顺序读 `README.md`，配合 `screenshots-before/` 与 `screenshots-after/` 做前后对照，
再翻 `annotations.md` 看当时的原始反馈、`changes.patch` 看具体改了什么 —— 一条完整的
「提出意见 → 落地实现 → 验证结果」链路就有了。

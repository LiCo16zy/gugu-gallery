---
name: gugu-devlog
description: 咕咕图库的开发过程档案工具。当需要建立或收尾一轮迭代档案、查看某轮的标注与代码差异、或展示项目开发历程时使用。
---

# 开发过程档案（devlog）

把每一轮**有体量的迭代**归档到 `devlog/rounds/<0000-slug>/`，让整个开发过程可回溯、可展示。

## 何时使用

**要建立轮次**的情形：

- 用户提了一批界面修改意见，准备动手改
- 做了一次结构性重构、换了技术方案、增删了主要功能
- 一个功能从无到有做完了

**不要建立轮次**的情形：

- 改错别字、调颜色、修一行 bug —— 直接 commit 就行
- 每次 commit 都开一轮会把档案淹掉；档案的价值在于「阶段感」

## 前置条件

- 已完成 `npm install` 与 `npm run build`
- 应用能跑起来（`npm run dev`），且图库目录有数据（默认 `data/demo`）

## 操作步骤

### 1. 开一轮

```bash
npm run round -- new <slug>
```

创建 `devlog/rounds/<4位序号>-<slug>/`，采集改动前截图到 `screenshots-before/`，
写入 README 骨架，并在 `devlog/index.json` 登记。

如果这一轮来自用户的界面标注，则**不需要**手动 new ——
用户在应用里点「导出标注」时会自动建立轮次目录并写入 `annotations.md`。

### 2. 读反馈

```bash
npm run round -- inbox
```

打印最新一个尚未收尾的轮次内容（含逐条标注的完整技术上下文）。
这是「拿到用户意见」的标准入口。

### 3. 动手改

正常提交代码。commit message 写清楚「为什么」，轮次 README 里再汇总。

### 4. 收尾

```bash
npm run round -- finalize <轮次ID>
```

自动完成：

- 采集改动后截图到 `screenshots-after/`（与 before 对照）
- 生成 `changes.md`（变更文件清单 + 统计）与 `changes.patch`（完整 diff，可 `git apply`）
- 在 README 追加「过程存档」小节
- 打 git tag `round/<轮次ID>`

收尾前请**手动补全 README 的「改动 / 验证 / 遗留」三节** ——
脚本只能采集客观事实，写不出判断和取舍。

### 5. 查看

```bash
npm run round -- list                        # 所有轮次
git checkout round/0002-annotation-tooling   # 完整复原某一轮
```

## 产物格式

```
devlog/rounds/0002-annotation-tooling/
├── README.md             背景 / 反馈 / 改动 / 验证 / 遗留
├── annotations.md        界面标注原文（人读版，含组件名、选择器、当前样式）
├── annotations.json      界面标注原始数据（机器可读）
├── changes.md            代码差异概览
├── changes.patch         完整 diff
├── screenshots-before/   改动前截图
└── screenshots-after/    改动后截图
```

## 常见问题

- **截图是空白的**：截图前会唤起窗口，远程会话下可能截不到；用 `GUGU_SHOT_DELAY` 调大等待时间
- **轮次编号对不上**：编号 = 目录数量 + 1，手工删过目录就会跳号，属正常
- **`finalize` 说变更文件为空**：说明这一轮还没有 commit，先提交代码再收尾

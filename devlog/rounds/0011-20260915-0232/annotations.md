# 界面标注 · 轮次 0011-20260915-0232

- 导出时间：2026-09-14T18:32:22.567Z
- 所在界面：crawl
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.6.0
- 标注条数：3

## 总体说明

登录态解锁
爬虫优化

## 逐条标注

### 1. 爬虫爬取此类应额外添加泳装分享标签，点击时添加筛选，且此分类仅登录态可见。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar › div.side-title`
- **选择器**：`div.app > aside.sidebar > div.sidebar-scroll:nth-of-type(1) > div.side-section:nth-of-type(2) > div.side-title`
- **父级链**：`div.side-section` ← `div.sidebar-scroll` ← `aside.sidebar` ← `div.app` ← `div`
- **元素文本**：分类
- **位置尺寸**：x=10 y=269 210×23
- **关键样式**：display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: normal; grid-template-columns: none; width: 210.296px; height: 23.2675px; min-width: 0px; max-width: none; padding: 0px 8px 7px; margin: 0px; font-size: 10.5px; font-weight: 600; line-height: 16.275px; letter-spacing: 0.9px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 爬虫爬取此类应额外添加泳装分享标签，点击时添加筛选，且此分类仅登录态可见。

### 2. 此项置于左侧第二个位置

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/FilterBar › button.pill`
- **选择器**：`div.app > main.main > div.filter-bar:nth-of-type(1) > div.date-picker:nth-of-type(2) > button.pill`
- **父级链**：`div.date-picker` ← `div.filter-bar` ← `main.main` ← `div.app` ← `div`
- **元素文本**：日期▾
- **位置尺寸**：x=723 y=69 62×26
- **关键样式**：display: inline-flex; flex-direction: row; justify-content: normal; align-items: center; gap: 6px; grid-template-columns: none; width: 62.1053px; height: 25.9978px; min-width: 0px; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 99px; white-space: normal; transition: 0.14s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="按发布日期筛选（可与排序叠加）"

> 此项置于左侧第二个位置
> 仅分月，不记录日

### 3. 在左边增加登录按钮，点击后关闭帮助弹出引导界面，识别后此处登录按钮变灰“已登陆”

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › button.btn`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > div.modal-actions:nth-of-type(5) > button.btn:nth-of-type(1)`
- **父级链**：`div.modal-actions` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：访问网站
- **位置尺寸**：x=774 y=569 81×34
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 81.3816px; height: 33.9912px; min-width: auto; max-width: none; padding: 0px 14px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 9px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 13.64:1（AAA）

> 在左边增加登录按钮，点击后关闭帮助弹出引导界面，识别后此处登录按钮变灰“已登陆”

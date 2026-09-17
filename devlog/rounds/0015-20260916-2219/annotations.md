# 界面标注 · 轮次 0015-20260916-2219

- 导出时间：2026-09-16T14:19:30.661Z
- 所在界面：crawl
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.7.0
- 标注条数：5

## 总体说明

抓取功能，单独下载功能，登录功能需要修复

## 逐条标注

### 1. 我单独下载了一幅图片但是图片显示损坏

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › div.card-media-fallback`
- **选择器**：`main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(4) > div.card-media:nth-of-type(1) > div.card-media-fallback:nth-of-type(1)`
- **父级链**：`div.card-media` ← `div.card` ← `div.grid` ← `main.main` ← `div.app`
- **位置尺寸**：x=1068 y=120 252×474
- **关键样式**：align-items: center; background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; color: rgb(102, 112, 133); display: grid; flex-direction: row; font-size: 13px; font-weight: 400; gap: normal; grid-template-columns: 251.59px; height: 473.991px; justify-content: normal; line-height: 20.15px; margin: 0px; max-width: none; min-width: 0px; padding: 0px; transition: all; white-space: normal; width: 251.59px

> 我单独下载了一幅图片但是图片显示损坏

### 2. 同上一处标注，图片不能正常显示

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage › img`
- **选择器**：`div > div.app.lightbox-open > div.lightbox:nth-of-type(3) > div.lightbox-stage:nth-of-type(1) > img`
- **父级链**：`div.lightbox-stage` ← `div.lightbox` ← `div.app.lightbox-open` ← `div` ← `body`
- **位置尺寸**：x=24 y=24 964×668
- **关键样式**：align-items: normal; background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.75) 0px 24px 60px -20px; color: rgb(231, 235, 243); flex-direction: row; font-size: 13px; font-weight: 400; gap: normal; grid-template-columns: none; height: 668.487px; justify-content: normal; line-height: 20.15px; margin: 24.0022px; max-width: calc(100% - 48px); min-width: 0px; object-fit: contain; overflow: clip; padding: 0px; position: absolute; transition: all; white-space: normal; width: 964.068px
- **属性**：src="http://gugu.localhost/media/19495"

> 同上一处标注，图片不能正常显示

### 3. 使用 cookie不能保存并验证，或者没有成功的提示

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › button.btn`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > div.modal-actions:nth-of-type(2) > button.btn.primary:nth-of-type(1)`
- **父级链**：`div.modal-actions` ← `div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：保存并验证
- **位置尺寸**：x=702 y=443 94×34
- **关键样式**：align-items: center; background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 9px; box-shadow: rgb(124, 156, 255) 0px 6px 18px -8px; color: rgb(255, 255, 255); display: flex; flex-direction: row; font-size: 13px; font-weight: 550; gap: 7px; grid-template-columns: none; height: 33.9912px; justify-content: center; line-height: normal; margin: 0px; max-width: none; min-width: auto; padding: 0px 14px; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); white-space: nowrap; width: 94.375px; ── 对比度: 16.30:1（AAA）

> 使用 cookie不能保存并验证，或者没有成功的提示

### 4. 是我自己的网络问题吗，下载速度好慢。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`CrawlPanel › section.card-panel`
- **选择器**：`div > div.app > main.main > div.page > section.card-panel:nth-of-type(4)`
- **父级链**：`div.page` ← `main.main` ← `div.app` ← `div` ← `body`
- **元素文本**：开始建立索引暂停停止清空日志正在建立索引0.0%索引页数0发现条目0新增条目0下载进度—已下载体积—速度—预计剩余—跳过 / 失败0 / 0
- **位置尺寸**：x=270 y=152 1036×187
- **关键样式**：align-items: normal; background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.07); border-radius: 16px; color: rgb(231, 235, 243); flex-direction: row; font-size: 13px; font-weight: 400; gap: normal; grid-template-columns: none; height: 186.963px; justify-content: normal; line-height: 20.15px; margin: 0px 0px 14px; max-width: none; min-width: 0px; padding: 16px 18px; transition: all; white-space: normal; width: 1036.01px; ── 对比度: 14.72:1（AAA）

> 是我自己的网络问题吗，下载速度好慢。

### 5. 我尝试下载了这一图片，然后点击打开位置显示图片不存在

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage › img`
- **选择器**：`div > div.app.sidebar-collapsed > div.lightbox:nth-of-type(3) > div.lightbox-stage:nth-of-type(1) > img`
- **父级链**：`div.lightbox-stage` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=24 y=24 964×668
- **关键样式**：align-items: normal; background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.75) 0px 24px 60px -20px; color: rgb(231, 235, 243); flex-direction: row; font-size: 13px; font-weight: 400; gap: normal; grid-template-columns: none; height: 668.487px; justify-content: normal; line-height: 20.15px; margin: 24.0022px; max-width: calc(100% - 48px); min-width: 0px; object-fit: contain; overflow: clip; padding: 0px; position: absolute; transition: all; white-space: normal; width: 964.068px
- **属性**：src="http://gugu.localhost/media/19495"

> 我尝试下载了这一图片，然后点击打开位置显示图片不存在

# 界面标注 · 轮次 0006-20260914-2042

- 导出时间：2026-09-14T12:42:41.956Z
- 所在界面：crawl
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.1.0
- 标注条数：10

## 总体说明

沉浸模式调整
文本内容调整
细节调整

## 逐条标注

### 1. 这里的折叠子项由于中间存在空的间隔，在鼠标移动较慢时，处于空的间隔处时子项会折叠，交互要宽松一点。右键菜单打开后当鼠标移

- **类别**：交互行为 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`ContextMenu › button.ctx-item`
- **选择器**：`div > div.app > div.ctx-menu:nth-of-type(4) > div:nth-of-type(3) > button.ctx-item.open`
- **父级链**：`div` ← `div.ctx-menu` ← `div.app` ← `div` ← `body`
- **元素文本**：打开于…
- **位置尺寸**：x=676 y=337 161×32
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 9px; grid-template-columns: none; width: 160.592px; height: 31.5351px; min-width: 0px; max-width: none; padding: 7px 10px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(34, 42, 58); border: 0px none rgb(231, 235, 243); border-radius: 7px; white-space: normal; transition: background 0.12s cubic-bezier(0.22, 0.61, 0.36, 1), color 0.12s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 12.04:1（AAA）

> 这里的折叠子项由于中间存在空的间隔，在鼠标移动较慢时，处于空的间隔处时子项会折叠，交互要宽松一点。右键菜单打开后当鼠标移到此项上时，打开折叠项，当鼠标离开此项后2s，且不处于子项中时，子项重新折叠

### 2. 右上角切换沉浸模式按钮不见了，我没法点击退出沉浸模式。

- **类别**：交互行为 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage`
- **选择器**：`body > div > div.app.sidebar-collapsed > div.lightbox.immersive:nth-of-type(2) > div.lightbox-stage:nth-of-type(1)`
- **父级链**：`div.lightbox.immersive` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=0 y=0 1348×716
- **关键样式**：display: grid; position: relative; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: none; width: 1348.07px; height: 716.491px; min-width: 0px; max-width: none; padding: 24px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: hidden; white-space: normal; transition: all

> 右上角切换沉浸模式按钮不见了，我没法点击退出沉浸模式。

### 3. 取消卡片左上角的 "横图/竖图" 说明

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › img`
- **选择器**：`main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(2) > div.card-media:nth-of-type(1) > img`
- **父级链**：`div.card-media` ← `div.card` ← `div.grid` ← `main.main` ← `div.app`
- **位置尺寸**：x=441 y=119 349×136
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 340.241px; height: 132.993px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: clip; white-space: normal; transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.25s cubic-bezier(0.22, 0.61, 0.36, 1); object-fit: cover
- **属性**：src="gugu://thumb/19523"

> 取消卡片左上角的 "横图/竖图" 说明

### 4. 这个按钮的鼠标悬浮时的说明，修改成"沉浸模式"

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/SidePanel › button.lb-immersive`
- **选择器**：`div.app > div.lightbox:nth-of-type(3) > div.lightbox-side:nth-of-type(2) > div.lb-head:nth-of-type(1) > button.lb-immersive:nth-of-type(1)`
- **父级链**：`div.lb-head` ← `div.lightbox-side` ← `div.lightbox` ← `div.app` ← `div`
- **位置尺寸**：x=952 y=16 30×30
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: 28.5965px; width: 30px; height: 30px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 8px; white-space: normal; transition: 0.16s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="沉浸模式：隐藏右侧信息栏"

> 这个按钮的鼠标悬浮时的说明，修改成"沉浸模式"

### 5. 调整文本：

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/SidePanel › p.lb-tip`
- **选择器**：`div > div.app > div.lightbox:nth-of-type(3) > div.lightbox-side:nth-of-type(2) > p.lb-tip`
- **父级链**：`div.lightbox-side` ← `div.lightbox` ← `div.app` ← `div` ← `body`
- **元素文本**：滚轮缩放 · 左键拖动 · ← → 翻页 · Esc 关闭
- **位置尺寸**：x=723 y=446 299×17
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 299.309px; height: 17.0395px; min-width: 0px; max-width: none; padding: 0px; margin: 0px 0px 16px; font-size: 11px; font-weight: 400; line-height: 17.05px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 调整文本：
> 左键拖动 · 滚轮缩放 · ← → 翻页 · Esc 关闭

### 6. 调整文本:

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › dd`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > dl.kv:nth-of-type(1) > dd:nth-of-type(3)`
- **父级链**：`dl.kv` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：← → 翻页，Esc 关闭，滚轮缩放，左键拖动
- **位置尺寸**：x=377 y=329 401×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 400.614px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 调整文本:
> 左键拖动，滚轮缩放，← → 翻页，Esc 关闭

### 7. 标题、标签、Pixiv ID 都能搜

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › dd`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > dl.kv:nth-of-type(1) > dd:nth-of-type(1)`
- **父级链**：`dl.kv` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：标题、标签、分类、Pixiv ID 都能搜
- **位置尺寸**：x=377 y=280 401×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 400.614px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 标题、标签、Pixiv ID 都能搜

### 8. 调整文本:

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › dt`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > dl.kv:nth-of-type(1) > dt:nth-of-type(2)`
- **父级链**：`dl.kv` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：卡片右键
- **位置尺寸**：x=263 y=304 104×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 103.991px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 调整文本:
> 卡片

### 9. 这里的目前约 1430 页的数字对用户还是比较有参考价值，能否在“抓取目标”的”重新读取分类“的时候获取一次总页数，然后

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`CrawlPanel › span.help`
- **选择器**：`div.page > section.card-panel:nth-of-type(2) > div.field-grid:nth-of-type(2) > div.field:nth-of-type(2) > span.help`
- **父级链**：`div.field` ← `div.field-grid` ← `section.card-panel` ← `div.page` ← `main.main`
- **元素文本**：Pixiv萌图 目前约 1430 页
- **位置尺寸**：x=731 y=311 258×17
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 258.399px; height: 17.0395px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 11px; font-weight: 400; line-height: 17.05px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 这里的目前约 1430 页的数字对用户还是比较有参考价值，能否在“抓取目标”的”重新读取分类“的时候获取一次总页数，然后写到这里

### 10. 在重新读取分类的时候能否获取一次页面的总页数，然后写道下面抓取范围与内容过滤的小字里。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`CrawlPanel › button.btn`
- **选择器**：`main.main > div.page > section.card-panel:nth-of-type(1) > div.panel-title:nth-of-type(1) > button.btn.sm`
- **父级链**：`div.panel-title` ← `section.card-panel` ← `div.page` ← `main.main` ← `div.app`
- **元素文本**：重新读取分类
- **位置尺寸**：x=876 y=186 113×28
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 113.355px; height: 27.9934px; min-width: auto; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 7px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）

> 在重新读取分类的时候能否获取一次页面的总页数，然后写道下面抓取范围与内容过滤的小字里。

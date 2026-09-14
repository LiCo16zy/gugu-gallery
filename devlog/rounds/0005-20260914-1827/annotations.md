# 界面标注 · 轮次 0005-20260914-1827

- 导出时间：2026-09-14T10:27:45.817Z
- 所在界面：gallery
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.1.0
- 标注条数：23

## 总体说明

左侧栏折叠问题、竖图显示问题、筛选逻辑问题
基础调整

## 逐条标注

### 1. 这个×按钮的图标不在按钮中心, 将 按钮左移4px距离，图标放大2px

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar › button.search-clear`
- **选择器**：`div > div.app > header.topbar > div.search:nth-of-type(1) > button.search-clear`
- **父级链**：`div.search` ← `header.topbar` ← `div.app` ← `div` ← `body`
- **位置尺寸**：x=666 y=18 22×22
- **关键样式**：display: grid; position: absolute; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: none; width: 21.9956px; height: 21.9956px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(34, 42, 58); border: 0px none rgb(231, 235, 243); border-radius: 6px; white-space: normal; transition: all; ── 对比度: 12.04:1（AAA）

> 这个×按钮的图标不在按钮中心, 将 按钮左移4px距离，图标放大2px

### 2. 鼠标移动到卡片上时，下方暗角内容，我希望不显示图片大小，仅显示图片分辨率和日期

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › img`
- **选择器**：`main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(1) > div.card-media:nth-of-type(1) > img`
- **父级链**：`div.card-media` ← `div.card` ← `div.grid` ← `main.main` ← `div.app`
- **位置尺寸**：x=195 y=113 229×431
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 220.987px; height: 415.998px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: clip; white-space: normal; transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.25s cubic-bezier(0.22, 0.61, 0.36, 1); object-fit: cover
- **属性**：src="gugu://thumb/19495"

> 鼠标移动到卡片上时，下方暗角内容，我希望不显示图片大小，仅显示图片分辨率和日期

### 3. 图标使用空心的长方体，横边12px 竖边16px；紧凑视图使用2个空心长方体横边8px 竖边16px 间隔4px

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar › svg`
- **选择器**：`div > div.app > header.topbar > button.view-toggle:nth-of-type(1) > svg`
- **父级链**：`button.view-toggle` ← `header.topbar` ← `div.app` ← `div` ← `body`
- **位置尺寸**：x=202 y=21 15×15
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 15px; height: 15px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: hidden; white-space: normal; transition: all

> 图标使用空心的长方体，横边12px 竖边16px；紧凑视图使用2个空心长方体横边8px 竖边16px 间隔4px

### 4. 不显示此栏

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › dt`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > dl.kv:nth-of-type(2) > dt:nth-of-type(3)`
- **父级链**：`dl.kv` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：已装载工具
- **位置尺寸**：x=417 y=428 104×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 103.991px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 不显示此栏

### 5. 不显示此栏

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › dt`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > dl.kv:nth-of-type(1) > dt:nth-of-type(4)`
- **父级链**：`dl.kv` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：标注重叠
- **位置尺寸**：x=417 y=329 104×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 103.991px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 不显示此栏

### 6. "访问网站"

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › button.btn`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > div.modal-actions:nth-of-type(2) > button.btn:nth-of-type(1)`
- **父级链**：`div.modal-actions` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：数据来源
- **位置尺寸**：x=774 y=462 81×34
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 81.3816px; height: 33.9912px; min-width: auto; max-width: none; padding: 0px 14px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 9px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 13.64:1（AAA）

> "访问网站"

### 7. 点击左侧栏时，不呼出"保存已设置"

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Brand › span.brand-toggle`
- **选择器**：`div > div.app > div.brand:nth-of-type(1) > button.brand-mark > span.brand-toggle:nth-of-type(2)`
- **父级链**：`button.brand-mark` ← `div.brand` ← `div.app` ← `div` ← `body`
- **位置尺寸**：x=16 y=15 28×28
- **关键样式**：display: grid; position: absolute; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: 27.9934px; width: 27.9934px; height: 27.9934px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 14px; font-weight: 700; line-height: normal; color: rgb(255, 255, 255); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(255, 255, 255); border-radius: 0px; white-space: normal; transition: opacity 0.16s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.16s cubic-bezier(0.22, 0.61, 0.36, 1)

> 点击左侧栏时，不呼出"保存已设置"

### 8. 调整左栏时不呼出设置已保存

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **选择器**：`html > body > div > div.app > div.sidebar-resizer:nth-of-type(2)`
- **父级链**：`div.app` ← `div` ← `body`
- **位置尺寸**：x=267 y=58 6×658
- **关键样式**：position: fixed; flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 5.99781px; height: 658.498px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgb(124, 156, 255), rgba(0, 0, 0, 0)); border: 0px none rgb(231, 235, 243); border-radius: 0px; opacity: 0.5; white-space: normal; z-index: 12; transition: left 0.16s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.14s cubic-bezier(0.22, 0.61, 0.36, 1)
- **属性**：title="拖动调整侧栏宽度" role="separator"

> 调整左栏时不呼出设置已保存

### 9. 左栏展开/收起功能失效，不能正确收起，收起时不能调整左侧栏宽度

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar`
- **选择器**：`html > body > div > div.app > aside.sidebar`
- **父级链**：`div.app` ← `div` ← `body`
- **元素文本**：资料库全部图片240我的收藏1已下载35待下载205抓取任务分类ACG图片240Pixiv萌图240热门标签女孩子94碧蓝档案28赤脚28东方20脚底20崩坏：星穹铁道19明日方舟18插画17脚指17着袜足底16崩坏314白裤袜12黑丝袜1…
- **位置尺寸**：x=0 y=58 270×658
- **关键样式**：display: flex; flex-direction: column; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 270px; height: 658.498px; min-width: auto; max-width: none; padding: 12px 10px 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.55); border-radius: 0px; white-space: normal; transition: all

> 左栏展开/收起功能失效，不能正确收起，收起时不能调整左侧栏宽度

### 10. 这里的收藏图标同样改成爱心

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Actions › svg`
- **选择器**：`div.lightbox:nth-of-type(3) > div.lightbox-side:nth-of-type(2) > div.lb-actions:nth-of-type(2) > button.btn.sm:nth-of-type(1) > svg`
- **父级链**：`button.btn.sm` ← `div.lb-actions` ← `div.lightbox-side` ← `div.lightbox` ← `div.app`
- **位置尺寸**：x=1041 y=339 13×13
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 12.9934px; height: 12.9934px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(248, 113, 113); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(248, 113, 113); border-radius: 0px; overflow: hidden; white-space: nowrap; transition: all

> 这里的收藏图标同样改成爱心

### 11. "访问网站"

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Actions › button.btn`
- **选择器**：`div.app > div.lightbox:nth-of-type(3) > div.lightbox-side:nth-of-type(2) > div.lb-actions:nth-of-type(2) > button.btn.sm:nth-of-type(4)`
- **父级链**：`div.lb-actions` ← `div.lightbox-side` ← `div.lightbox` ← `div.app` ← `div`
- **元素文本**：原始页面
- **位置尺寸**：x=1031 y=366 89×28
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 89.375px; height: 27.9934px; min-width: auto; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 7px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 13.64:1（AAA）

> "访问网站"

### 12. 三角形箭头 用大一点的指向右边的三角形的2边图标，无需转动动画。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`ContextMenu › button.ctx-item`
- **选择器**：`div > div.app > div.ctx-menu:nth-of-type(4) > div:nth-of-type(3) > button.ctx-item`
- **父级链**：`div` ← `div.ctx-menu` ← `div.app` ← `div` ← `body`
- **元素文本**：打开于…▸
- **位置尺寸**：x=342 y=417 161×32
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 9px; grid-template-columns: none; width: 160.592px; height: 31.5351px; min-width: 0px; max-width: none; padding: 7px 10px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(34, 42, 58); border: 0px none rgb(231, 235, 243); border-radius: 7px; white-space: normal; transition: background 0.12s cubic-bezier(0.22, 0.61, 0.36, 1), color 0.12s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 12.04:1（AAA）

> 三角形箭头 用大一点的指向右边的三角形的2边图标，无需转动动画。
> 当鼠标移动到此选项上时候展开折叠，离开此选项时收起折叠，当然鼠标处于折叠子项中时不要折叠。

### 13. 子筛选项下取消分辨率这一筛选。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/FilterBar › button.pill`
- **选择器**：`div.app > main.main > div.filter-bar:nth-of-type(1) > div.sort-picker > button.pill`
- **父级链**：`div.sort-picker` ← `div.filter-bar` ← `main.main` ← `div.app` ← `div`
- **元素文本**：排序：随机▾
- **位置尺寸**：x=198 y=69 98×26
- **关键样式**：display: inline-flex; flex-direction: row; justify-content: normal; align-items: center; gap: 6px; grid-template-columns: none; width: 98.0921px; height: 25.9978px; min-width: 0px; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 99px; white-space: normal; transition: 0.14s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="排序方式"

> 子筛选项下取消分辨率这一筛选。

### 14. 没有解决竖图显示超出页面问题

- **类别**：缺陷 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage › img`
- **选择器**：`div > div.app > div.lightbox:nth-of-type(3) > div.lightbox-stage:nth-of-type(1) > img`
- **父级链**：`div.lightbox-stage` ← `div.lightbox` ← `div.app` ← `div` ← `body`
- **位置尺寸**：x=24 y=24 964×1713
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 964.09px; height: 1712.97px; min-width: auto; max-width: 100%; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.75) 0px 24px 60px -20px; overflow: clip; white-space: normal; transition: all; object-fit: contain
- **属性**：src="gugu://media/19520"

> 没有解决竖图显示超出页面问题
> 滚轮动作无效

### 15. 在右上角×按钮左侧添加“沉浸模式”隐藏右边栏

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/SidePanel`
- **选择器**：`body > div > div.app > div.lightbox:nth-of-type(3) > div.lightbox-side:nth-of-type(2)`
- **父级链**：`div.lightbox` ← `div.app` ← `div` ← `body`
- **元素文本**：3557x6658 6.14M [匿名-分享]编号19495分辨率3557 × 6658 · 23.7 MP文件大小6.14 MB格式JPG分类ACG图片 / Pixiv萌图发布时间2026-09-11 14:00浏览量16上传者users…
- **位置尺寸**：x=1012 y=0 336×716
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 335.998px; height: 716.491px; min-width: auto; max-width: none; padding: 16px 18px 40px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.92); border-radius: 0px; overflow: auto; white-space: normal; transition: all

> 在右上角×按钮左侧添加“沉浸模式”隐藏右边栏
> 收起时有过渡动画向右移动的平滑动画0.4s
> 左侧图片预览区 移动到居中
> 右上角保留“沉浸模式”按钮
> 再次点击展开右侧栏
> 沉浸模式仅手动切换，每次预览图片默认打开上次沉浸/详细状态

### 16. 注意折叠右边栏时这个元素也要移动到右侧

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage › button.lb-nav`
- **选择器**：`div > div.app > div.lightbox:nth-of-type(3) > div.lightbox-stage:nth-of-type(1) > button.lb-nav.next:nth-of-type(2)`
- **父级链**：`div.lightbox-stage` ← `div.lightbox` ← `div.app` ← `div` ← `body`
- **位置尺寸**：x=956 y=324 42×68
- **关键样式**：display: grid; position: absolute; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: 40.5921px; width: 41.9956px; height: 67.9934px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(255, 255, 255); background-color: rgba(124, 156, 255, 0.22); border: 0.701754px solid rgba(124, 156, 255, 0.4); border-radius: 12px; white-space: normal; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1)
- **属性**：title="下一张 (→)"

> 注意折叠右边栏时这个元素也要移动到右侧

### 17. 这个图标也需要在折叠左侧栏时居中

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Brand › span.brand-toggle`
- **选择器**：`div > div.app.sidebar-collapsed > div.brand:nth-of-type(1) > button.brand-mark > span.brand-toggle:nth-of-type(2)`
- **父级链**：`button.brand-mark` ← `div.brand` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=16 y=15 28×28
- **关键样式**：display: grid; position: absolute; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: 27.9934px; width: 27.9934px; height: 27.9934px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 14px; font-weight: 700; line-height: normal; color: rgb(255, 255, 255); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(255, 255, 255); border-radius: 0px; white-space: normal; transition: opacity 0.16s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.16s cubic-bezier(0.22, 0.61, 0.36, 1)

> 这个图标也需要在折叠左侧栏时居中

### 18. 内容页在标准视图下仅4栏，宽松视图下有6栏

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：3584×6368·8.76 MB·2026-09-14白发 · 女仆pid 119512232 · 11 浏览2160×3456·1.69 MB·2026-09-14女孩子 · 碧蓝档案pid 115534247 · 9 浏览1600×2…
- **位置尺寸**：x=236 y=107 1084×10804
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 0px 14px; grid-template-columns: 205.592px 205.592px 205.592px 205.592px 205.592px; width: 1084.25px; height: 10804.4px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 内容页在标准视图下仅4栏，宽松视图下有6栏
> 你可以适当调整宽度

### 19. 当用户界面中没有看到第一行图片时，且用户正在上滑，则在右下角显示一个圆形按钮，点击即可快速跳转到顶部。当用户下滑时隐藏按

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：3584×6368·8.76 MB·2026-09-14白发 · 女仆pid 119512232 · 11 浏览2160×3456·1.69 MB·2026-09-14女孩子 · 碧蓝档案pid 115534247 · 9 浏览1600×2…
- **位置尺寸**：x=254 y=107 1084×10804
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 0px 14px; grid-template-columns: 205.592px 205.592px 205.592px 205.592px 205.592px; width: 1084.25px; height: 10804.4px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 当用户界面中没有看到第一行图片时，且用户正在上滑，则在右下角显示一个圆形按钮，点击即可快速跳转到顶部。当用户下滑时隐藏按钮，显示/隐藏有过度动画0.2s

### 20. 点击删除按钮后，并不立刻执行删除，按钮文本先变成"你确定吗?" 再次点击后变成 “已删除”，且不可再交互。仅在从灯箱打开

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Actions › button.btn`
- **选择器**：`div.app.sidebar-collapsed > div.lightbox:nth-of-type(2) > div.lightbox-side:nth-of-type(2) > div.lb-actions:nth-of-type(2) > button.btn.sm:nth-of-type(5)`
- **父级链**：`div.lb-actions` ← `div.lightbox-side` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div`
- **元素文本**：删除
- **位置尺寸**：x=1127 y=366 65×28
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 65.3838px; height: 27.9934px; min-width: auto; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(248, 113, 113); background-color: color(srgb 0.972549 0.443137 0.443137 / 0.18); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 7px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1)

> 点击删除按钮后，并不立刻执行删除，按钮文本先变成"你确定吗?" 再次点击后变成 “已删除”，且不可再交互。仅在从灯箱打开预览图时，检查一次图片是否可删除，再转变成初始的样子。2次变化均有0.2s过渡动画。

### 21. 对于已下载的图片预览不显示此选项。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Actions › button.btn`
- **选择器**：`div.app.sidebar-collapsed > div.lightbox:nth-of-type(2) > div.lightbox-side:nth-of-type(2) > div.lb-actions:nth-of-type(2) > button.btn.sm:nth-of-type(3)`
- **父级链**：`div.lb-actions` ← `div.lightbox-side` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div`
- **元素文本**：下载此图
- **位置尺寸**：x=1200 y=267 89×28
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 89.375px; height: 27.9934px; min-width: auto; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 7px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 13.64:1（AAA）

> 对于已下载的图片预览不显示此选项。
> 点击下载此图后，没有立刻执行下载任务，下载任务执行完成后预览界面未刷新。
> 期望，点击后，该按钮的图标转化为箭头转圈动画，文字变成“下载中“，缓解用户等待焦虑，左下角再来个弹窗进度条，弹窗进度条的来源应当与抓取界面下的进度同步

### 22. 你要一次全榨干吗...

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`CrawlPanel › span.help`
- **选择器**：`div.page > section.card-panel:nth-of-type(2) > div.field-grid:nth-of-type(2) > div.field:nth-of-type(3) > span.help`
- **父级链**：`div.field` ← `div.field-grid` ← `section.card-panel` ← `div.page` ← `main.main`
- **元素文本**：先跑 200 张试试水
- **位置尺寸**：x=802 y=362 238×17
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 237.654px; height: 17.0395px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 11px; font-weight: 400; line-height: 17.05px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 你要一次全榨干吗...

### 23. 筛选逻辑存在问题，自行重整

- **类别**：缺陷 ｜ **优先级**：建议改 ｜ **方式**：框选区域
- **组件**：`App/FilterBar › button.pill`
- **选择器**：`区域中心命中 → div > div.app > main.main > div.filter-bar:nth-of-type(1) > button.pill:nth-of-type(3)`
- **父级链**：`div.filter-bar` ← `main.main` ← `div.app` ← `div` ← `body`
- **元素文本**：[区域中心元素] 已下载
- **位置尺寸**：x=261 y=61 553×42
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 6px; grid-template-columns: none; width: 57.3904px; height: 25.9978px; min-width: auto; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(151, 161, 181); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.07); border-radius: 99px; white-space: normal; transition: 0.14s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 6.77:1（AA）
- **属性**：title="仅已下载（只与「待下载」互斥）"

> 筛选逻辑存在问题，自行重整

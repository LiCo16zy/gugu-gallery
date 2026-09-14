# 界面标注 · 轮次 0004-20260914-1646

- 导出时间：2026-09-14T08:46:19.285Z
- 所在界面：gallery
- 视口：1348×696（DPR 1.4249999523162842）
- 应用版本：0.1.0
- 标注条数：34

## 总体说明

基础调整与核心的瀑布流实现

## 逐条标注

### 1. 这里写“来自gugu小站的爱~”

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **选择器**：`div > div.app > div.brand:nth-of-type(1) > div.brand-text:nth-of-type(2) > span.brand-sub:nth-of-type(2)`
- **父级链**：`div.brand-text` ← `div.brand` ← `div.app` ← `div` ← `body`
- **元素文本**：GUGUXZ COLLECTOR
- **位置尺寸**：x=54 y=30 105×12
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 105.329px; height: 12.0724px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 10.5px; font-weight: 400; line-height: 12.075px; letter-spacing: 0.4px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: nowrap; transition: all

> 这里写“来自gugu小站的爱~”

### 2. 此处使用的icon来自外部，外部的icon将作为发布应用时的图标，如果没有外部icon，则启用此处的默认icon。

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **选择器**：`body > div > div.app > div.brand:nth-of-type(1) > div.brand-mark:nth-of-type(1)`
- **父级链**：`div.brand` ← `div.app` ← `div` ← `body`
- **元素文本**：咕
- **位置尺寸**：x=16 y=15 28×28
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: 27.9934px; width: 27.9934px; height: 27.9934px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 14px; font-weight: 700; line-height: 21.7px; color: rgb(255, 255, 255); background-color: rgba(0, 0, 0, 0); background-image: linear-gradient(135deg, rgb(124, 156, 255), rgb(185, 140, 255)); border: 0px none rgb(255, 255, 255); border-radius: 9px; box-shadow: rgb(124, 156, 255) 0px 4px 14px -4px; white-space: normal; transition: all

> 此处使用的icon来自外部，外部的icon将作为发布应用时的图标，如果没有外部icon，则启用此处的默认icon。

### 3. 此处不需要"展开/收起"按钮

- **类别**：布局结构 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar › button.collapse-all`
- **选择器**：`div.app > aside.sidebar > div.side-section:nth-of-type(2) > div.side-title:nth-of-type(1) > button.collapse-all`
- **父级链**：`div.side-title` ← `div.side-section` ← `aside.sidebar` ← `div.app` ← `div`
- **元素文本**：收起
- **位置尺寸**：x=198 y=270 22×14
- **关键样式**：flex-direction: row; justify-content: normal; align-items: flex-start; gap: normal; grid-template-columns: none; width: 21.7982px; height: 14.0351px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 10.5px; font-weight: 400; line-height: normal; letter-spacing: 0.4px; color: rgb(124, 156, 255); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(124, 156, 255); border-radius: 0px; white-space: normal; transition: all

> 此处不需要"展开/收起"按钮

### 4. 改为"应用与存储"

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar › span`
- **选择器**：`div.app > aside.sidebar > div.side-section:nth-of-type(4) > div.side-title:nth-of-type(1) > span`
- **父级链**：`div.side-title` ← `div.side-section` ← `aside.sidebar` ← `div.app` ← `div`
- **元素文本**：占用
- **位置尺寸**：x=18 y=588 23×16
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 22.807px; height: 16.2719px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 10.5px; font-weight: 600; line-height: 16.275px; letter-spacing: 0.9px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 改为"应用与存储"

### 5. 单个数字，单个字母不作为标签

- **类别**：其它 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar/TagChip`
- **选择器**：`div.app > aside.sidebar > div.side-section:nth-of-type(3) > div.tag-cloud:nth-of-type(2) > button.tag-chip:nth-of-type(21)`
- **父级链**：`div.tag-cloud` ← `div.side-section` ← `aside.sidebar` ← `div.app` ← `div`
- **元素文本**：35
- **位置尺寸**：x=16 y=489 35×23
- **关键样式**：flex-direction: row; justify-content: normal; align-items: flex-start; gap: normal; grid-template-columns: none; width: 34.9781px; height: 22.8289px; min-width: auto; max-width: 100%; padding: 3px 9px; margin: 0px; font-size: 11.5px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 99px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: 0.14s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="3 · 5 张"

> 单个数字，单个字母不作为标签

### 6. 不使用"展开/收起"，将此处改为一个图标，图标形状为三角形的其中2边，展开时指向下方，收起时指向左侧，按钮有转动的过渡动

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar › button.collapse-all`
- **选择器**：`div.app > aside.sidebar > div.side-section:nth-of-type(3) > div.side-title:nth-of-type(1) > button.collapse-all`
- **父级链**：`div.side-title` ← `div.side-section` ← `aside.sidebar` ← `div.app` ← `div`
- **元素文本**：收起
- **位置尺寸**：x=198 y=343 22×14
- **关键样式**：flex-direction: row; justify-content: normal; align-items: flex-start; gap: normal; grid-template-columns: none; width: 21.7982px; height: 14.0351px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 10.5px; font-weight: 400; line-height: normal; letter-spacing: 0.4px; color: rgb(124, 156, 255); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(124, 156, 255); border-radius: 0px; white-space: normal; transition: all

> 不使用"展开/收起"，将此处改为一个图标，图标形状为三角形的其中2边，展开时指向下方，收起时指向左侧，按钮有转动的过渡动画0.16s，下方标签内容有逐显和渐隐的过渡动画。

### 7. 此栏的右侧滑块隐藏，以提供沉浸感觉。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar`
- **选择器**：`html > body > div > div.app > aside.sidebar`
- **父级链**：`div.app` ← `div` ← `body`
- **元素文本**：资料库全部图片240我的收藏0已下载35待下载205抓取任务分类收起ACG图片240热门标签收起女孩子94碧蓝档案28赤脚28东方20脚底20崩坏：星穹铁道19明日方舟18插画17脚指17着袜足底16崩坏314白裤袜12黑丝袜11泳装10黑…
- **位置尺寸**：x=0 y=58 248×638
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 247.993px; height: 638.147px; min-width: auto; max-width: none; padding: 12px 10px 24px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.55); border-radius: 0px; overflow: auto; white-space: normal; transition: all

> 此栏的右侧滑块隐藏，以提供沉浸感觉。

### 8. 允许用户拖动左栏控制宽度，但不超过界面总宽的40%

- **类别**：布局结构 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar`
- **选择器**：`html > body > div > div.app > aside.sidebar`
- **父级链**：`div.app` ← `div` ← `body`
- **元素文本**：资料库全部图片240我的收藏0已下载35待下载205抓取任务分类收起ACG图片240热门标签收起女孩子94碧蓝档案28赤脚28东方20脚底20崩坏：星穹铁道19明日方舟18插画17脚指17着袜足底16崩坏314白裤袜12黑丝袜11泳装10黑…
- **位置尺寸**：x=0 y=58 248×638
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 247.993px; height: 638.147px; min-width: auto; max-width: none; padding: 12px 10px 24px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.55); border-radius: 0px; overflow: auto; white-space: normal; transition: all

> 允许用户拖动左栏控制宽度，但不超过界面总宽的40%
> 栏内内容不随拖动改变大小，仅改变宽度

### 9. 左侧栏按钮不在放置在此处

- **类别**：布局结构 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar › button.btn`
- **选择器**：`body > div > div.app.sidebar-collapsed > header.topbar > button.btn.icon:nth-of-type(1)`
- **父级链**：`header.topbar` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=78 y=12 34×34
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 33.9912px; height: 33.9912px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 9px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="折叠/展开侧栏"

> 左侧栏按钮不在放置在此处

### 10. 当鼠标移动到此处时，图标渐变为左侧栏按钮

- **类别**：布局结构 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **选择器**：`body > div > div.app.sidebar-collapsed > div.brand:nth-of-type(1) > div.brand-mark`
- **父级链**：`div.brand` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：咕
- **位置尺寸**：x=16 y=15 28×28
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: 27.9934px; width: 27.9934px; height: 27.9934px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 14px; font-weight: 700; line-height: 21.7px; color: rgb(255, 255, 255); background-color: rgba(0, 0, 0, 0); background-image: linear-gradient(135deg, rgb(124, 156, 255), rgb(185, 140, 255)); border: 0px none rgb(255, 255, 255); border-radius: 9px; box-shadow: rgb(124, 156, 255) 0px 4px 14px -4px; white-space: normal; transition: all

> 当鼠标移动到此处时，图标渐变为左侧栏按钮

### 11. 收起左侧栏时，此按钮形状为长方形，但是图标icon不处于长方形中心，要求置于中心

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar/Item`
- **选择器**：`div > div.app.sidebar-collapsed > aside.sidebar > div.side-section > button.side-item.active:nth-of-type(1)`
- **父级链**：`div.side-section` ← `aside.sidebar` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=10 y=77 43×29
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 9px; grid-template-columns: none; width: 43.2895px; height: 28.9912px; min-width: 0px; max-width: none; padding: 7px 9px; margin: 0px; font-size: 13px; font-weight: 550; line-height: normal; color: rgb(124, 156, 255); background-color: rgba(124, 156, 255, 0.14); border: 0px none rgb(124, 156, 255); border-radius: 8px; white-space: normal; transition: background 0.14s cubic-bezier(0.22, 0.61, 0.36, 1), color 0.14s cubic-bezier(0.22, 0.61, 0.36, 1)
- **属性**：title="全部图片"

> 收起左侧栏时，此按钮形状为长方形，但是图标icon不处于长方形中心，要求置于中心

### 12. 展开左侧栏时添加过度动画效果，动画时间0.16s

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar`
- **选择器**：`html > body > div > div.app.sidebar-collapsed > aside.sidebar`
- **父级链**：`div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=0 y=58 64×638
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 63.9912px; height: 638.147px; min-width: auto; max-width: none; padding: 12px 10px 24px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.55); border-radius: 0px; overflow: auto; white-space: normal; transition: all

> 展开左侧栏时添加过度动画效果，动画时间0.16s

### 13. 当左栏展开/收起时，内容页的动画效果是重排前布局先变暗（透明化至背景色一致），重排后布局再变亮（逐渐不透明），变暗+变亮

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：2160×1080·1.65 MB明日方舟 · 空弦（明日方舟）2160×1080 · 1.65 MB · pid 118816127竖图3584×6368·8.76 MB白发 · 女仆3584×6368 · 8.76 MB · pid 1…
- **位置尺寸**：x=64 y=6 1274×4533
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 14px; grid-template-columns: 236.458px 236.458px 236.458px 236.458px 236.458px; width: 1274.25px; height: 4532.87px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 当左栏展开/收起时，内容页的动画效果是重排前布局先变暗（透明化至背景色一致），重排后布局再变亮（逐渐不透明），变暗+变亮总时间为0.16s，且透明度变化曲线应平滑，低暗时间(透明度低于30%)时长不超过0.06s

### 14. 当用户在此页面下滑浏览时，此栏隐藏，有向上隐藏的过渡动画，约0.12s。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/FilterBar`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.filter-bar:nth-of-type(1)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：全部收藏已下载待下载横图竖图共 240 条 · 已显示 60
- **位置尺寸**：x=64 y=58 1274×49
- **关键样式**：display: flex; position: sticky; flex-direction: row; justify-content: normal; align-items: center; gap: 8px; grid-template-columns: none; width: 1274.25px; height: 48.6952px; min-width: 0px; max-width: none; padding: 11px 18px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0431373 0.054902 0.0784314 / 0.86); border-radius: 0px; white-space: normal; z-index: 5; transition: all

> 当用户在此页面下滑浏览时，此栏隐藏，有向上隐藏的过渡动画，约0.12s。
> 当用户上滑时，此栏显示，有向下展开的过度动画约0.16s。

### 15. 收藏图标的样式改成爱心

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar/Item › path`
- **选择器**：`aside.sidebar > div.side-section > button.side-item:nth-of-type(2) > svg > path`
- **父级链**：`svg` ← `button.side-item` ← `div.side-section` ← `aside.sidebar` ← `div.app.sidebar-collapsed`
- **位置尺寸**：x=21 y=115 11×10
- **关键样式**：display: inline; flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: auto; height: auto; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 收藏图标的样式改成爱心

### 16. 仅显示pid和浏览量，分辨率和大小不显示

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › div.card-tags`
- **选择器**：`main.main > div.grid:nth-of-type(2) > div.card > div.card-body:nth-of-type(2) > div.card-tags:nth-of-type(2)`
- **父级链**：`div.card-body` ← `div.card` ← `div.grid` ← `main.main` ← `div.app.sidebar-collapsed`
- **元素文本**：2160×3456 · 1.69 MB · pid 115534247
- **位置尺寸**：x=94 y=531 215×17
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 215.022px; height: 17.0395px; min-width: 0px; max-width: none; padding: 0px; margin: 3px 0px 0px; font-size: 11px; font-weight: 400; line-height: 17.05px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: all

> 仅显示pid和浏览量，分辨率和大小不显示

### 17. 收藏按钮没有显示，我希望收藏按钮仅在用户把鼠标移到卡片上时显示收藏按钮，按钮图标为空心的爱心 。点击后爱心显色，为实心。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › button.btn`
- **选择器**：`div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(2) > button.btn.icon`
- **父级链**：`div.card` ← `div.grid` ← `main.main` ← `div.app.sidebar-collapsed` ← `div`
- **位置尺寸**：x=534 y=488 28×28
- **关键样式**：display: flex; position: absolute; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 27.9934px; height: 27.9934px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 7px; opacity: 0; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="收藏"

> 收藏按钮没有显示，我希望收藏按钮仅在用户把鼠标移到卡片上时显示收藏按钮，按钮图标为空心的爱心 。点击后爱心显色，为实心。之后鼠标移开卡片，按钮隐藏，但爱心依旧显示。

### 18. 卡片的右上角收藏标记取消

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › img`
- **选择器**：`main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(2) > div.card-media:nth-of-type(1) > img`
- **父级链**：`div.card-media` ← `div.card` ← `div.grid` ← `main.main` ← `div.app.sidebar-collapsed`
- **位置尺寸**：x=329 y=114 243×389
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 235.055px; height: 376.075px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: clip; white-space: normal; transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.25s cubic-bezier(0.22, 0.61, 0.36, 1)
- **属性**：src="gugu://thumb/19519"

> 卡片的右上角收藏标记取消

### 19. 横图可以占1-2栏宽，适当调整

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：竖图3584×6368·8.76 MB白发 · 女仆3584×6368 · 8.76 MB · pid 119512232竖图2160×3456·1.69 MB女孩子 · 碧蓝档案2160×3456 · 1.69 MB · pid 1155…
- **位置尺寸**：x=64 y=107 1274×4984
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 14px; grid-template-columns: 236.458px 236.458px 236.458px 236.458px 236.458px; width: 1274.25px; height: 4984.44px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 横图可以占1-2栏宽，适当调整
> 现在第一行的卡片上方平齐，由于图片高度不同，第二行显示的卡片顶部为第一行最高卡片的底部。我想要不同高度错落的瀑布效果，每一卡片的底部即为下一张卡片顶部（不用太密集，现在的卡片间隔大小是合适的）。
> 当用户下滑时，新卡片从透明转化为不透明，过渡动画效果约0.06s，各个卡片过度动画各自独立播放。
> 由于有的横图可能占1-2栏宽，需要你仔细考虑如何设计这种非严格对称的显示效果

### 20. 我注意到 已下载和待下载是互斥关系，更合理的逻辑应是 待下载和其他选项均互斥，已下载则仅与待下载互斥。

- **类别**：交互行为 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/FilterBar › button.pill`
- **选择器**：`div > div.app.sidebar-collapsed > main.main > div.filter-bar:nth-of-type(1) > button.pill:nth-of-type(4)`
- **父级链**：`div.filter-bar` ← `main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：待下载
- **位置尺寸**：x=254 y=69 57×26
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 6px; grid-template-columns: none; width: 57.3904px; height: 25.9978px; min-width: auto; max-width: none; padding: 0px 10px; margin: 0px; font-size: 12px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 99px; white-space: normal; transition: 0.14s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）

> 我注意到 已下载和待下载是互斥关系，更合理的逻辑应是 待下载和其他选项均互斥，已下载则仅与待下载互斥。

### 21. 当鼠标移上去式，下方暗角显示的内容，除了分辨率和图片体积，还要显示发布时间，时间格式为 20XX-XX-XX

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card › img`
- **选择器**：`main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(2) > div.card-media:nth-of-type(1) > img`
- **父级链**：`div.card-media` ← `div.card` ← `div.grid` ← `main.main` ← `div.app.sidebar-collapsed`
- **位置尺寸**：x=329 y=113 243×432
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 235.055px; height: 417.862px; min-width: 0px; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: clip; white-space: normal; transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.25s cubic-bezier(0.22, 0.61, 0.36, 1)
- **属性**：src="gugu://thumb/19520"

> 当鼠标移上去式，下方暗角显示的内容，除了分辨率和图片体积，还要显示发布时间，时间格式为 20XX-XX-XX

### 22. 添加卡片的右键事件：“收藏” “复制pid”（将pid的值复制到剪贴板，弹出提示“已复制 pid” ，提示显示和过渡时间

- **类别**：交互行为 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid/Card`
- **选择器**：`div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2) > div.card:nth-of-type(2)`
- **父级链**：`div.grid` ← `main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：竖图3584×6368·8.76 MB白发 · 女仆3584×6368 · 8.76 MB · pid 119512232
- **位置尺寸**：x=332 y=120 236×479
- **关键样式**：position: relative; flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 236.458px; height: 478.662px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 11px; box-shadow: rgba(0, 0, 0, 0.6) 0px 8px 24px -8px; overflow: hidden; white-space: normal; transition: transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1), border-color 0.18s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.18s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 14.72:1（AAA）
- **属性**：title="3584x6368 8.76M [匿名-分享]"

> 添加卡片的右键事件：“收藏” “复制pid”（将pid的值复制到剪贴板，弹出提示“已复制 pid” ，提示显示和过渡时间0.8s，其中渐显渐隐时间均为0.08s）“打开于...”（展示折叠选项：文件管理器（打开本地存储的图片位置），Pixel（浏览器根据pid直接跳转到pixel网站下对应的pid图片））

### 23. 此分类按钮不放置在这里

- **类别**：布局结构 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar › select.select`
- **选择器**：`body > div > div.app.sidebar-collapsed > header.topbar > select.select`
- **父级链**：`header.topbar` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：最新发布最早上传浏览量文件体积分辨率标题随机
- **位置尺寸**：x=953 y=12 92×34
- **关键样式**：flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: none; width: 92.0285px; height: 33.9912px; min-width: auto; max-width: none; padding: 0px 28px 0px 10px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); background-image: linear-gradient(45deg, rgba(0, 0, 0, 0) 50%, rgb(102, 112, 133) 50%), linear-gradient(135deg, rgb(102, 112, 133) 50%, rgba(0, 0, 0, 0) 50%); border: 0.701754px solid rgba(255, 255, 255, 0.07); border-radius: 9px; white-space: pre; transition: all; ── 对比度: 14.72:1（AAA）
- **属性**：title="排序方式"

> 此分类按钮不放置在这里

### 24. 将 “最新发布最早上传浏览量文件体积分辨率标题随机”

- **类别**：布局结构 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/FilterBar`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.filter-bar:nth-of-type(1)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：全部收藏已下载待下载横图竖图共 240 条 · 已显示 60
- **位置尺寸**：x=64 y=58 1274×49
- **关键样式**：display: flex; position: sticky; flex-direction: row; justify-content: normal; align-items: center; gap: 8px; grid-template-columns: none; width: 1274.25px; height: 48.6952px; min-width: 0px; max-width: none; padding: 11px 18px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0431373 0.054902 0.0784314 / 0.86); border-radius: 0px; white-space: normal; z-index: 5; transition: all

> 将 “最新发布最早上传浏览量文件体积分辨率标题随机”
> 放置在此处作为折叠的筛选项。

### 25. 此按钮不放置在此处，显示在此栏左侧，搜索栏的左侧。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar › div.seg`
- **选择器**：`body > div > div.app.sidebar-collapsed > header.topbar > div.seg:nth-of-type(3)`
- **父级链**：`header.topbar` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=1055 y=14 75×28
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: normal; gap: 2px; grid-template-columns: none; width: 75.3728px; height: 28.3662px; min-width: auto; max-width: none; padding: 3px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.07); border-radius: 9px; white-space: normal; transition: all; ── 对比度: 14.72:1（AAA）

> 此按钮不放置在此处，显示在此栏左侧，搜索栏的左侧。
> 此按钮的2个图标一致，只是大小相差了几个像素，用户看不清楚。
> 将2个按钮合并为1个，标准视图显示时，图标为1个长方形(略有圆角，横边短，竖边长)；紧凑视图显示时，图标为2个长方形(也是2个竖边长的长方形)；点击按钮切换时，按钮具有渐显渐隐过度动画，动画时间0.08s; 内容页的动画效果是重排前布局先变暗（透明化至背景色一致），重排后布局再变亮（逐渐不透明），变暗+变亮总时间为0.16s，且透明度变化曲线应平滑，低暗时间(透明度低于30%)时长不超过0.06s

### 26. 检查这个“设置已保存”，是否是一致显示在这里，而不是在显示2s后再隐藏

- **类别**：交互行为 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **选择器**：`html > body > div > div.app.sidebar-collapsed > div.toast:nth-of-type(3)`
- **父级链**：`div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：设置已保存
- **位置尺寸**：x=625 y=595 98×40
- **关键样式**：position: fixed; flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 98.3882px; height: 39.5395px; min-width: 0px; max-width: none; padding: 9px 16px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 10px; box-shadow: rgba(0, 0, 0, 0.6) 0px 8px 24px -8px; white-space: normal; z-index: 90; transition: all; ── 对比度: 13.64:1（AAA）

> 检查这个“设置已保存”，是否是一致显示在这里，而不是在显示2s后再隐藏

### 27. 2行，分别为

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`SettingsPanel › section.card-panel`
- **选择器**：`div > div.app.sidebar-collapsed > main.main > div.page > section.card-panel:nth-of-type(4)`
- **父级链**：`div.page` ← `main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：外观深色浅色主题色
- **位置尺寸**：x=86 y=369 1036×98
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 1036.01px; height: 98.4649px; min-width: 0px; max-width: none; padding: 16px 18px; margin: 0px 0px 14px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.07); border-radius: 16px; white-space: normal; transition: all; ── 对比度: 14.72:1（AAA）

> 2行，分别为
> 主题色
> 深色/浅色/跟随系统

### 28. 不需要这3个按钮，做2个按钮

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar › div.seg`
- **选择器**：`body > div > div.app.sidebar-collapsed > header.topbar > div.seg:nth-of-type(4)`
- **父级链**：`header.topbar` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：图库抓取设置
- **位置尺寸**：x=1185 y=12 149×33
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: normal; gap: 2px; grid-template-columns: none; width: 149.375px; height: 32.9167px; min-width: auto; max-width: none; padding: 3px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgb(20, 25, 36); border: 0.701754px solid rgba(255, 255, 255, 0.07); border-radius: 9px; white-space: normal; transition: all; ── 对比度: 14.72:1（AAA）

> 不需要这3个按钮，做2个按钮
> 将这个2个新按钮放置在左侧栏的最底部
> 帮助，图标为一个圆圈，中间一个i 的样子
> 设置，齿轮图标

### 29. 这里并不是我想标注"最新发布最早上传浏览量文件体积分辨率标题随机图库..."这些内容，我想标注的内容是，应用自带的上方w

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/TopBar`
- **选择器**：`html > body > div > div.app.sidebar-collapsed > header.topbar`
- **父级链**：`div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：最新发布最早上传浏览量文件体积分辨率标题随机图库抓取设置
- **位置尺寸**：x=64 y=0 1284×58
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 10px; grid-template-columns: none; width: 1284.08px; height: 57.9934px; min-width: auto; max-width: none; padding: 0px 14px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.82); border-radius: 0px; white-space: normal; transition: all

> 这里并不是我想标注"最新发布最早上传浏览量文件体积分辨率标题随机图库..."这些内容，我想标注的内容是，应用自带的上方windows边框，为了软件风格统一和提供沉浸式，我希望在界面的右上角提供“最小化，缩放窗口，关闭”，取消win的边框

### 30. 将帮助按钮和设置按钮放置在此处下方

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Sidebar › div.side-title`
- **选择器**：`div > div.app > aside.sidebar > div.side-section:nth-of-type(4) > div.side-title:nth-of-type(1)`
- **父级链**：`div.side-section` ← `aside.sidebar` ← `div.app` ← `div` ← `body`
- **元素文本**：占用
- **位置尺寸**：x=10 y=588 217×23
- **关键样式**：display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: normal; grid-template-columns: none; width: 217.467px; height: 23.2675px; min-width: 0px; max-width: none; padding: 0px 8px 7px; margin: 0px; font-size: 10.5px; font-weight: 600; line-height: 16.275px; letter-spacing: 0.9px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 将帮助按钮和设置按钮放置在此处下方

### 31. 点击卡片展开详细浏览界面，对于竖屏图片来说应该以完全显示长边，现在我能看到所有竖屏图的短边，但是长边显示在页面外了，应适

- **类别**：缺陷 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage › img`
- **选择器**：`div > div.app.sidebar-collapsed > div.lightbox:nth-of-type(2) > div.lightbox-stage:nth-of-type(1) > img`
- **父级链**：`div.lightbox-stage` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **位置尺寸**：x=162 y=252 960×1706
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 960.077px; height: 1705.84px; min-width: auto; max-width: 100%; padding: 0px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.75) 0px 24px 60px -20px; overflow: clip; white-space: normal; transition: transform 0.12s linear; object-fit: contain
- **属性**：src="gugu://media/19520"

> 点击卡片展开详细浏览界面，对于竖屏图片来说应该以完全显示长边，现在我能看到所有竖屏图的短边，但是长边显示在页面外了，应适当调整
> 部分横图同样有显示不全的问题，适当调整
> 这个界面的左键逻辑重复了，当前的逻辑是：按下左键后松开是放大图片，然后按住左键可以拖动图片，当松开左键时回退放大，导致拖动一次就会回退放大图片，原图大小时不能拖动图片。我希望的操作逻辑：左键拖动图片，鼠标滚轮缩放图片大小。

### 32. 缩放选项应可以小于100%，最低为25%。

- **类别**：交互行为 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/SidePanel › div.row`
- **选择器**：`div > div.app.sidebar-collapsed > div.lightbox:nth-of-type(2) > div.lightbox-side:nth-of-type(2) > div.row:nth-of-type(3)`
- **父级链**：`div.lightbox-side` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：100%重置
- **位置尺寸**：x=1031 y=435 299×28
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 6px; grid-template-columns: none; width: 299.309px; height: 27.9934px; min-width: 0px; max-width: none; padding: 0px; margin: 0px 0px 16px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 缩放选项应可以小于100%，最低为25%。

### 33. 此用户为上传者，并非画师，不显示画师项

- **类别**：其它 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/SidePanel › dt`
- **选择器**：`div.app.sidebar-collapsed > div.lightbox:nth-of-type(2) > div.lightbox-side:nth-of-type(2) > dl.kv > dt:nth-of-type(10)`
- **父级链**：`dl.kv` ← `div.lightbox-side` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div`
- **元素文本**：画师
- **位置尺寸**：x=1031 y=281 74×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 73.9912px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 此用户为上传者，并非画师，不显示画师项

### 34. 上传者并非 匿名-分享 为下方users/82841050

- **类别**：其它 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/SidePanel › dd`
- **选择器**：`div.app.sidebar-collapsed > div.lightbox:nth-of-type(2) > div.lightbox-side:nth-of-type(2) > dl.kv > dd:nth-of-type(8)`
- **父级链**：`dl.kv` ← `div.lightbox-side` ← `div.lightbox` ← `div.app.sidebar-collapsed` ← `div`
- **元素文本**：匿名-分享
- **位置尺寸**：x=1115 y=232 215×19
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 215.318px; height: 18.5855px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 12px; font-weight: 400; line-height: 18.6px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 上传者并非 匿名-分享 为下方users/82841050
> 注意修改处理的逻辑

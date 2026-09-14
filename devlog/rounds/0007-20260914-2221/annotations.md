# 界面标注 · 轮次 0007-20260914-2221

- 导出时间：2026-09-14T14:21:50.379Z
- 所在界面：gallery
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.1.0
- 标注条数：4

## 总体说明

沉浸模式优化，内容页动画优化

## 逐条标注

### 1. 调整布局重排时的卡片过度动画速度，太快了，变暗（透明）0.6s, 变亮（不透明）0.6s，动画过度平滑，整个过度动画低暗

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：2400×936·2026-09-14碧蓝档案pid 112677955 · 8 浏览1024×1024·2026-09-14米浴（赛马娘）pid 119027500 · 9 浏览2160×1080·2026-09-14明日方舟 · 空弦（…
- **位置尺寸**：x=64 y=107 1274×3237
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 0px 14px; grid-template-columns: 164.846px 164.846px 164.846px 164.846px 164.846px 164.846px 164.846px; width: 1274.25px; height: 3237.05px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 调整布局重排时的卡片过度动画速度，太快了，变暗（透明）0.6s, 变亮（不透明）0.6s，动画过度平滑，整个过度动画低暗时间(透明度低于30%)不超过0.6s

### 2. 删除文本，仅保留图标，图标按钮透明，仅保留图标。图标大小放大4px

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage › button.lb-exit-immersive`
- **选择器**：`div > div.app.sidebar-collapsed > div.lightbox.immersive:nth-of-type(2) > div.lightbox-stage:nth-of-type(1) > button.lb-exit-immersive:nth-of-type(1)`
- **父级链**：`div.lightbox-stage` ← `div.lightbox.immersive` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：退出沉浸
- **位置尺寸**：x=1232 y=14 102×34
- **关键样式**：display: flex; position: absolute; flex-direction: row; justify-content: normal; align-items: center; gap: 7px; grid-template-columns: none; width: 102.368px; height: 33.9912px; min-width: 0px; max-width: none; padding: 0px 14px; margin: 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(231, 235, 243); background-color: rgba(124, 156, 255, 0.24); border: 0.701754px solid rgba(124, 156, 255, 0.5); border-radius: 9px; white-space: normal; z-index: 5; transition: 0.16s cubic-bezier(0.22, 0.61, 0.36, 1)
- **属性**：title="退出沉浸模式"

> 删除文本，仅保留图标，图标按钮透明，仅保留图标。图标大小放大4px

### 3. 当进入沉浸模式时，在切换图片时，右下角从右到左平滑弹出标题描述文本框，过渡动画0.6s，文本框的边框透明，背景透明，仅有

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`Lightbox/Stage`
- **选择器**：`body > div > div.app.sidebar-collapsed > div.lightbox.immersive:nth-of-type(2) > div.lightbox-stage:nth-of-type(1)`
- **父级链**：`div.lightbox.immersive` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：退出沉浸
- **位置尺寸**：x=0 y=0 1348×716
- **关键样式**：display: grid; position: relative; flex-direction: row; justify-content: normal; align-items: center; gap: normal; grid-template-columns: none; width: 1348.07px; height: 716.491px; min-width: 0px; max-width: none; padding: 24px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; overflow: hidden; white-space: normal; transition: all

> 当进入沉浸模式时，在切换图片时，右下角从右到左平滑弹出标题描述文本框，过渡动画0.6s，文本框的边框透明，背景透明，仅有下边框有4px粗白线。仅在文本框完全淡出界面时，且用户切换到上一张或下一张图片时触发文本框弹入，文本框弹入后保持2s，之后文本框向下平滑滑出界面，过度动画0.6s。文本框保持的2s时间内，用户继续切换图片时，立刻改变文本框内容，并重置保持时间为2s。在文本框淡出动画时，用户切换界面，则从右到左弹出新的文本框。当用户退出沉浸模式时，文本框立刻0.6s淡出。当用户保持沉浸模式时，退出灯箱，文本框立刻0.6s淡出，当用户保持沉浸模式时，进入别的灯箱，文本框不淡入，仅在切换图片时候播放淡入-保持-淡出。
> 文本框内容：2845x4500 17.53M [匿名-分享]
> 类似这种标题，文字大小 22px

### 4. 向下浏览时，对于用户界面外的卡片，当进入页面内高度超过20%时，播放淡入动画，从全透明平滑过度到不透明，动画时间0.4s

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app.sidebar-collapsed > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app.sidebar-collapsed` ← `div` ← `body`
- **元素文本**：2400×936·2026-09-14碧蓝档案pid 112677955 · 8 浏览1024×1024·2026-09-14米浴（赛马娘）pid 119027500 · 9 浏览2160×1080·2026-09-14明日方舟 · 空弦（…
- **位置尺寸**：x=64 y=107 1274×3237
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 0px 14px; grid-template-columns: 164.846px 164.846px 164.846px 164.846px 164.846px 164.846px 164.846px; width: 1274.25px; height: 3237.05px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 向下浏览时，对于用户界面外的卡片，当进入页面内高度超过20%时，播放淡入动画，从全透明平滑过度到不透明，动画时间0.4s，之后不再淡出。
> 仅在用户切换分类，切换筛选条件，搜索时触发了页面重排，才会对用户界面以外的卡片进行隐藏，在用户向下滑动过程中播放淡入动画。在用户调整窗口大小，切换左侧边栏，拖动左侧边栏触发页面重排时，不会去隐藏那些已经播放完淡入动画的卡片。
> 这里的逻辑该请你自行梳理，实现以上效果的同时要考虑是否可以兼容性能优化，防止在用户浏览一万张图片这个量级时造成卡顿。

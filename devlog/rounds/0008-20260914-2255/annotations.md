# 界面标注 · 轮次 0008-20260914-2255

- 导出时间：2026-09-14T14:55:16.918Z
- 所在界面：gallery
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.5.0
- 标注条数：2

## 总体说明

细节动画调整，顶部边框在灯箱时不可拖动

## 逐条标注

### 1. 问题没有解决，这里的隐藏式边框依旧在灯箱模式下应用窗口可以被拖动，点击按钮位置倒是没有触发拖动，我希望在灯箱模式下不会触

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：框选区域
- **组件**：`App/TopBar`
- **选择器**：`区域中心命中 → html > body > div > div.app > header.topbar`
- **父级链**：`div.app` ← `div` ← `body`
- **元素文本**：[区域中心元素] 
- **位置尺寸**：x=184 y=0 1162×60
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 10px; grid-template-columns: none; width: 1168.07px; height: 57.9934px; min-width: auto; max-width: none; padding: 0px 10px 0px 14px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: color(srgb 0.0588235 0.0745098 0.105882 / 0.82); border-radius: 0px; white-space: normal; transition: all

> 问题没有解决，这里的隐藏式边框依旧在灯箱模式下应用窗口可以被拖动，点击按钮位置倒是没有触发拖动，我希望在灯箱模式下不会触发拖动戳你港口

### 2. 左侧栏展开和折叠不应该触发重排动画，回退对重排动画的速度修改，现在重排动画太慢了，其他地方的重排动画速度倒是很合适。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`GalleryGrid`
- **选择器**：`body > div > div.app > main.main > div.grid:nth-of-type(2)`
- **父级链**：`main.main` ← `div.app` ← `div` ← `body`
- **元素文本**：2400×936·2026-09-14碧蓝档案pid 112677955 · 8 浏览1024×1024·2026-09-14米浴（赛马娘）pid 119027500 · 9 浏览2160×1080·2026-09-14明日方舟 · 空弦（…
- **位置尺寸**：x=180 y=107 1158×3991
- **关键样式**：display: grid; flex-direction: row; justify-content: normal; align-items: start; gap: 0px 14px; grid-template-columns: 175.329px 175.329px 175.329px 175.329px 175.329px 175.329px; width: 1158.25px; height: 3991.39px; min-width: 0px; max-width: none; padding: 16px 18px 60px; margin: 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 左侧栏展开和折叠不应该触发重排动画，回退对重排动画的速度修改，现在重排动画太慢了，其他地方的重排动画速度倒是很合适。

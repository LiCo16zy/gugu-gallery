# 界面标注 · 轮次 0013-20260916-0929

- 导出时间：2026-09-16T01:29:34.517Z
- 所在界面：crawl
- 视口：1348×716（DPR 1.4249999523162842）
- 应用版本：0.6.2
- 标注条数：7

## 总体说明

登录状态修改

## 逐条标注

### 1. 这是我想要的效果。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/Help › button.btn`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal > div.modal-actions:nth-of-type(2) > button.btn.btn-left:nth-of-type(1)`
- **父级链**：`div.modal-actions` ← `div.modal` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：已登录
- **位置尺寸**：x=417 y=438 68×34
- **关键样式**：display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 7px; grid-template-columns: none; width: 68.3772px; height: 33.9912px; min-width: auto; max-width: none; padding: 0px 14px; margin: 0px 280.482px 0px 0px; font-size: 13px; font-weight: 400; line-height: normal; color: rgb(151, 161, 181); background-color: rgb(26, 32, 45); border: 0.701754px solid rgba(255, 255, 255, 0.13); border-radius: 9px; white-space: nowrap; transition: 0.15s cubic-bezier(0.22, 0.61, 0.36, 1); ── 对比度: 6.27:1（AA）

> 这是我想要的效果。
> 如果用户点击此按钮，跳转到登录界面。
> 处于已登录状态时，不跳转到登录界面。
> 当用户点击已登陆时，文字上下小幅度抖动，点击第3次时，“已登录”字段平滑切换成“退出登录?”，按钮边框和字体变红。点击"退出登录?"用户退出当前登陆状态，登录凭据清理和数据安全你来考虑。
> 点击"退出登录?"后字段切换成"已退出",变灰色且不可点击，仅下一次打开这个帮助界面时，可点击登录按钮。

### 2. 登录态 改为 登陆状态

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › div.panel-title`
- **选择器**：`div > div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > div.panel-title:nth-of-type(1)`
- **父级链**：`div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div` ← `body`
- **元素文本**：登录态已登录 8i77…gk34 · 已加密保存
- **位置尺寸**：x=437 y=257 475×20
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 8px; grid-template-columns: none; width: 474.605px; height: 20.1535px; min-width: 0px; max-width: none; padding: 0px; margin: 0px 0px 8px; font-size: 13px; font-weight: 600; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 登录态 改为 登陆状态

### 3. 删除此处3个按钮，移到下方

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › div.row`
- **选择器**：`div > div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > div.row:nth-of-type(2)`
- **父级链**：`div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div` ← `body`
- **元素文本**：保存并验证重新验证清除
- **位置尺寸**：x=437 y=417 475×28
- **关键样式**：display: flex; flex-direction: row; justify-content: normal; align-items: center; gap: 8px; grid-template-columns: none; width: 474.605px; height: 27.9934px; min-width: 0px; max-width: none; padding: 0px; margin: 8px 0px 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 删除此处3个按钮，移到下方
> “清除”按钮的功能由"确定退出?"替代

### 4. 此处放2个按钮，分别是：

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › div.modal-actions`
- **选择器**：`div > div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > div.modal-actions:nth-of-type(3)`
- **父级链**：`div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div` ← `body`
- **元素文本**：去浏览器登录关闭
- **位置尺寸**：x=437 y=461 475×34
- **关键样式**：display: flex; flex-direction: row; justify-content: flex-end; align-items: normal; gap: 8px; grid-template-columns: none; width: 474.605px; height: 33.9912px; min-width: 0px; max-width: none; padding: 0px; margin: 16px 0px 0px; font-size: 13px; font-weight: 400; line-height: 20.15px; color: rgb(231, 235, 243); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(231, 235, 243); border-radius: 0px; white-space: normal; transition: all

> 此处放2个按钮，分别是：
> 保存并验证、去浏览器登录
> 
> 保存并验证按钮，在点击后变灰，不可点击，1s后恢复正常，当成功登录后，变为“重新验证”，同样有1s触发冷却。
> 去浏览器登录按钮同样有1s触发冷却

### 5. 改为

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › p.setup-error`
- **选择器**：`div > div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > p.setup-error:nth-of-type(1)`
- **父级链**：`div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div` ← `body`
- **元素文本**：站点仍然把我当成未登录（首页还是「登录 / 注册」），cookie 可能已过期
- **位置尺寸**：x=437 y=264 475×43
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 474.605px; height: 42.6535px; min-width: 0px; max-width: none; padding: 10px 13px; margin: 0px; font-size: 12.5px; font-weight: 400; line-height: 21.25px; color: rgb(248, 113, 113); background-color: color(srgb 0.972549 0.443137 0.443137 / 0.12); border: 0.701754px solid color(srgb 0.972549 0.443137 0.443137 / 0.34); border-radius: 10px; white-space: normal; transition: all

> 改为
> cookie 已过期，请重新登录

### 6. 删除文本

- **类别**：文案内容 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › span.hint`
- **选择器**：`div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > div.panel-title:nth-of-type(1) > span.hint`
- **父级链**：`div.panel-title` ← `div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div`
- **元素文本**：未登录 · 只影响「泳装分享」分类
- **位置尺寸**：x=484 y=237 170×18
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 169.726px; height: 17.818px; min-width: auto; max-width: none; padding: 0px; margin: 0px; font-size: 11.5px; font-weight: 400; line-height: 17.825px; color: rgb(102, 112, 133); background-color: rgba(0, 0, 0, 0); border: 0px none rgb(102, 112, 133); border-radius: 0px; white-space: normal; transition: all

> 删除文本
> " · 只影响「泳装分享」分类"

### 7. 这里的红字提示部分移到帮助界面下，包括“cookie 已过期，请重新登录”、“已清除本地登录凭据”等红字提示。

- **类别**：视觉样式 ｜ **优先级**：建议改 ｜ **方式**：点选元素
- **组件**：`App/LoginGuide › p.setup-error`
- **选择器**：`div > div.app > div.modal-mask:nth-of-type(4) > div.modal.login-guide > p.setup-error:nth-of-type(1)`
- **父级链**：`div.modal.login-guide` ← `div.modal-mask` ← `div.app` ← `div` ← `body`
- **元素文本**：已清除本地登录凭据
- **位置尺寸**：x=437 y=264 475×43
- **关键样式**：flex-direction: row; justify-content: normal; align-items: normal; gap: normal; grid-template-columns: none; width: 474.605px; height: 42.6535px; min-width: 0px; max-width: none; padding: 10px 13px; margin: 0px; font-size: 12.5px; font-weight: 400; line-height: 21.25px; color: rgb(248, 113, 113); background-color: color(srgb 0.972549 0.443137 0.443137 / 0.12); border: 0.701754px solid color(srgb 0.972549 0.443137 0.443137 / 0.34); border-radius: 10px; white-space: normal; transition: all

> 这里的红字提示部分移到帮助界面下，包括“cookie 已过期，请重新登录”、“已清除本地登录凭据”等红字提示。
> 红字提示在用户关闭当前窗口再打开时，红字提示部分不再显示。

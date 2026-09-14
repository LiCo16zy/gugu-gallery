# 轮次 0009-installer-polish · 应用图标、可选安装位置、首次启动向导

- 时间：2026-09-14
- 起点提交：`2bddfc5`
- 状态：**已收尾**
- 应用版本：0.5.1
- 反馈来源：用户当面反馈（非标注）
- 用户原话：**这个安装包太不健康了**

## 背景

0.5.1 的安装包虽然打出来了，但体验很差：

1. **图标是 Electron 的默认脸** —— 从安装程序到任务栏、文件属性，全是 Electron 标志
2. **安装位置没法选** —— `oneClick: true` 意味着双击就直接装到默认位置
3. **装完直接开跑** —— 用户没有机会决定图片存哪，程序默默用了系统图片目录

## 改动

### 一、应用图标

本机没有 sharp / ImageMagick，所以走了一条不需要任何图形库的路：
**用 Electron 自己渲染一段 SVG，再截图成 PNG**。

`scripts/make-icon.mjs` 做了这件事：

- 图标本体是内联 SVG —— 渐变圆角方块 + 品牌字「咕」，透明背景
- 渲染到 `build/icon.png`（512×512）
- electron-builder 会自动把它转成 Windows 的 `.ico`，
  应用图标与安装程序图标共用同一份

好处不只是省依赖：**矢量源跟着仓库版本化**，
以后想调颜色或换字形，改 SVG 重跑一条命令即可。
想用自己的图标也很简单 —— 直接覆盖 `build/icon.png` 就行。

顺带给主窗口也设了图标，开发态下任务栏不再是 Electron 默认脸。

### 二、安装位置可选

```json
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowToChangeInstallationDirectory": true
}
```

从「双击直装」变成正常的安装向导，用户可以在安装界面里选路径。
`perMachine: false` 是 per-user 安装（装到 `%LOCALAPPDATA%\Programs`），
不需要管理员权限，目录本身也可写 —— 这一点是下一步的前提。

### 三、首次启动向导

装完第一次打开会弹向导，让用户决定图库放哪。

**默认值 = 安装目录下的 `GuguGallery` 子文件夹。**
这正是 `perMachine: false` 的意义所在：安装目录可写，图库才放得进去。

向导里可以：

- 直接改路径输入框
- 或者点「浏览」挑别的目录
- 保持默认的话，会明确提示：
  **「卸载本应用时这个目录会被一起删除，重要图片建议改到「图片」目录」**

最后这条提示是我主动加的。用户的原始需求是「默认为安装路径下的子文件夹」，
但这个默认值有真实的数据丢失风险 —— NSIS 卸载时会递归删掉 `$INSTDIR`。
需求照做了，风险也摆到台面上，让用户自己判断。

**不打扰老用户**：配置文件里没有 `setupCompleted` 字段的，
一律视为早就配好了，不会弹向导。

### 四、配套的接口

| 新增 | 用途 |
| --- | --- |
| `app:suggestedLibraryRoot` | 建议的图库位置（安装版 = 安装目录子文件夹） |
| `library:chooseDir` | 只弹目录选择框、只返回路径，**不切换** |
| `library:setRoot` | 切到指定目录（向导确认时用） |
| `appInfo.packaged` | 界面据此判断是不是安装版，决定要不要显示卸载警告 |

`chooseDir` 单独做一个的原因：原有的 `pickRoot` 是「选完立刻切库」，
在向导里点一下浏览就把库切了显然不对。

## 验证

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 23 / 23 |
| `npm run uicheck` | 43 / 43 |
| `npm run annotatecheck` | 37 / 37 |

**打包实测**（跑 `release/win-unpacked/GuguGallery.exe`）：

```
packaged      : true
version       : 0.5.1
plugins       : 0
wizardShown   : true
defaultPath   : D:\...\win-unpacked\GuguGallery   ← 安装目录下的子文件夹
warnShown     : true                                  ← 卸载风险提示
```

exe 版本信息：`ProductName=GuguGallery, FileVersion=0.5.1`。

构建日志里也确认了 `target=nsis oneClick=false`、
并且不再出现 `default Electron icon is used` 的告警。

## 过程存档

- 改动后截图：`screenshots-after/`
- 代码差异：`changes.md` / `changes.patch`
- 本轮无界面标注（反馈是当面提的）

## 遗留

- **安装界面与向导的实际观感需要人眼确认**：
  安装向导的「可选安装目录」页面、以及首次启动向导的排版，
  自动化只能验证到「配置生效 / DOM 存在」，看不到视觉效果
- 图标目前只有一个尺寸的 PNG，由 electron-builder 转 ico。
  如果在小尺寸（16×16 任务栏）下糊得厉害，需要补多尺寸 ico
- 图库落在安装目录时，卸载会连带删除。彻底解决需要在 NSIS 里加自定义卸载段
  跳过该目录，本次只做了提示
- 向导没有做「目录已有图库」的识别（比如选到一个已有 index.db 的目录时会直接复用）


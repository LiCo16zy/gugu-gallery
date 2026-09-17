# scripts/ 一览

仓库级工具，都是 Node 脚本，通过 `package.json` 里的 npm script 调用；应用本体的调试入口在 `src-tauri/`。

| 脚本 | 命令 | 干什么 | 需要联网 |
| --- | --- | --- | --- |
| `demo.mjs` | `npm run dev` | 一站式开发模式：demo 图库 + 插件（页面标注工具）+ 界面热更新 | 否 |
| `tauri-app.mjs` | —（被其它脚本 import） | 公共部分：找应用产物、起 Vite、跑一次应用并收输出 | 否 |
| `uicheck.mjs` | `npm run uicheck` | 界面交互回归（65 项断言：筛选/搜索/灯箱/沉浸模式标题条/主题/分类/登录引导） | 否（本地图库） |
| `check-pause.mjs` | `npm run pausecheck` | 暂停/继续回归：真实下载里暂停 → 进度冻结 → 继续 → 停止，含日志去重断言 | 是 |
| `shot.mjs` | `npm run shot` | 自动截图各界面到 `screenshots/` | 否 |
| `e2e.mjs` | `npm run e2e` | 真连站点：索引 1 页 + 下载 4 张，校验磁盘产物 | 是 |
| `crawl.mjs` | `npm run crawl -- …` | 命令行抓取（转发给应用本体的 `--` 模式） | 是 |
| `release.mjs` | `npm run pack` / `npm run dist` | 无插件的发布构建；`dist` 再加 NSIS 安装包并扫描产物 | 否 |

约定：

- 自检脚本都靠环境变量做隔离 —— `GUGU_LIBRARY_ROOT`（图库）、`GUGU_SETTINGS_FILE`（设置）、
  `GUGU_USER_DATA`（用户数据根）、`GUGU_SESSION_EPHEMERAL=1`（不碰系统凭据库），
  所以跑自检不会动你日常用的设置与登录态；
- 需要界面驱动的脚本（`uicheck` / `pausecheck` / `shot`）会自己起 Vite 开发服务器并跑 **debug** 产物；
  纯命令行脚本（`crawl` / `e2e`）跑的是同一份可执行文件，只是不带界面。

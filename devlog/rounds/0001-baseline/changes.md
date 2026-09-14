# 轮次 0001-baseline 代码概览

这是项目的起点，不是某一轮反馈的结果。下面是从空仓库到当前状态的全部变更。

- 提交序列：`d12d19d` → `670e8b1` → `343a0e6`
- 起点：空仓库
- 结果：`343a0e6`

## 提交记录

```
d12d19d feat: 咕咕图库 —— guguxz.com 桌面爬虫与本地图库浏览器
670e8b1 fix: 让设置项真正生效（每页数量、代理），移除未实现的严格 TLS 开关
343a0e6 docs: 补充打包说明与 Windows 符号链接权限的注意事项
```

## 变更文件

```
A	.editorconfig
A	.gitattributes
A	.gitignore
A	LICENSE
A	README.md
A	docs/site-analysis.md
A	electron.vite.config.ts
A	package-lock.json
A	package.json
A	scripts/e2e.mjs
A	scripts/screenshot.mjs
A	scripts/uicheck.mjs
A	src/main/cli.ts
A	src/main/config.ts
A	src/main/context.ts
A	src/main/crawler/engine.ts
A	src/main/crawler/http.ts
A	src/main/crawler/parser.ts
A	src/main/crawler/site.ts
A	src/main/index.ts
A	src/main/ipc.ts
A	src/main/media/library.ts
A	src/main/media/thumbnail.ts
A	src/main/store/db.ts
A	src/main/store/repository.ts
A	src/main/store/schema.ts
A	src/preload/index.ts
A	src/renderer/index.html
A	src/renderer/src/App.tsx
A	src/renderer/src/api.ts
A	src/renderer/src/components/CrawlPanel.tsx
A	src/renderer/src/components/GalleryGrid.tsx
A	src/renderer/src/components/Icons.tsx
A	src/renderer/src/components/Lightbox.tsx
A	src/renderer/src/components/SettingsPanel.tsx
A	src/renderer/src/components/Sidebar.tsx
A	src/renderer/src/main.tsx
A	src/renderer/src/styles.css
A	src/shared/types.ts
A	tests/fixtures/detail-19519.html
A	tests/fixtures/home.html
A	tests/fixtures/list-pixiv.html
A	tests/fixtures/list-ranking.html
A	tests/fixtures/list-wallpaper.html
A	tests/parser.test.ts
A	tsconfig.json
A	tsconfig.node.json
A	tsconfig.web.json
A	vitest.config.ts
```

## 统计

```
.editorconfig                                 |   12 +
 .gitattributes                                |   10 +
 .gitignore                                    |   17 +
 LICENSE                                       |   27 +
 README.md                                     |  341 +++++++
 docs/site-analysis.md                         |  189 ++++
 electron.vite.config.ts                       |   43 +
 package-lock.json                             |  Bin 0 -> 262547 bytes
 package.json                                  |   66 ++
 scripts/e2e.mjs                               |   90 ++
 scripts/screenshot.mjs                        |   68 ++
 scripts/uicheck.mjs                           |  236 +++++
 src/main/cli.ts                               |  130 +++
 src/main/config.ts                            |   63 ++
 src/main/context.ts                           |  113 +++
 src/main/crawler/engine.ts                    |  745 +++++++++++++++
 src/main/crawler/http.ts                      |  340 +++++++
 src/main/crawler/parser.ts                    |  321 +++++++
 src/main/crawler/site.ts                      |  142 +++
 src/main/index.ts                             |  245 +++++
 src/main/ipc.ts                               |  179 ++++
 src/main/media/library.ts                     |  140 +++
 src/main/media/thumbnail.ts                   |   49 +
 src/main/store/db.ts                          |  159 ++++
 src/main/store/repository.ts                  |  694 ++++++++++++++
 src/main/store/schema.ts                      |  113 +++
 src/preload/index.ts                          |   77 ++
 src/renderer/index.html                       |   16 +
 src/renderer/src/App.tsx                      |  514 ++++++++++
 src/renderer/src/api.ts                       |  175 ++++
 src/renderer/src/components/CrawlPanel.tsx    |  482 ++++++++++
 src/renderer/src/components/GalleryGrid.tsx   |  164 ++++
 src/renderer/src/components/Icons.tsx         |  168 ++++
 src/renderer/src/components/Lightbox.tsx      |  322 +++++++
 src/renderer/src/components/SettingsPanel.tsx |  248 +++++
 src/renderer/src/components/Sidebar.tsx       |  179 ++++
 src/renderer/src/main.tsx                     |   10 +
 src/renderer/src/styles.css                   | 1268 +++++++++++++++++++++++++
 src/shared/types.ts                           |  271 ++++++
 tests/fixtures/detail-19519.html              |  267 ++++++
 tests/fixtures/home.html                      |  344 +++++++
 tests/fixtures/list-pixiv.html                |  302 ++++++
 tests/fixtures/list-ranking.html              |  261 +++++
 tests/fixtures/list-wallpaper.html            |  302 ++++++
 tests/parser.test.ts                          |  174 ++++
 tsconfig.json                                 |    4 +
 tsconfig.node.json                            |   26 +
 tsconfig.web.json                             |   23 +
 vitest.config.ts                              |   15 +
 49 files changed, 10144 insertions(+)
```

## 规模

```
源码/测试/脚本行数：9443 行
纳入版本控制的文件：49 个
```

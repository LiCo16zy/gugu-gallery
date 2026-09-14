# 轮次 0002-annotation-tooling 代码概览

- 基线：`343a0e6`
- 结果：`c4c09eb`

## 变更文件

```
M	.gitignore
M	README.md
A	devlog/README.md
A	devlog/index.json
A	devlog/rounds/0001-baseline/README.md
A	devlog/rounds/0001-baseline/changes.md
A	devlog/rounds/0001-baseline/changes.patch
A	devlog/rounds/0001-baseline/screenshots/crawl.jpg
A	devlog/rounds/0001-baseline/screenshots/home.jpg
A	devlog/rounds/0001-baseline/screenshots/lightbox.jpg
A	devlog/rounds/0001-baseline/screenshots/settings.jpg
M	package.json
A	scripts/annotatecheck.mjs
A	scripts/round.mjs
M	scripts/screenshot.mjs
M	src/main/context.ts
A	src/main/devlog.ts
M	src/main/index.ts
M	src/main/ipc.ts
M	src/preload/index.ts
M	src/renderer/src/App.tsx
M	src/renderer/src/api.ts
M	src/renderer/src/components/CrawlPanel.tsx
M	src/renderer/src/components/GalleryGrid.tsx
M	src/renderer/src/components/Icons.tsx
M	src/renderer/src/components/Lightbox.tsx
M	src/renderer/src/components/SettingsPanel.tsx
M	src/renderer/src/components/Sidebar.tsx
A	src/renderer/src/devtools/Annotator.tsx
A	src/renderer/src/devtools/annotator.css
A	src/renderer/src/devtools/inspect.ts
A	src/renderer/src/devtools/types.ts
M	src/renderer/src/styles.css
```

## 统计

```
.gitignore                                         |   3 +-
 README.md                                          |  64 +++
 devlog/README.md                                   |  70 +++
 devlog/index.json                                  |  19 +
 devlog/rounds/0001-baseline/README.md              | 115 ++++
 devlog/rounds/0001-baseline/changes.md             | 131 +++++
 devlog/rounds/0001-baseline/changes.patch          |   7 +
 devlog/rounds/0001-baseline/screenshots/crawl.jpg  | Bin 0 -> 161108 bytes
 devlog/rounds/0001-baseline/screenshots/home.jpg   | Bin 0 -> 237448 bytes
 .../rounds/0001-baseline/screenshots/lightbox.jpg  | Bin 0 -> 211079 bytes
 .../rounds/0001-baseline/screenshots/settings.jpg  | Bin 0 -> 142666 bytes
 package.json                                       |   4 +-
 scripts/annotatecheck.mjs                          | 230 ++++++++
 scripts/round.mjs                                  | 265 +++++++++
 scripts/screenshot.mjs                             |   8 +-
 src/main/context.ts                                |   3 +
 src/main/devlog.ts                                 | 336 +++++++++++
 src/main/index.ts                                  |   7 +-
 src/main/ipc.ts                                    |  11 +-
 src/preload/index.ts                               |   8 +-
 src/renderer/src/App.tsx                           |  26 +-
 src/renderer/src/api.ts                            |   8 +
 src/renderer/src/components/CrawlPanel.tsx         |   2 +-
 src/renderer/src/components/GalleryGrid.tsx        |   6 +-
 src/renderer/src/components/Icons.tsx              |   8 +
 src/renderer/src/components/Lightbox.tsx           |   7 +-
 src/renderer/src/components/SettingsPanel.tsx      |   2 +-
 src/renderer/src/components/Sidebar.tsx            |  13 +-
 src/renderer/src/devtools/Annotator.tsx            | 625 +++++++++++++++++++++
 src/renderer/src/devtools/annotator.css            | 522 +++++++++++++++++
 src/renderer/src/devtools/inspect.ts               | 215 +++++++
 src/renderer/src/devtools/types.ts                 |  63 +++
 src/renderer/src/styles.css                        |   7 +
 33 files changed, 2761 insertions(+), 24 deletions(-)
```

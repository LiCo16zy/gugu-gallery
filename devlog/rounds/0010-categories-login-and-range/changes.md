# 轮次 0010-categories-login-and-range 代码差异概览

- 基线：`1a363cc`
- 结果：`8df047b`

## 变更文件

```
M	devlog/index.json
A	devlog/rounds/0010-categories-login-and-range/README.md
A	devlog/rounds/0010-categories-login-and-range/screenshots-before/crawl.jpg
A	devlog/rounds/0010-categories-login-and-range/screenshots-before/home.jpg
A	devlog/rounds/0010-categories-login-and-range/screenshots-before/lightbox.jpg
A	devlog/rounds/0010-categories-login-and-range/screenshots-before/settings.jpg
M	package.json
M	scripts/uicheck.mjs
M	src/main/crawler/engine.ts
M	src/main/store/repository.ts
M	src/renderer/src/App.tsx
M	src/renderer/src/components/CrawlPanel.tsx
M	src/renderer/src/components/Sidebar.tsx
M	src/renderer/src/styles.css
M	src/shared/bridge.ts
M	src/shared/types.ts
```

## 统计

```
devlog/index.json                                  |   9 ++
 .../0010-categories-login-and-range/README.md      |  85 ++++++++++++++++
 .../screenshots-before/crawl.jpg                   | Bin 0 -> 164449 bytes
 .../screenshots-before/home.jpg                    | Bin 0 -> 151720 bytes
 .../screenshots-before/lightbox.jpg                | Bin 0 -> 68564 bytes
 .../screenshots-before/settings.jpg                | Bin 0 -> 140418 bytes
 package.json                                       |   2 +-
 scripts/uicheck.mjs                                |  57 +++++++++++
 src/main/crawler/engine.ts                         |   7 +-
 src/main/store/repository.ts                       |  28 +++++-
 src/renderer/src/App.tsx                           | 107 ++++++++++++++++-----
 src/renderer/src/components/CrawlPanel.tsx         |  21 ++--
 src/renderer/src/components/Sidebar.tsx            |  10 +-
 src/renderer/src/styles.css                        |  66 +++++++++++++
 src/shared/bridge.ts                               |   2 +-
 src/shared/types.ts                                |   3 +
 16 files changed, 356 insertions(+), 41 deletions(-)
```

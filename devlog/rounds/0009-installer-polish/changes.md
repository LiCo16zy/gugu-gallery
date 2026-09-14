# 轮次 0009-installer-polish 代码差异概览

- 基线：`2bddfc5`
- 结果：`31e1a73`

## 变更文件

```
M	.gitignore
A	build/icon.png
M	package.json
A	scripts/make-icon.mjs
M	src/main/config.ts
M	src/main/index.ts
M	src/main/ipc.ts
M	src/preload/index.ts
M	src/renderer/src/App.tsx
A	src/renderer/src/components/SetupWizard.tsx
M	src/renderer/src/styles.css
M	src/shared/bridge.ts
M	src/shared/types.ts
```

## 统计

```
.gitignore                                  |   3 +
 build/icon.png                              | Bin 0 -> 319551 bytes
 package.json                                |  24 +++++-
 scripts/make-icon.mjs                       | 102 +++++++++++++++++++++++
 src/main/config.ts                          |  28 ++++++-
 src/main/index.ts                           |   2 +
 src/main/ipc.ts                             |  32 ++++++-
 src/preload/index.ts                        |   8 +-
 src/renderer/src/App.tsx                    |  26 ++++++
 src/renderer/src/components/SetupWizard.tsx | 110 ++++++++++++++++++++++++
 src/renderer/src/styles.css                 | 125 ++++++++++++++++++++++++++++
 src/shared/bridge.ts                        |   6 ++
 src/shared/types.ts                         |   5 ++
 13 files changed, 462 insertions(+), 9 deletions(-)
```

# 轮次 0003-plugin-architecture 代码概览

- 基线：`2f88207`
- 结果：`b170197`

## 变更文件

```
M	README.md
A	docs/architecture.md
A	docs/plugin-development.md
M	electron.vite.config.ts
M	package.json
A	plugins/README.md
A	plugins/annotator/README.md
A	plugins/annotator/SKILL.md
R099	scripts/annotatecheck.mjs	plugins/annotator/bin/check.mjs
A	plugins/annotator/plugin.json
R100	src/renderer/src/devtools/annotator.css	plugins/annotator/renderer/annotator.css
R090	src/renderer/src/devtools/Annotator.tsx	plugins/annotator/renderer/index.tsx
R098	src/renderer/src/devtools/inspect.ts	plugins/annotator/renderer/inspect.ts
A	plugins/devlog/README.md
A	plugins/devlog/SKILL.md
R078	scripts/round.mjs	plugins/devlog/bin/round.mjs
A	plugins/devlog/main/index.ts
A	plugins/devlog/main/render.ts
A	plugins/devlog/main/store.ts
A	plugins/devlog/plugin.json
R064	src/renderer/src/devtools/types.ts	plugins/devlog/shared/types.ts
A	plugins/plugins.json
A	scripts/release.mjs
R100	scripts/screenshot.mjs	scripts/shot.mjs
M	src/main/context.ts
D	src/main/devlog.ts
M	src/main/index.ts
M	src/main/ipc.ts
A	src/main/plugins.ts
A	src/main/workspace.ts
M	src/preload/index.ts
M	src/renderer/src/App.tsx
M	src/renderer/src/api.ts
A	src/renderer/src/plugins.ts
A	src/shared/bridge.ts
M	src/shared/globals.d.ts
A	src/shared/plugin.ts
M	tsconfig.node.json
M	tsconfig.web.json
```

## 统计

```
README.md                                          | 108 +++++--
 docs/architecture.md                               | 103 +++++++
 docs/plugin-development.md                         | 133 ++++++++
 electron.vite.config.ts                            | 129 ++++++--
 package.json                                       |  15 +-
 plugins/README.md                                  |  47 +++
 plugins/annotator/README.md                        |  27 ++
 plugins/annotator/SKILL.md                         |  76 +++++
 .../annotator/bin/check.mjs                        |   2 +-
 plugins/annotator/plugin.json                      |   8 +
 .../annotator/renderer}/annotator.css              |   0
 .../annotator/renderer/index.tsx                   |  93 ++++--
 .../annotator/renderer}/inspect.ts                 |   2 +-
 plugins/devlog/README.md                           |  35 +++
 plugins/devlog/SKILL.md                            |  95 ++++++
 {scripts => plugins/devlog/bin}/round.mjs          |  57 +++-
 plugins/devlog/main/index.ts                       |  37 +++
 plugins/devlog/main/render.ts                      | 125 ++++++++
 plugins/devlog/main/store.ts                       | 140 +++++++++
 plugins/devlog/plugin.json                         |   7 +
 .../devtools => plugins/devlog/shared}/types.ts    |  39 ++-
 plugins/plugins.json                               |   4 +
 scripts/release.mjs                                |  75 +++++
 scripts/{screenshot.mjs => shot.mjs}               |   0
 src/main/context.ts                                |   5 +-
 src/main/devlog.ts                                 | 336 ---------------------
 src/main/index.ts                                  |  17 +-
 src/main/ipc.ts                                    |  13 +-
 src/main/plugins.ts                                | 123 ++++++++
 src/main/workspace.ts                              |  22 ++
 src/preload/index.ts                               |  19 +-
 src/renderer/src/App.tsx                           |  42 +--
 src/renderer/src/api.ts                            | 137 +--------
 src/renderer/src/plugins.ts                        |  26 ++
 src/shared/bridge.ts                               |  72 +++++
 src/shared/globals.d.ts                            |   7 +
 src/shared/plugin.ts                               |  88 ++++++
 tsconfig.node.json                                 |  15 +-
 tsconfig.web.json                                  |  12 +-
 39 files changed, 1690 insertions(+), 601 deletions(-)
```

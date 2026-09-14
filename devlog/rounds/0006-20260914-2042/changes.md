# 轮次 0006-20260914-2042 代码差异概览

- 基线：`56156aa`
- 结果：`95743c4`

## 变更文件

```
A	devlog/rounds/0006-20260914-2042/README.md
A	devlog/rounds/0006-20260914-2042/annotations.json
A	devlog/rounds/0006-20260914-2042/annotations.md
A	devlog/rounds/0006-20260914-2042/screenshots/00-full.png
A	"devlog/rounds/0006-20260914-2042/screenshots/001-\350\277\231\351\207\214\347\232\204\346\212\230\345\217\240\345\255\220\351\241\271\347\224\261\344\272\216\344\270\255\351\227\264\345\255\230\345\234\250\347\251\272\347\232\204\351\227\264\351\232\224\345\234\250\351\274\240\346\240\207\347\247\273\345\212\250\350\276\203\346\205\242\346\227\266\345\244\204\344\272\216\347\251\272.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/002-\345\217\263\344\270\212\350\247\222\345\210\207\346\215\242\346\262\211\346\265\270\346\250\241\345\274\217\346\214\211\351\222\256\344\270\215\350\247\201\344\272\206\346\210\221\346\262\241\346\263\225\347\202\271\345\207\273\351\200\200\345\207\272\346\262\211\346\265\270\346\250\241\345\274\217.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/003-\345\217\226\346\266\210\345\215\241\347\211\207\345\267\246\344\270\212\350\247\222\347\232\204-\346\250\252\345\233\276\347\253\226\345\233\276-\350\257\264\346\230\216.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/004-\350\277\231\344\270\252\346\214\211\351\222\256\347\232\204\351\274\240\346\240\207\346\202\254\346\265\256\346\227\266\347\232\204\350\257\264\346\230\216\344\277\256\346\224\271\346\210\220\346\262\211\346\265\270\346\250\241\345\274\217.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/005-\350\260\203\346\225\264\346\226\207\346\234\254.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/006-\350\260\203\346\225\264\346\226\207\346\234\254.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/007-\346\240\207\351\242\230\346\240\207\347\255\276Pixiv-ID-\351\203\275\350\203\275\346\220\234.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/008-\350\260\203\346\225\264\346\226\207\346\234\254.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/009-\350\277\231\351\207\214\347\232\204\347\233\256\345\211\215\347\272\246-1430-\351\241\265\347\232\204\346\225\260\345\255\227\345\257\271\347\224\250\346\210\267\350\277\230\346\230\257\346\257\224\350\276\203\346\234\211\345\217\202\350\200\203\344\273\267\345\200\274.png"
A	"devlog/rounds/0006-20260914-2042/screenshots/010-\345\234\250\351\207\215\346\226\260\350\257\273\345\217\226\345\210\206\347\261\273\347\232\204\346\227\266\345\200\231\350\203\275\345\220\246\350\216\267\345\217\226\344\270\200\346\254\241\351\241\265\351\235\242\347\232\204\346\200\273\351\241\265\346\225\260\347\204\266\345\220\216\345\206\231\351\201\223\344\270\213\351\235\242.png"
M	plugins/annotator/bin/check.mjs
M	plugins/annotator/renderer/annotator.css
M	plugins/annotator/renderer/index.tsx
M	scripts/uicheck.mjs
M	src/main/crawler/engine.ts
M	src/main/crawler/parser.ts
M	src/main/ipc.ts
M	src/preload/index.ts
M	src/renderer/src/App.tsx
M	src/renderer/src/components/ContextMenu.tsx
M	src/renderer/src/components/CrawlPanel.tsx
M	src/renderer/src/components/GalleryGrid.tsx
M	src/renderer/src/components/Lightbox.tsx
M	src/renderer/src/styles.css
M	src/shared/bridge.ts
M	tests/parser.test.ts
```

## 统计

```
devlog/rounds/0006-20260914-2042/README.md         |  29 +
 devlog/rounds/0006-20260914-2042/annotations.json  | 688 +++++++++++++++++++++
 devlog/rounds/0006-20260914-2042/annotations.md    | 137 ++++
 .../0006-20260914-2042/screenshots/00-full.png     | Bin 0 -> 315291 bytes
 ...27\266\345\244\204\344\272\216\347\251\272.png" | Bin 0 -> 282 bytes
 ...62\211\346\265\270\346\250\241\345\274\217.png" | Bin 0 -> 315291 bytes
 ...3\226\345\233\276-\350\257\264\346\230\216.png" | Bin 0 -> 28596 bytes
 ...62\211\346\265\270\346\250\241\345\274\217.png" | Bin 0 -> 2528 bytes
 ...60\203\346\225\264\346\226\207\346\234\254.png" | Bin 0 -> 3950 bytes
 ...60\203\346\225\264\346\226\207\346\234\254.png" | Bin 0 -> 8781 bytes
 ...iv-ID-\351\203\275\350\203\275\346\220\234.png" | Bin 0 -> 14450 bytes
 ...60\203\346\225\264\346\226\207\346\234\254.png" | Bin 0 -> 3166 bytes
 ...17\202\350\200\203\344\273\267\345\200\274.png" | Bin 0 -> 2315 bytes
 ...06\231\351\201\223\344\270\213\351\235\242.png" | Bin 0 -> 2522 bytes
 plugins/annotator/bin/check.mjs                    |  81 ++-
 plugins/annotator/renderer/annotator.css           |   3 +
 plugins/annotator/renderer/index.tsx               |  58 +-
 scripts/uicheck.mjs                                |  14 +
 src/main/crawler/engine.ts                         |   9 +
 src/main/crawler/parser.ts                         |  17 +-
 src/main/ipc.ts                                    |  10 +
 src/preload/index.ts                               |   2 +
 src/renderer/src/App.tsx                           |   6 +-
 src/renderer/src/components/ContextMenu.tsx        |  39 +-
 src/renderer/src/components/CrawlPanel.tsx         |  36 +-
 src/renderer/src/components/GalleryGrid.tsx        |   2 -
 src/renderer/src/components/Lightbox.tsx           |  22 +-
 src/renderer/src/styles.css                        |  27 +-
 src/shared/bridge.ts                               |   2 +
 tests/parser.test.ts                               |   3 +
 30 files changed, 1154 insertions(+), 31 deletions(-)
```

/**
 * 无界面 CLI 抓取模式。
 *
 *   npm run crawl -- --plate ACG图片 --word Pixiv萌图 --pages 3 --max 60
 *   npm run crawl -- --index-only --pages 50
 *   npm run crawl -- --search --word 泳装类分享 --pages 2 --index-only
 *   npm run crawl -- --library D:/Pictures/GuguGallery --sort newest
 *
 * 除了给自动化留一个入口，它也是最快的端到端自检方式：
 * 走的是和界面完全一样的引擎、HTTP 客户端与落盘逻辑。
 */
import { app } from 'electron'
import { AppContext } from './context'
import type { CrawlProgress, CrawlRequest } from '@shared/types'

interface Args {
  plate: string
  word: string
  pages: number | null
  from: number
  max: number | null
  indexOnly: boolean
  noEnrich: boolean
  /** 关键词搜索目标（泳装类分享这类没有一级分类的分类） */
  search: boolean
  library: string | null
  delay: number | null
  concurrency: number | null
  includeTags: string[]
  excludeTags: string[]
  quiet: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const has = (name: string): boolean => argv.includes(`--${name}`)
  const num = (name: string): number | null => {
    const v = get(name)
    return v == null ? null : Number.parseInt(v, 10)
  }
  const list = (name: string): string[] =>
    (get(name) ?? '')
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

  return {
    plate: get('plate') ?? 'ACG图片',
    word: get('word') ?? 'Pixiv萌图',
    pages: num('pages'),
    from: num('from') ?? 1,
    max: num('max'),
    indexOnly: has('index-only'),
    noEnrich: has('no-enrich'),
    search: has('search'),
    library: get('library') ?? null,
    delay: num('delay'),
    concurrency: num('concurrency'),
    includeTags: list('include'),
    excludeTags: list('exclude'),
    quiet: has('quiet')
  }
}

const args = parseArgs(process.argv.slice(2))

void app.whenReady().then(async () => {
  if (args.library) process.env.GUGU_LIBRARY_ROOT = args.library
  const ctx = new AppContext()
  await ctx.init()

  const settings = ctx.settingsValue()
  const request: CrawlRequest = {
    targets: [
      args.search
        ? { kind: 'search', word: args.word }
        : { kind: 'category', plate: args.plate, word: args.word }
    ],
    pageFrom: args.from,
    pageTo: args.pages == null ? null : args.from + args.pages - 1,
    maxItems: args.max,
    indexOnly: args.indexOnly,
    download: !args.indexOnly,
    enrich: !args.noEnrich,
    skipExisting: true,
    listConcurrency: args.concurrency ?? settings.listConcurrency,
    downloadConcurrency: args.concurrency ?? settings.downloadConcurrency,
    delayMs: args.delay ?? settings.delayMs,
    retries: settings.retries,
    includeTags: args.includeTags,
    excludeTags: args.excludeTags,
    resumeFromMarks: false,
    minWidth: 0,
    minBytes: 0
  }

  console.log(`[cli] 图库目录: ${ctx.library.root}`)
  console.log(
    `[cli] 目标: ${args.search ? '搜索' : args.plate} / ${args.word}  页 ${request.pageFrom}..${request.pageTo ?? '自动'}`
  )
  console.log(`[cli] 模式: ${args.indexOnly ? '仅索引' : '索引 + 下载'}${args.max ? ` 最多 ${args.max} 张` : ''}`)

  let lastPhase = ''
  ctx.onProgress((progress: CrawlProgress, logs) => {
    if (!args.quiet) {
      for (const line of logs) console.log(`  · ${line.message}`)
    }
    if (progress.phase !== lastPhase) {
      lastPhase = progress.phase
      console.log(`[cli] 阶段 -> ${progress.phase}`)
    }
  })

  ctx.crawler
    .start(request)
    .then(() => waitDone(ctx))
    .then(() => {
      const stats = ctx.repository.stats(ctx.library.root)
      console.log(
        `[cli] 完成：索引 ${stats.items} 条，已下载 ${stats.downloaded} 张，占用 ${(stats.totalBytes / 1024 ** 2).toFixed(1)} MB`
      )
      return ctx.dispose()
    })
    .then(() => app.exit(0))
    .catch(async (err: unknown) => {
      console.error('[cli] 失败:', err instanceof Error ? err.message : err)
      await ctx.dispose()
      app.exit(1)
    })
})

async function waitDone(ctx: AppContext): Promise<void> {
  for (;;) {
    if (!ctx.crawler.isRunning()) return
    await new Promise((r) => setTimeout(r, 300))
  }
}

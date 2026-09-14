/**
 * 抓取引擎：把「列表页索引 -> 详情补全 -> 原图下载 -> 缩略图」串成一条可控流水线。
 *
 * 设计要点
 *  - 两阶段：先建立完整索引（很快，只抓列表页），再按条件下载（很慢，流量大头）。
 *    这样用户可以「先看一眼有什么，再决定下什么」。
 *  - 断点续爬：列表页结果记在 page_marks 表里，重复运行会跳过已抓过的页。
 *  - 失败不影响整体：单个条目失败只记日志，队列继续推进。
 *  - 进度事件节流到 4 次/秒，日志只发增量，避免 IPC 洪泛。
 */
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { CrawlProgress, CrawlRequest, GalleryQuery } from '@shared/types'
import { HttpClient, HttpError } from './http'
import { parseDetail, parseListItems, parsePagination, parseNav, sniffImageFormat } from './parser'
import {
  listUrl,
  originalUrl,
  pathExt,
  previewUrl,
  SITE_ORIGIN,
  targetTitle,
  type SiteTarget
} from './site'
import type { Repository } from '../store/repository'
import type { Library } from '../media/library'
import { buildSlug } from '../media/library'
import { makeThumbnail, probeImage } from '../media/thumbnail'
import type { AppSettings, CrawlSiteInfo } from '@shared/types'

export interface EngineDeps {
  repo: Repository
  library: Library
  getSettings: () => AppSettings
  onProgress: (progress: CrawlProgress, newLogs: CrawlProgress['logs']) => void
  /** 由上层决定用哪个 fetch 实现：直连走全局 fetch，配了代理则交给 Electron 网络栈 */
  fetchImpl?: typeof fetch
  resolveFetch?: (proxy: string) => typeof fetch | undefined
  /** 当前登录态 Cookie；未登录返回 null */
  getCookie: () => string | null
  /** 会话失效时回调一次，用于提醒用户重新登录 */
  onSessionExpired: (message: string) => void
}

interface EngineState {
  jobId: number
  request: CrawlRequest
  phase: CrawlProgress['phase']
  startedAt: number
  pagesDone: number
  pagesTotal: number | null
  itemsFound: number
  itemsNew: number
  itemsMatched: number
  downloadTotal: number | null
  downloaded: number
  skipped: number
  failed: number
  bytesDownloaded: number
  currentLabel: string | null
  recentBytes: { at: number; bytes: number }[]
}

export class CrawlEngine {
  private http: HttpClient
  private state: EngineState | null = null
  private paused = false
  private cancelled = false
  private running = false
  private logBuffer: CrawlProgress['logs'] = []
  private lastEmit = 0
  private emitTimer: NodeJS.Timeout | null = null
  private siteInfoCache: CrawlSiteInfo | null = null

  constructor(private deps: EngineDeps) {
    const s = deps.getSettings()
    this.http = new HttpClient({
      delayMs: s.delayMs,
      retries: s.retries,
      timeoutMs: 25_000,
      stallMs: 30_000,
      concurrency: Math.max(s.listConcurrency, s.downloadConcurrency),
      fetchImpl: deps.fetchImpl,
      onRetry: ({ attempt, reason, waitMs, url }) => {
        this.log('warn', `第 ${attempt} 次重试（${reason}），${Math.round(waitMs / 100) / 10}s 后重试 ${shortUrl(url)}`)
      }
    })
  }

  /* ------------------------------------------------------------- 生命周期 */

  isRunning(): boolean {
    return this.running
  }

  isPaused(): boolean {
    return this.paused
  }

  currentProgress(): CrawlProgress | null {
    return this.state ? this.snapshot() : null
  }

  applySettings(settings: AppSettings): void {
    this.http.configure({
      delayMs: settings.delayMs,
      retries: settings.retries,
      concurrency: Math.max(settings.listConcurrency, settings.downloadConcurrency),
      fetchImpl: this.deps.resolveFetch?.(settings.proxy) ?? this.deps.fetchImpl
    })
  }

  /**
   * 校验登录态：拿一份首页看导航里有没有「泳装类分享」。
   * 它是登录后才出现的栏目，比找 cookie 过期关键字更可靠。
   */
  async verifySession(): Promise<{ ok: boolean; message: string }> {
    const cookie = this.deps.getCookie()
    if (!cookie) return { ok: false, message: '还没有设置登录凭据' }
    this.http.configure({ cookie })
    try {
      const { html } = await this.http.getHtml(`${SITE_ORIGIN}/`)
      if (html.includes('泳装类分享')) return { ok: true, message: '登录态有效' }
      return { ok: false, message: '站点没返回登录后的栏目，凭据可能已失效' }
    } catch (err) {
      return { ok: false, message: `校验失败：${err instanceof Error ? err.message : String(err)}` }
    }
  }

  pause(): void {
    if (!this.running || this.paused) return
    this.paused = true
    if (this.state) this.state.phase = 'paused'
    this.log('info', '已暂停，当前批次完成后停止取新任务')
    this.emit(true)
  }

  resume(): void {
    if (!this.running || !this.paused) return
    this.paused = false
    if (this.state) this.state.phase = this.state.downloadTotal === null ? 'indexing' : 'downloading'
    this.log('info', '继续抓取')
    this.emit(true)
  }

  cancel(): void {
    if (!this.running) return
    this.cancelled = true
    this.paused = false
    this.http.cancelAll()
    this.log('warn', '收到取消请求…')
  }

  /* ------------------------------------------------------------------ 入口 */

  /** 抓取站点导航，得到一级/二级分类树（用于「发现源」界面） */
  async fetchSiteInfo(force = false): Promise<CrawlSiteInfo> {
    if (this.siteInfoCache && !force && Date.now() - this.siteInfoCache.fetchedAt < 6 * 3600_000) {
      return this.siteInfoCache
    }
    const { html } = await this.http.getHtml(`${SITE_ORIGIN}/`)
    const info: CrawlSiteInfo = { plates: parseNav(html), fetchedAt: Date.now() }
    if (info.plates.length > 0) this.siteInfoCache = info
    return info
  }

  /**
   * 查某个抓取目标的总页数 / 总条数。
   * 只请求第 1 页，解析底部的「共 N 页 M 条数据」，用于界面上给个规模预期。
   */
  async fetchPageInfo(target: SiteTarget): Promise<{ totalPages: number | null; totalItems: number | null }> {
    const { html } = await this.http.getHtml(listUrl(target, 1))
    return parsePagination(html)
  }

  /**
   * 启动一次抓取。立即返回 jobId，实际工作在后台推进。
   */
  async start(request: CrawlRequest): Promise<number> {
    if (this.running) throw new Error('已有抓取任务在运行，请先停止')
    const settings = this.deps.getSettings()
    this.http.configure({
      delayMs: request.delayMs,
      retries: request.retries,
      concurrency: Math.max(request.listConcurrency, request.downloadConcurrency),
      cookie: this.deps.getCookie()
    })
    this.http.resumeAll()

    const targets: SiteTarget[] = request.targets.map((t) => ({
      kind: t.kind === 'custom' ? 'custom' : t.kind,
      plate: t.plate ?? null,
      word: t.word ?? null,
      url: t.url ?? null
    }))
    if (targets.length === 0) throw new Error('至少要选择一个抓取目标')

    const summary = targets.map((t) => targetTitle(t)).join('、')
    const jobId = this.deps.repo.createJob('queued', summary, request)

    this.state = {
      jobId,
      request,
      phase: 'queued',
      startedAt: Date.now(),
      pagesDone: 0,
      pagesTotal: null,
      itemsFound: 0,
      itemsNew: 0,
      itemsMatched: 0,
      downloadTotal: null,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      bytesDownloaded: 0,
      currentLabel: null,
      recentBytes: []
    }
    this.logBuffer = []
    this.paused = false
    this.cancelled = false
    this.running = true
    this.log('info', `任务 #${jobId} 启动：${summary}`)

    void this.run(targets, settings).catch((err: unknown) => {
      this.log('error', `任务异常终止：${err instanceof Error ? err.message : String(err)}`)
      this.finish('failed')
    })

    return jobId
  }

  /* ------------------------------------------------------------- 主流程 */

  private async run(targets: SiteTarget[], settings: AppSettings): Promise<void> {
    const st = this.state!
    try {
      await this.deps.library.ensure()
      await this.deps.library.cleanupTmp()

      st.phase = 'indexing'
      this.emit(true)

      for (const target of targets) {
        if (this.cancelled) break
        await this.indexTarget(target)
      }

      if (this.cancelled) {
        this.finish('cancelled')
        return
      }

      if (st.request.download && !st.request.indexOnly) {
        st.phase = 'downloading'
        this.emit(true)
        await this.downloadPhase(settings)
      }

      if (this.cancelled) this.finish('cancelled')
      else this.finish('done')
    } catch (err) {
      this.log('error', err instanceof Error ? err.message : String(err))
      this.finish(this.cancelled ? 'cancelled' : 'failed')
    }
  }

  /** 阶段一：抓列表页，建立索引 */
  private async indexTarget(target: SiteTarget): Promise<void> {
    const st = this.state!
    const req = st.request
    const entryUrl = listUrl(target, req.pageFrom)
    this.deps.repo.upsertSource({
      kind: target.kind,
      plate: target.plate ?? null,
      word: target.word ?? null,
      url: entryUrl,
      title: targetTitle(target),
      enabled: true
    })
    const sourceUrl = entryUrl

    this.log('info', `开始索引：${targetTitle(target)}`)
    const marked = this.deps.repo.getMarkedPages(sourceUrl)

    let page = req.pageFrom
    let guard = 0
    const hardLimit = req.pageTo ?? req.pageFrom + 5000

    while (page <= hardLimit && guard < 5000) {
      if (this.cancelled) return
      await this.waitIfPaused()
      guard += 1

      if (req.resumeFromMarks && marked.get(page)) {
        st.pagesDone += 1
        st.currentLabel = `跳过已索引的第 ${page} 页`
        page += 1
        continue
      }

      const url = listUrl(target, page)
      let html: string
      try {
        const res = await this.http.getHtml(url)
        html = res.html
      } catch (err) {
        this.recordFailure(`列表页 ${page} 抓取失败：${errText(err)}`)
        if (err instanceof HttpError && err.status === 404) break
        page += 1
        continue
      }

      if (page === req.pageFrom) {
        const pager = parsePagination(html)
        // 分母用「本次要抓的范围」而不是站点总数：
        // 用户设了 100~200 页却看到 1430 的分母，会以为设置没生效
        st.pagesTotal = req.pageTo != null ? Math.max(1, req.pageTo - req.pageFrom + 1) : pager.totalPages
        if (pager.totalPages) {
          this.deps.repo.updateSourceStats(sourceUrl, pager.totalPages, pager.totalItems)
        }
      }

      const rawItems = parseListItems(html)
      if (rawItems.length === 0) {
        this.log('info', `第 ${page} 页没有内容，该分类索引结束（共 ${st.pagesDone} 页）`)
        break
      }

      const upserts = rawItems.map((raw) => ({
        id: raw.id,
        detailUrl: raw.detailUrl,
        sourceUrl,
        plate: raw.plate ?? target.plate ?? null,
        word: raw.word ?? target.word ?? null,
        title: raw.title,
        width: raw.width,
        height: raw.height,
        bytes: raw.bytes,
        uploader: raw.uploader,
        views: raw.views,
        publishedAt: normalizeDate(raw.publishedAt),
        remotePath: raw.remotePath,
        remoteExt: raw.remotePath ? pathExt(raw.remotePath) : null,
        previewUrl: raw.remotePath ? previewUrl(raw.remotePath) : null,
        downloadUrl: raw.remotePath ? originalUrl(raw.remotePath) : null,
        page,
        tags: raw.tags
      }))

      const { inserted } = this.deps.repo.upsertItems(upserts)
      this.deps.repo.markPage(sourceUrl, page, rawItems.length)

      st.pagesDone += 1
      st.itemsFound += rawItems.length
      st.itemsNew += inserted
      st.currentLabel = `索引 ${targetTitle(target)} 第 ${page} 页`
      this.emit()

      page += 1
    }
  }

  /** 阶段二：按条件挑出条目并下载原图 */
  private async downloadPhase(settings: AppSettings): Promise<void> {
    const st = this.state!
    const req = st.request

    // 页码范围同样作用于下载：只下「在这段页里发现的」条目，
    // 否则设了 100~200 页、下载却会把整库都翻出来
    const filter: GalleryQuery = {
      tags: req.includeTags,
      tagMode: 'any',
      excludeTags: req.excludeTags,
      minWidth: req.minWidth > 0 ? req.minWidth : undefined,
      pageFrom: req.pageFrom,
      pageTo: req.pageTo ?? undefined
    }

    const limit = req.maxItems && req.maxItems > 0 ? req.maxItems : 1_000_000
    const queue = this.deps.repo.listDownloadQueue(filter, limit, req.skipExisting)
    this.http.configure({
      delayMs: req.delayMs,
      retries: req.retries,
      concurrency: req.downloadConcurrency
    })
    await this.runQueue(queue, settings)
  }

  /** 手动下载指定条目（详情页的「下载此图」走这条路） */
  async downloadItems(ids: number[]): Promise<number> {
    if (this.running) throw new Error('已有抓取任务在运行，请先停止')
    if (ids.length === 0) return 0
    const settings = this.deps.getSettings()
    const queue = this.deps.repo.listDownloadQueueByIds(ids)
    if (queue.length === 0) return 0

    const jobId = this.deps.repo.createJob('queued', `手动下载 ${queue.length} 张`, { ids })
    this.state = {
      jobId,
      request: manualRequest(settings, ids.length),
      phase: 'downloading',
      startedAt: Date.now(),
      pagesDone: 0,
      pagesTotal: null,
      itemsFound: 0,
      itemsNew: 0,
      itemsMatched: queue.length,
      downloadTotal: queue.length,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      bytesDownloaded: 0,
      currentLabel: null,
      recentBytes: []
    }
    this.logBuffer = []
    this.paused = false
    this.cancelled = false
    this.running = true
    this.log('info', `手动下载任务 #${jobId}：${queue.length} 张`)

    void (async () => {
      try {
        await this.deps.library.ensure()
        this.http.resumeAll()
        this.http.configure({
          delayMs: settings.delayMs,
          retries: settings.retries,
          concurrency: settings.downloadConcurrency
        })
        await this.runQueue(queue, settings)
        this.finish(this.cancelled ? 'cancelled' : 'done')
      } catch (err) {
        this.log('error', errText(err))
        this.finish(this.cancelled ? 'cancelled' : 'failed')
      }
    })()

    return jobId
  }

  /** 消费下载队列：worker 池 + 暂停/取消支持 */
  private async runQueue(
    queue: { id: number; remotePath: string | null; title: string }[],
    settings: AppSettings
  ): Promise<void> {
    const st = this.state!
    st.downloadTotal = queue.length
    st.itemsMatched = queue.length
    this.log('info', `待下载 ${queue.length} 张（并发 ${st.request.downloadConcurrency}，间隔 ${st.request.delayMs}ms）`)
    this.emit(true)

    if (queue.length === 0) {
      this.log('info', '没有符合条件的待下载图片，任务结束')
      return
    }

    let cursor = 0
    const concurrency = Math.max(1, Math.min(8, st.request.downloadConcurrency))
    const workers = Array.from({ length: concurrency }, () => this.downloadWorker(queue, () => cursor++, settings))
    await Promise.all(workers)
  }

  private downloadWorker(
    queue: { id: number; remotePath: string | null; title: string }[],
    next: () => number,
    settings: AppSettings
  ): Promise<void> {
    return (async () => {
      for (;;) {
        if (this.cancelled) return
        await this.waitIfPaused()
        if (this.cancelled) return
        const index = next()
        if (index >= queue.length) return
        const entry = queue[index]
        try {
          await this.downloadOne(entry, settings)
        } catch (err) {
          this.recordFailure(`#${entry.id} 下载失败：${errText(err)}`)
        }
      }
    })()
  }

  private async downloadOne(
    entry: { id: number; remotePath: string | null; title: string },
    settings: AppSettings
  ): Promise<void> {
    const st = this.state!
    const req = st.request
    const item = this.deps.repo.getItem(entry.id)
    if (!item) {
      this.recordFailure(`#${entry.id} 索引中不存在，跳过`)
      return
    }

    let remotePath = item.remotePath ?? entry.remotePath
    let pixivId = item.pixivId
    let tags = item.tags

    // 详情页补全：拿到 Pixiv id / 画师 / 完整标签，同时兜底取得原图路径
    if (req.enrich) {
      try {
        st.currentLabel = `补全详情 #${entry.id}`
        const { html } = await this.http.getHtml(item.detailUrl)
        const detail = parseDetail(html, entry.id)
        this.deps.repo.applyDetail(entry.id, {
          uploader: detail.uploader,
          width: detail.width,
          height: detail.height,
          bytes: detail.bytes,
          views: detail.views,
          likes: detail.likes,
          collects: detail.collects,
          pixivId: detail.pixivId,
          pixivArtistUrl: detail.pixivArtistUrl,
          remotePath: detail.remotePath,
          previewUrl: detail.remotePath ? previewUrl(detail.remotePath) : null,
          downloadUrl: detail.remotePath ? originalUrl(detail.remotePath) : null,
          remoteExt: detail.remotePath ? pathExt(detail.remotePath) : null,
          tags: detail.tags
        })
        remotePath = detail.remotePath ?? remotePath
        pixivId = detail.pixivId ?? pixivId
        if (detail.tags.length > 0) tags = detail.tags
      } catch (err) {
        this.log('warn', `#${entry.id} 详情页补全失败，沿用列表页信息：${errText(err)}`)
      }
    }

    if (!remotePath) {
      this.recordFailure(`#${entry.id} 拿不到原图地址`)
      return
    }

    const url = settings.preferOriginal ? originalUrl(remotePath) : previewUrl(remotePath)
    const tmpPath = this.deps.library.tmpPath(`${entry.id}.part`)
    st.currentLabel = `下载 #${entry.id}`

    const result = await this.http.download(url, tmpPath, (delta, total) => {
      st.bytesDownloaded += delta
      this.pushBytes(delta)
      void total
    })

    const format = sniffImageFormat(result.head)
    if (!format) {
      await rm(tmpPath, { force: true })
      this.recordFailure(`#${entry.id} 返回的不是图片（${result.bytes} 字节）`)
      return
    }

    const probe = probeImage(tmpPath)
    if (req.minBytes > 0 && result.bytes < req.minBytes) {
      await rm(tmpPath, { force: true })
      st.skipped += 1
      this.log('info', `#${entry.id} 体积 ${formatBytes(result.bytes)} 小于阈值，已跳过`)
      this.emit()
      return
    }
    if (req.minWidth > 0 && probe && probe.width < req.minWidth) {
      await rm(tmpPath, { force: true })
      st.skipped += 1
      this.log('info', `#${entry.id} 宽度 ${probe.width}px 小于阈值，已跳过`)
      this.emit()
      return
    }

    const slug = buildSlug([tags[0], tags[1], pixivId ? `pid${pixivId}` : null])
    const relPath = this.deps.library.originalRelPath({
      id: entry.id,
      plate: item.plate,
      word: item.word,
      slug,
      ext: format.ext,
      naming: settings.naming,
      pixivId,
      sha256: result.sha256
    })
    const absPath = this.deps.library.resolveInside(relPath)
    await mkdir(dirname(absPath), { recursive: true })
    await rename(tmpPath, absPath)

    const thumbRel = this.deps.library.thumbRelPath(entry.id)
    let thumbOk = false
    try {
      const measured = await makeThumbnail(absPath, this.deps.library.resolveInside(thumbRel), settings.thumbSize)
      thumbOk = measured !== null
    } catch (err) {
      this.log('warn', `#${entry.id} 缩略图生成失败：${errText(err)}`)
    }

    this.deps.repo.upsertFile({
      itemId: entry.id,
      relPath,
      thumbRel: thumbOk ? thumbRel : null,
      ext: format.ext,
      mime: format.mime,
      width: probe?.width ?? item.width ?? null,
      height: probe?.height ?? item.height ?? null,
      bytes: result.bytes,
      sha256: result.sha256
    })
    this.deps.repo.applyFileMetrics(entry.id, {
      width: probe?.width ?? null,
      height: probe?.height ?? null,
      bytes: result.bytes,
      ext: format.ext
    })

    st.downloaded += 1
    this.log('success', `#${entry.id} 已保存 ${relPath}（${formatBytes(result.bytes)}）`)
    this.emit()
  }

  /* ------------------------------------------------------------- 进度事件 */

  private snapshot(): CrawlProgress {
    const st = this.state!
    const elapsedMs = Date.now() - st.startedAt
    const speedBps = this.currentSpeed()
    const remaining = st.downloadTotal == null ? null : Math.max(0, st.downloadTotal - st.downloaded - st.skipped - st.failed)
    const processed = st.downloaded + st.skipped + st.failed
    const perItem = processed > 0 ? elapsedMs / processed : 0
    return {
      jobId: st.jobId,
      phase: this.paused ? 'paused' : st.phase,
      startedAt: st.startedAt,
      elapsedMs,
      pagesDone: st.pagesDone,
      pagesTotal: st.pagesTotal,
      itemsFound: st.itemsFound,
      itemsNew: st.itemsNew,
      itemsMatched: st.itemsMatched,
      downloadTotal: st.downloadTotal,
      downloaded: st.downloaded,
      skipped: st.skipped,
      failed: st.failed,
      bytesDownloaded: st.bytesDownloaded,
      speedBps,
      etaSeconds: remaining != null && perItem > 0 ? Math.round((remaining * perItem) / 1000) : null,
      currentLabel: st.currentLabel,
      logs: []
    }
  }

  private emit(force = false): void {
    const now = Date.now()
    if (!force && now - this.lastEmit < 250) {
      if (!this.emitTimer) {
        this.emitTimer = setTimeout(() => {
          this.emitTimer = null
          this.emit(true)
        }, 250)
        this.emitTimer.unref?.()
      }
      return
    }
    this.lastEmit = now
    if (force && this.emitTimer) {
      clearTimeout(this.emitTimer)
      this.emitTimer = null
    }
    const logs = this.logBuffer
    this.logBuffer = []
    this.deps.onProgress(this.snapshot(), logs)
  }

  private log(level: CrawlProgress['logs'][number]['level'], message: string): void {
    this.logBuffer.push({ at: Date.now(), level, message })
    if (this.logBuffer.length > 400) this.logBuffer.splice(0, this.logBuffer.length - 400)
    this.emit()
  }

  private recordFailure(message: string): void {
    if (this.state) this.state.failed += 1
    this.log('error', message)
    this.emit()
  }

  private pushBytes(delta: number): void {
    const st = this.state
    if (!st) return
    const now = Date.now()
    st.recentBytes.push({ at: now, bytes: delta })
    while (st.recentBytes.length > 0 && now - st.recentBytes[0].at > 5000) st.recentBytes.shift()
  }

  private currentSpeed(): number {
    const st = this.state
    if (!st || st.recentBytes.length === 0) return 0
    const now = Date.now()
    const first = st.recentBytes[0].at
    const window = Math.max(1000, now - first)
    const total = st.recentBytes.reduce((sum, r) => sum + r.bytes, 0)
    return Math.round((total / window) * 1000)
  }

  private async waitIfPaused(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  private finish(phase: 'done' | 'cancelled' | 'failed'): void {
    const st = this.state
    if (!st) return
    st.phase = phase
    this.running = false
    this.paused = false
    this.http.resumeAll()
    const stats = {
      pages: st.pagesDone,
      items: st.itemsFound,
      newItems: st.itemsNew,
      downloaded: st.downloaded,
      skipped: st.skipped,
      failed: st.failed,
      bytes: st.bytesDownloaded
    }
    this.deps.repo.finishJob(st.jobId, phase, stats)
    const label = phase === 'done' ? '完成' : phase === 'cancelled' ? '已取消' : '失败'
    this.log(
      phase === 'done' ? 'success' : phase === 'cancelled' ? 'warn' : 'error',
      `任务${label}：索引 ${stats.pages} 页 / 新条目 ${stats.newItems} / 下载 ${stats.downloaded} 张（${formatBytes(
        stats.bytes
      )}）/ 跳过 ${stats.skipped} / 失败 ${stats.failed}`
    )
    this.emit(true)
  }
}

/* ------------------------------------------------------------------ 工具 */

function manualRequest(settings: AppSettings, count: number): CrawlRequest {
  return {
    targets: [],
    pageFrom: 1,
    pageTo: null,
    maxItems: count,
    indexOnly: false,
    download: true,
    enrich: true,
    skipExisting: false,
    listConcurrency: settings.listConcurrency,
    downloadConcurrency: settings.downloadConcurrency,
    delayMs: settings.delayMs,
    retries: settings.retries,
    includeTags: [],
    excludeTags: [],
    resumeFromMarks: false,
    minWidth: 0,
    minBytes: 0
  }
}

function normalizeDate(text: string | null): string | null {
  if (!text) return null
  return text.length === 10 ? `${text} 00:00` : text
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`.slice(0, 90)
  } catch {
    return url.slice(0, 90)
  }
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

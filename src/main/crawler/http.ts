/**
 * 面向爬虫的 HTTP 客户端。
 *
 * 站点实测的坑（2026-09）：
 *  1. 必须带 Referer=https://www.guguxz.com/ ，否则 imageBed 直接 403；
 *  2. 直连 CDN 的签名地址则不需要 Referer；
 *  3. 服务端非常不稳定：约 25% 的请求会在 1KB 左右断开或干脆挂住 25s 以上，
 *     重试几乎总能成功 —— 所以「重试 + 完整性校验」是这个爬虫的核心，而不是可选项。
 */
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { BROWSER_UA, SITE_REFERER } from './site'

export interface HttpClientOptions {
  /** 每次请求发起之间的最小间隔（毫秒），用于礼貌限速 */
  delayMs: number
  retries: number
  /** 单次请求的整体超时 */
  timeoutMs: number
  /** 下载时的「无数据」看门狗阈值 */
  stallMs: number
  /** 并发上限 */
  concurrency: number
  /** 代理地址；在 Electron 主进程里会交给 Chromium 网络栈处理 */
  proxy?: string
  fetchImpl?: typeof fetch
  onRetry?: (info: { url: string; attempt: number; reason: string; waitMs: number }) => void
}

export const DEFAULT_HTTP_OPTIONS: HttpClientOptions = {
  delayMs: 220,
  retries: 4,
  timeoutMs: 25_000,
  stallMs: 30_000,
  concurrency: 3
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export interface HtmlResult {
  url: string
  finalUrl: string
  html: string
  bytes: number
}

export interface DownloadResult {
  url: string
  finalUrl: string
  bytes: number
  sha256: string
  /** 文件头 512 字节，用于魔数嗅探 */
  head: Uint8Array
}

/** 简单的并发闸门 + 匀速放行器 */
export class Limiter {
  private active = 0
  private queue: (() => void)[] = []
  private lastStart = 0

  constructor(
    private concurrency: number,
    private delayMs: number
  ) {}

  configure(concurrency: number, delayMs: number): void {
    this.concurrency = Math.max(1, concurrency)
    this.delayMs = Math.max(0, delayMs)
    this.drain()
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) {
      this.active += 1
      return this.pace()
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active += 1
        void this.pace().then(resolve)
      })
    })
  }

  private async pace(): Promise<void> {
    if (this.delayMs <= 0) return
    const now = Date.now()
    const wait = this.lastStart + this.delayMs - now
    this.lastStart = Math.max(now, this.lastStart + this.delayMs)
    if (wait > 0) await sleep(wait)
  }

  private release(): void {
    this.active -= 1
    this.drain()
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift()!
      next()
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 判断 HTML 是否是完整响应 —— 站点失败时会截断在中途 */
export function isCompleteHtml(html: string): boolean {
  const tail = html.slice(-2048).toLowerCase()
  return tail.includes('</html>') && html.includes('<body')
}

export class HttpClient {
  private limiter: Limiter
  private fetchImpl: typeof fetch
  private disabled = false

  constructor(private opts: HttpClientOptions) {
    this.limiter = new Limiter(opts.concurrency, opts.delayMs)
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch
    if (!this.fetchImpl) throw new Error('当前运行环境没有可用的 fetch 实现')
  }

  configure(patch: Partial<HttpClientOptions>): void {
    this.opts = { ...this.opts, ...patch }
    if (patch.fetchImpl) this.fetchImpl = patch.fetchImpl
    this.limiter.configure(this.opts.concurrency, this.opts.delayMs)
  }

  cancelAll(): void {
    this.disabled = true
  }

  resumeAll(): void {
    this.disabled = false
  }

  /** 抓取并要求是完整 HTML */
  async getHtml(url: string): Promise<HtmlResult> {
    return this.limiter.run(async () => {
      const { res, text } = await this.requestWithRetry(url, 'text')
      return { url, finalUrl: res.url || url, html: text, bytes: Buffer.byteLength(text, 'utf8') }
    })
  }

  /** 抓取任意文本（不校验 HTML 结构），用于 robots.txt 等 */
  async getText(url: string): Promise<string> {
    return this.limiter.run(async () => {
      const { text } = await this.requestWithRetry(url, 'text-any')
      return text
    })
  }

  /**
   * 下载到本地文件。先写 .part 再原子改名，避免中断留下半个文件被当成完整图。
   * onProgress 会以「本次调用累计字节数」回调。
   */
  async download(
    url: string,
    destPath: string,
    onProgress?: (deltaBytes: number, totalBytes: number) => void
  ): Promise<DownloadResult> {
    return this.limiter.run(async () => {
      const partPath = `${destPath}.part`
      await mkdir(dirname(destPath), { recursive: true })

      let lastErr: unknown = null
      for (let attempt = 0; attempt <= this.opts.retries; attempt += 1) {
        if (this.disabled) throw new HttpError('任务已取消', null, url, false)
        try {
          if (attempt > 0) {
            const waitMs = this.backoff(attempt)
            this.opts.onRetry?.({ url, attempt, reason: describe(lastErr), waitMs })
            await sleep(waitMs)
          }
          const result = await this.streamToFile(url, partPath, onProgress)
          await rename(partPath, destPath)
          return result
        } catch (err) {
          lastErr = err
          await rm(partPath, { force: true }).catch(() => {})
          if (err instanceof HttpError && !err.retryable) break
        }
      }
      throw lastErr instanceof Error ? lastErr : new HttpError(String(lastErr), null, url, false)
    })
  }

  private async streamToFile(
    url: string,
    partPath: string,
    onProgress?: (delta: number, total: number) => void
  ): Promise<DownloadResult> {
    const controller = new AbortController()
    let stallTimer: NodeJS.Timeout | null = null
    const bumpStall = (): void => {
      if (stallTimer) clearTimeout(stallTimer)
      stallTimer = setTimeout(() => controller.abort(new Error('下载停滞超时')), this.opts.stallMs)
    }
    bumpStall()

    try {
      const res = await this.fetchImpl(url, {
        headers: this.headers({ referer: SITE_REFERER, accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }),
        redirect: 'follow',
        signal: controller.signal
      })
      if (!res.ok || !res.body) {
        throw new HttpError(`下载失败 HTTP ${res.status}`, res.status, url, isRetryableStatus(res.status))
      }

      const hash = createHash('sha256')
      const stream = createWriteStream(partPath)
      const reader = res.body.getReader()
      let bytes = 0
      let head: Uint8Array = new Uint8Array(0)

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue
          bumpStall()
          bytes += value.byteLength
          hash.update(value)
          if (head.byteLength < 512) {
            const merged = new Uint8Array(Math.min(512, head.byteLength + value.byteLength))
            merged.set(head, 0)
            merged.set(value.subarray(0, merged.byteLength - head.byteLength), head.byteLength)
            head = merged
          }
          onProgress?.(value.byteLength, bytes)
          if (!stream.write(Buffer.from(value))) {
            await new Promise<void>((resolve) => stream.once('drain', () => resolve()))
          }
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          stream.end((err?: Error | null) => (err ? reject(err) : resolve()))
        })
      }

      const expected = Number.parseInt(res.headers.get('content-length') ?? '', 10)
      if (Number.isFinite(expected) && expected > 0 && bytes !== expected) {
        throw new HttpError(`响应不完整：收到 ${bytes} 字节，声明 ${expected} 字节`, 200, url, true)
      }

      return { url, finalUrl: res.url || url, bytes, sha256: hash.digest('hex'), head }
    } finally {
      if (stallTimer) clearTimeout(stallTimer)
    }
  }

  private async requestWithRetry(
    url: string,
    mode: 'text' | 'text-any'
  ): Promise<{ res: Response; text: string }> {
    let lastErr: unknown = null
    for (let attempt = 0; attempt <= this.opts.retries; attempt += 1) {
      if (this.disabled) throw new HttpError('任务已取消', null, url, false)
      try {
        if (attempt > 0) {
          const waitMs = this.backoff(attempt)
          this.opts.onRetry?.({ url, attempt, reason: describe(lastErr), waitMs })
          await sleep(waitMs)
        }
        const res = await this.fetchImpl(url, {
          headers: this.headers({ referer: SITE_REFERER, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }),
          redirect: 'follow',
          signal: AbortSignal.timeout(this.opts.timeoutMs)
        })
        if (!res.ok) {
          throw new HttpError(`HTTP ${res.status}`, res.status, url, isRetryableStatus(res.status))
        }
        const text = await res.text()
        if (mode === 'text' && !isCompleteHtml(text)) {
          throw new HttpError(`响应被截断（${text.length} 字符）`, res.status, url, true)
        }
        return { res, text }
      } catch (err) {
        lastErr = err
        // 404 之类的确定性错误不必重试
        if (err instanceof HttpError && !err.retryable) throw err
      }
    }
    throw lastErr instanceof Error ? lastErr : new HttpError(String(lastErr), null, url, false)
  }

  private headers(extra: Record<string, string>): Record<string, string> {
    return {
      'User-Agent': BROWSER_UA,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      ...extra
    }
  }

  private backoff(attempt: number): number {
    const base = Math.min(15_000, 700 * 2 ** (attempt - 1))
    return base + Math.floor(Math.random() * 400)
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function describe(err: unknown): string {
  if (err instanceof HttpError) return err.message
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return '请求超时'
    return err.message
  }
  return String(err)
}

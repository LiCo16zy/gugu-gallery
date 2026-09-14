/**
 * 应用上下文：把「设置 / 图库目录 / 数据库 / 仓储 / 抓取引擎」装配到一起，
 * 并支持运行期切换图库根目录（关掉旧库、开新库、重建引擎）。
 */
import { net, session } from 'electron'
import { CrawlEngine } from './crawler/engine'
import { Database } from './store/db'
import { Repository } from './store/repository'
import { Library } from './media/library'
import { SettingsStore } from './config'
import type { AppSettings, CrawlProgress } from '@shared/types'

export class AppContext {
  readonly settings: SettingsStore
  private db!: Database
  private repo!: Repository
  private lib!: Library
  private engine!: CrawlEngine

  private progressListeners = new Set<(p: CrawlProgress, logs: CrawlProgress['logs']) => void>()

  constructor() {
    this.settings = new SettingsStore()
  }

  async init(): Promise<void> {
    await this.settings.load()
    await applyProxy(this.settings.get().proxy)
    await this.openLibrary(this.settings.get().libraryRoot)
  }

  private async openLibrary(root: string): Promise<void> {
    const lib = new Library(root)
    await lib.ensure()
    const db = await Database.open(lib.dbPath)
    this.lib = lib
    this.db = db
    this.repo = new Repository(db)
    this.engine = new CrawlEngine({
      repo: this.repo,
      library: lib,
      getSettings: () => this.settings.get(),
      resolveFetch: (proxy) => (proxy.trim() ? electronFetch : undefined),
      onProgress: (progress, logs) => {
        for (const listener of this.progressListeners) listener(progress, logs)
      }
    })
  }

  /** 切换图库目录：先落盘旧库，再开新库 */
  async switchLibrary(root: string): Promise<void> {
    if (this.engine.isRunning()) throw new Error('抓取进行中，无法切换图库目录')
    await this.db.close()
    await this.openLibrary(root)
    await this.settings.patch({ libraryRoot: root })
  }

  get repository(): Repository {
    return this.repo
  }

  get library(): Library {
    return this.lib
  }

  get crawler(): CrawlEngine {
    return this.engine
  }

  get database(): Database {
    return this.db
  }

  settingsValue(): AppSettings {
    return this.settings.get()
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = await this.settings.patch(patch)
    if (patch.proxy !== undefined) await applyProxy(next.proxy)
    this.engine.applySettings(next)
    return next
  }

  onProgress(listener: (progress: CrawlProgress, logs: CrawlProgress['logs']) => void): () => void {
    this.progressListeners.add(listener)
    return () => this.progressListeners.delete(listener)
  }

  async dispose(): Promise<void> {
    this.engine.cancel()
    await this.db.close()
  }
}

/**
 * 代理交给 Chromium 网络栈处理（net.fetch 会走当前 session 的代理配置），
 * 这样能自动兼容系统代理、PAC 脚本与需要客户端证书的环境，比在 Node 侧自己实现稳。
 */
async function applyProxy(proxy: string): Promise<void> {
  const rules = proxy.trim()
  try {
    if (rules) await session.defaultSession.setProxy({ proxyRules: rules })
    else await session.defaultSession.setProxy({ mode: 'direct' })
  } catch (err) {
    // 代理规则写错不应该让应用起不来，退回直连即可
    console.warn('[gugu] 代理设置失败，已退回直连:', err instanceof Error ? err.message : err)
    await session.defaultSession.setProxy({ mode: 'direct' }).catch(() => {})
  }
}

const electronFetch: typeof fetch = (input, init) =>
  net.fetch(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, init)
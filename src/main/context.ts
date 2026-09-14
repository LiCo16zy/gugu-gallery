/**
 * 应用上下文：把「设置 / 图库目录 / 数据库 / 仓储 / 抓取引擎」装配到一起，
 * 并支持运行期切换图库根目录（关掉旧库、开新库、重建引擎）。
 */
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

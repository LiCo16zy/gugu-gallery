/**
 * 应用级配置：存在 userData/settings.json。
 * 之所以不放进 SQLite：图库根目录决定了 index.db 的位置，先有鸡还是先有蛋。
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types'

export class SettingsStore {
  private cache: AppSettings
  private readonly file: string

  constructor() {
    // GUGU_SETTINGS_FILE 用于隔离测试实例，避免自动化跑测试污染真实配置
    this.file = process.env.GUGU_SETTINGS_FILE ?? join(app.getPath('userData'), 'settings.json')
    this.cache = { ...DEFAULT_SETTINGS, libraryRoot: defaultLibraryRoot() }
    // 允许用环境变量覆盖图库目录，便于自动化测试与多实例并行
    const override = process.env.GUGU_LIBRARY_ROOT
    if (override) this.cache.libraryRoot = override
  }

  async load(): Promise<AppSettings> {
    try {
      if (existsSync(this.file)) {
        const raw = await readFile(this.file, 'utf8')
        const parsed = JSON.parse(raw) as Partial<AppSettings>
        this.cache = { ...DEFAULT_SETTINGS, ...parsed }
        if (!this.cache.libraryRoot) this.cache.libraryRoot = defaultLibraryRoot()
        const override = process.env.GUGU_LIBRARY_ROOT
        if (override) this.cache.libraryRoot = override
      }
    } catch {
      // 配置坏了就用默认值，不要让应用起不来
      this.cache = { ...DEFAULT_SETTINGS, libraryRoot: defaultLibraryRoot() }
    }
    return this.cache
  }

  get(): AppSettings {
    return this.cache
  }

  async patch(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.cache = { ...this.cache, ...patch }
    await mkdir(dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(this.cache, null, 2), 'utf8')
    return this.cache
  }

  get path(): string {
    return this.file
  }
}

export function defaultLibraryRoot(): string {
  try {
    return join(app.getPath('pictures'), 'GuguGallery')
  } catch {
    return join(app.getPath('userData'), 'library')
  }
}

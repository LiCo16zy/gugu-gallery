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
    this.cache = { ...DEFAULT_SETTINGS, libraryRoot: suggestedLibraryRoot() }
    // 允许用环境变量覆盖图库目录，便于自动化测试与多实例并行
    const override = process.env.GUGU_LIBRARY_ROOT
    if (override) {
      this.cache.libraryRoot = override
      this.cache.setupCompleted = true
    }
  }

  async load(): Promise<AppSettings> {
    try {
      if (existsSync(this.file)) {
        const raw = await readFile(this.file, 'utf8')
        const parsed = JSON.parse(raw) as Partial<AppSettings>
        this.cache = { ...DEFAULT_SETTINGS, ...parsed }
        // 老版本的配置文件里没有 setupCompleted：说明用户早就配好了，
        // 不要再弹一次首次启动向导
        if (parsed.setupCompleted === undefined) this.cache.setupCompleted = true
        if (!this.cache.libraryRoot) this.cache.libraryRoot = suggestedLibraryRoot()
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

/**
 * 建议的图库位置。
 * 安装版放在**安装目录下的子文件夹**（per-user 安装，目录本身可写）；
 * 开发态没有这个概念，退回系统图片目录。
 */
export function suggestedLibraryRoot(): string {
  if (app.isPackaged) {
    try {
      return join(dirname(app.getPath('exe')), 'GuguGallery')
    } catch {
      /* 取不到就退回默认 */
    }
  }
  return defaultLibraryRoot()
}

export function defaultLibraryRoot(): string {
  try {
    return join(app.getPath('pictures'), 'GuguGallery')
  } catch {
    return join(app.getPath('userData'), 'library')
  }
}

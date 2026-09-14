/**
 * 轮次目录管理：把一个带序号的目录当成「一轮迭代」的容器。
 *
 * 目录布局（由标注工具与 bin/round.mjs 共同写入）：
 *   devlog/rounds/<0000-slug>/
 *     README.md            本轮说明
 *     annotations.md/.json 界面标注原文
 *     changes.md/.patch    代码差异
 *     screenshots/         本轮截图
 *     screenshots-before/  改动前
 *     screenshots-after/   改动后
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import type { ExportPayload, ExportResult, RoundInfo } from '../shared/types'
import { renderMarkdown, renderRoundReadme, slugify, type ExportRecord } from './render'

export class DevlogStore {
  constructor(private readonly workspaceRoot: string) {}

  get roundsDir(): string {
    return join(this.workspaceRoot, 'devlog', 'rounds')
  }

  async listRounds(): Promise<RoundInfo[]> {
    if (!existsSync(this.roundsDir)) return []
    const entries = await readdir(this.roundsDir, { withFileTypes: true })
    const rounds: RoundInfo[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = join(this.roundsDir, entry.name)
      let annotationCount = 0
      try {
        const raw = await readFile(join(dir, 'annotations.json'), 'utf8')
        annotationCount = (JSON.parse(raw) as { annotations?: unknown[] }).annotations?.length ?? 0
      } catch {
        /* 纯代码轮次没有标注文件，正常 */
      }
      rounds.push({
        id: entry.name,
        dir,
        createdAt: entry.name.match(/^\d{8}-\d{4}/)?.[0] ?? entry.name,
        annotationCount,
        hasScreenshot: existsSync(join(dir, 'screenshots', '00-full.png'))
      })
    }
    return rounds.sort((a, b) => a.id.localeCompare(b.id))
  }

  /** 下一个轮次目录：<4 位序号>-<yyyyMMdd-HHmm> */
  async nextRoundDir(): Promise<{ id: string; dir: string }> {
    const rounds = await this.listRounds()
    const id = `${String(rounds.length + 1).padStart(4, '0')}-${stamp()}`
    return { id, dir: join(this.roundsDir, id) }
  }

  /**
   * 导出一次标注：整页截图 + 每条标注的裁片 + JSON + Markdown。
   * 裁切要注意 devicePixelRatio：capturePage 给的是物理像素，标注框是 CSS 像素。
   */
  async exportAnnotations(
    payload: ExportPayload,
    win: BrowserWindow | null
  ): Promise<ExportResult> {
    const { id, dir } = await this.nextRoundDir()
    const shotsDir = join(dir, 'screenshots')
    await mkdir(shotsDir, { recursive: true })

    const files: string[] = []

    let fullImage: Electron.NativeImage | null = null
    if (win && !win.isDestroyed()) {
      win.webContents.invalidate()
      await sleep(320)
      fullImage = await win.webContents.capturePage()
      await writeFile(join(shotsDir, '00-full.png'), fullImage.toPNG())
      files.push('screenshots/00-full.png')
    }

    const dpr = payload.devicePixelRatio || 1
    for (const anno of payload.annotations) {
      if (!fullImage) break
      const name = `${String(anno.index).padStart(3, '0')}-${slugify(anno.comment)}.png`
      try {
        const size = fullImage.getSize()
        const x = clamp(Math.round(anno.rect.x * dpr) - 12, 0, size.width)
        const y = clamp(Math.round(anno.rect.y * dpr) - 12, 0, size.height)
        const width = clamp(Math.round(anno.rect.width * dpr) + 24, 1, size.width - x)
        const height = clamp(Math.round(anno.rect.height * dpr) + 24, 1, size.height - y)
        const crop = fullImage.crop({ x, y, width, height })
        if (!crop.isEmpty()) {
          await writeFile(join(shotsDir, name), crop.toPNG())
          files.push(`screenshots/${name}`)
        }
      } catch {
        /* 单条裁切失败不影响整体导出 */
      }
    }

    const record: ExportRecord = {
      roundId: id,
      exportedAt: new Date().toISOString(),
      view: payload.view,
      note: payload.note,
      viewport: payload.annotations[0]?.viewport ?? null,
      devicePixelRatio: dpr,
      appVersion: payload.appVersion,
      annotations: payload.annotations
    }

    await writeFile(join(dir, 'annotations.json'), JSON.stringify(record, null, 2), 'utf8')
    files.push('annotations.json')

    await writeFile(join(dir, 'annotations.md'), renderMarkdown(record), 'utf8')
    files.push('annotations.md')

    if (!existsSync(join(dir, 'README.md'))) {
      await writeFile(join(dir, 'README.md'), renderRoundReadme(record), 'utf8')
      files.push('README.md')
    }

    return { roundId: id, roundDir: dir, files }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stamp(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

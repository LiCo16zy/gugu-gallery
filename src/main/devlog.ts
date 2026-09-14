/**
 * 开发过程档案（devlog）。
 *
 * 每做一轮改动就是一个「轮次」，落在 devlog/rounds/<编号>-<时间戳>/ 下，
 * 内含：用户标注原文、逐条标注的截图裁片、当轮改动说明、代码差异。
 * 目的是让整个项目的演进过程可回溯、可展示。
 *
 * 标注由界面上的「标注工具」产生，导出时主进程负责截图与落盘。
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, type BrowserWindow } from 'electron'

export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationTarget {
  selector: string
  component: string | null
  tag: string
  classes: string
  text: string
  parentChain: string[]
  styles: Record<string, string>
  attributes: Record<string, string>
}

export interface Annotation {
  id: string
  index: number
  comment: string
  category: 'style' | 'layout' | 'content' | 'behavior' | 'bug' | 'other'
  severity: 'must' | 'should' | 'nice'
  kind: 'element' | 'region'
  createdAt: number
  rect: AnnotationRect
  viewport: { width: number; height: number }
  target: AnnotationTarget
}

export interface ExportPayload {
  annotations: Annotation[]
  /** 本轮的整体说明，可选 */
  note: string
  /** 标注时所在界面（gallery / lightbox / crawl / settings …） */
  view: string
  devicePixelRatio: number
  appVersion: string
}

export interface RoundInfo {
  id: string
  dir: string
  createdAt: string
  annotationCount: number
  hasScreenshot: boolean
}

const CATEGORY_LABEL: Record<Annotation['category'], string> = {
  style: '视觉样式',
  layout: '布局结构',
  content: '文案内容',
  behavior: '交互行为',
  bug: '缺陷',
  other: '其它'
}

const SEVERITY_LABEL: Record<Annotation['severity'], string> = {
  must: '必须改',
  should: '建议改',
  nice: '锦上添花'
}

export class DevlogStore {
  constructor(private readonly root: string) {}

  /**
   * 档案根目录的定位顺序：
   *   1. GUGU_WORKSPACE 环境变量（显式指定）
   *   2. 应用目录下的 devlog/（开发态就是仓库根）
   *   3. 用户数据目录（打包后 asar 不可写时的兜底，保证导出永远能成功）
   */
  static resolveRoot(): string {
    const fromEnv = process.env.GUGU_WORKSPACE
    if (fromEnv) return fromEnv
    const appPath = app.getAppPath()
    if (!appPath.includes('app.asar') && existsSync(join(appPath, 'devlog'))) return appPath
    return join(app.getPath('userData'), 'devlog-workspace')
  }

  get roundsDir(): string {
    return join(this.root, 'devlog', 'rounds')
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
        const parsed = JSON.parse(raw) as { annotations?: unknown[] }
        annotationCount = parsed.annotations?.length ?? 0
      } catch {
        /* 没有标注文件也正常（纯代码轮次） */
      }
      rounds.push({
        id: entry.name,
        dir,
        createdAt: entry.name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/)?.[0] ?? entry.name,
        annotationCount,
        hasScreenshot: existsSync(join(dir, 'screenshots', '00-full.png'))
      })
    }
    return rounds.sort((a, b) => a.id.localeCompare(b.id))
  }

  /** 下一个轮次目录：<4 位序号>-<yyyyMMdd-HHmm> */
  async nextRoundDir(): Promise<{ id: string; dir: string }> {
    const rounds = await this.listRounds()
    const nextNumber = rounds.length + 1
    const id = `${String(nextNumber).padStart(4, '0')}-${stamp()}`
    return { id, dir: join(this.roundsDir, id) }
  }

  /**
   * 导出一次标注：整页截图 + 每条标注的裁片 + JSON + Markdown。
   * 截图裁切要注意 devicePixelRatio：capturePage 给的是物理像素，标注框是 CSS 像素。
   */
  async exportAnnotations(
    payload: ExportPayload,
    win: BrowserWindow | null
  ): Promise<{ roundId: string; roundDir: string; files: string[] }> {
    const { id, dir } = await this.nextRoundDir()
    const shotsDir = join(dir, 'screenshots')
    await mkdir(shotsDir, { recursive: true })

    const files: string[] = []

    // 1) 整页截图
    let fullImage: Electron.NativeImage | null = null
    if (win && !win.isDestroyed()) {
      win.webContents.invalidate()
      await sleep(320)
      fullImage = await win.webContents.capturePage()
      await writeFile(join(shotsDir, '00-full.png'), fullImage.toPNG())
      files.push('screenshots/00-full.png')
    }

    // 2) 每条标注裁片
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
        /* 裁切失败不影响主体导出 */
      }
    }

    // 3) 原始数据
    const record = {
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

    // 4) 人能读的 Markdown
    await writeFile(join(dir, 'annotations.md'), renderMarkdown(record), 'utf8')
    files.push('annotations.md')

    // 5) 轮次说明骨架，供后续填写
    if (!existsSync(join(dir, 'README.md'))) {
      await writeFile(join(dir, 'README.md'), renderRoundReadme(record), 'utf8')
      files.push('README.md')
    }

    return { roundId: id, roundDir: dir, files }
  }
}

/* ------------------------------------------------------------------ 渲染 */

interface ExportRecord {
  roundId: string
  exportedAt: string
  view: string
  note: string
  viewport: { width: number; height: number } | null
  devicePixelRatio: number
  appVersion: string
  annotations: Annotation[]
}

function renderRoundReadme(record: ExportRecord): string {
  const viewport = record.viewport ? `${record.viewport.width}×${record.viewport.height}` : '未知'
  return `# 轮次 ${record.roundId}

> 由界面上的「标注工具」自动生成，请在完成本轮改动后补全下面的小节。

## 背景

<!-- 这一轮要解决什么问题、由谁提出 -->

${record.note ? record.note : '（待补充）'}

## 反馈标注

共 ${record.annotations.length} 条，详见 [\`annotations.md\`](annotations.md) 与 [\`annotations.json\`](annotations.json)。

导出时视口 ${viewport}，界面 ${record.view}，应用版本 ${record.appVersion}。

## 改动

<!-- 逐条说明做了什么，以及为什么这么做（含取舍） -->

## 验证

<!-- 跑了哪些测试、截图证据、以及没能验证到的部分 -->

## 遗留

<!-- 本轮没做、留待下轮的事项 -->
`
}

function renderMarkdown(record: ExportRecord): string {
  const lines: string[] = []
  lines.push(`# 界面标注 · 轮次 ${record.roundId}`)
  lines.push('')
  lines.push(`- 导出时间：${record.exportedAt}`)
  lines.push(`- 所在界面：${record.view}`)
  if (record.viewport) lines.push(`- 视口：${record.viewport.width}×${record.viewport.height}（DPR ${record.devicePixelRatio}）`)
  lines.push(`- 应用版本：${record.appVersion}`)
  lines.push(`- 标注条数：${record.annotations.length}`)
  if (record.note) {
    lines.push('')
    lines.push('## 总体说明')
    lines.push('')
    lines.push(record.note)
  }
  lines.push('')
  lines.push('## 逐条标注')
  lines.push('')

  for (const a of record.annotations) {
    const t = a.target
    lines.push(`### ${a.index}. ${firstLine(a.comment) || '(无标题)'}`)
    lines.push('')
    lines.push(
      `- **类别**：${CATEGORY_LABEL[a.category]} ｜ **优先级**：${SEVERITY_LABEL[a.severity]} ｜ **方式**：${
        a.kind === 'element' ? '点选元素' : '框选区域'
      }`
    )
    if (t.component) lines.push(`- **组件**：\`${t.component}\``)
    lines.push(`- **选择器**：\`${t.selector}\``)
    if (t.parentChain.length > 0) lines.push(`- **父级链**：${t.parentChain.map((p) => `\`${p}\``).join(' ← ')}`)
    if (t.text) lines.push(`- **元素文本**：${truncate(t.text.replace(/\s+/g, ' '), 120)}`)
    lines.push(
      `- **位置尺寸**：x=${Math.round(a.rect.x)} y=${Math.round(a.rect.y)} ${Math.round(a.rect.width)}×${Math.round(
        a.rect.height
      )}`
    )
    const styleEntries = Object.entries(t.styles)
    if (styleEntries.length > 0) {
      lines.push(`- **关键样式**：${styleEntries.map(([k, v]) => `${k}: ${v}`).join('; ')}`)
    }
    const attrEntries = Object.entries(t.attributes)
    if (attrEntries.length > 0) {
      lines.push(`- **属性**：${attrEntries.map(([k, v]) => `${k}="${truncate(v, 40)}"`).join(' ')}`)
    }
    lines.push('')
    lines.push('> ' + a.comment.split('\n').join('\n> '))
    lines.push('')
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ 工具 */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim().slice(0, 60)
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

function slugify(text: string): string {
  const cleaned = firstLine(text)
    // 半角与全角标点都可能出现在文件名里，统一清掉；中文本身保留
    .replace(/[\\/:*?"<>|：；？！，。、（）【】《》""''…—]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 28) || 'annotation'
}

function stamp(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

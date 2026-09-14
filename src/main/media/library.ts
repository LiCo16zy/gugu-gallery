/**
 * 图库的磁盘布局与路径安全。
 *
 * <libraryRoot>/
 *   index.db              SQLite 索引
 *   originals/<一级>/<二级>/<文件名>   原图（按站点分类归档，方便脱离本应用也能翻）
 *   thumbs/<id>.jpg      缩略图
 *   .tmp/                下载中转，成功后 rename
 */
import { mkdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'

export class Library {
  readonly root: string
  readonly originalsDir: string
  readonly thumbsDir: string
  readonly tmpDir: string
  readonly dbPath: string

  constructor(root: string) {
    this.root = resolve(root)
    this.originalsDir = join(this.root, 'originals')
    this.thumbsDir = join(this.root, 'thumbs')
    this.tmpDir = join(this.root, '.tmp')
    this.dbPath = join(this.root, 'index.db')
  }

  async ensure(): Promise<void> {
    await mkdir(this.originalsDir, { recursive: true })
    await mkdir(this.thumbsDir, { recursive: true })
    await mkdir(this.tmpDir, { recursive: true })
  }

  /** 相对路径 -> 绝对路径（并阻止越权访问） */
  resolveInside(relPath: string): string {
    const abs = resolve(this.root, relPath)
    const rel = relative(this.root, abs)
    if (rel.startsWith('..') || (rel !== '' && rel.split(sep)[0] === '..') || resolve(abs) === resolve(this.root)) {
      throw new Error(`路径越界: ${relPath}`)
    }
    return abs
  }

  exists(relPath: string): boolean {
    try {
      return existsSync(this.resolveInside(relPath))
    } catch {
      return false
    }
  }

  async size(relPath: string): Promise<number | null> {
    try {
      const s = await stat(this.resolveInside(relPath))
      return s.size
    } catch {
      return null
    }
  }

  /** 为某个条目计算原图的相对路径 */
  originalRelPath(input: {
    id: number
    plate: string | null
    word: string | null
    slug: string
    ext: string
    naming: 'id-slug' | 'id' | 'pixiv' | 'hash'
    pixivId?: string | null
    sha256?: string | null
  }): string {
    const plate = safeSegment(input.plate || '未分类')
    const word = safeSegment(input.word || '全部')
    const ext = input.ext.replace(/^\./, '').toLowerCase() || 'jpg'
    const slug = safeSegment(input.slug).slice(0, 48)
    let name: string
    switch (input.naming) {
      case 'id':
        name = `${input.id}.${ext}`
        break
      case 'pixiv':
        name = input.pixivId ? `pid${input.pixivId}.${ext}` : `${input.id}.${ext}`
        break
      case 'hash':
        name = `${(input.sha256 ?? String(input.id)).slice(0, 16)}.${ext}`
        break
      case 'id-slug':
      default:
        name = slug && slug !== String(input.id) ? `${input.id}_${slug}.${ext}` : `${input.id}.${ext}`
        break
    }
    return toPosix(join('originals', plate, word, name))
  }

  thumbRelPath(id: number): string {
    return toPosix(join('thumbs', `${id}.jpg`))
  }

  tmpPath(name: string): string {
    return join(this.tmpDir, name)
  }

  async remove(relPath: string): Promise<void> {
    await rm(this.resolveInside(relPath), { force: true }).catch(() => {})
  }

  /** 清理下载中转目录里的残留 */
  async cleanupTmp(): Promise<void> {
    await rm(this.tmpDir, { recursive: true, force: true }).catch(() => {})
    await mkdir(this.tmpDir, { recursive: true })
  }
}

/** 去掉文件名里的非法字符，保留中文 */
export function safeSegment(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 由标题生成文件名片段：取标签和 pixiv id 更有辨识度 */
export function buildSlug(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.trim())
    .join('-')
    .replace(/[\[\]（）()]/g, '')
    .replace(/-+/g, '-')
}

function toPosix(p: string): string {
  return normalize(p).split(sep).join('/')
}

export function extOf(path: string): string {
  return extname(path).replace(/^\./, '').toLowerCase()
}

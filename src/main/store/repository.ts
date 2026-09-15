/**
 * 仓储层：领域对象 <-> SQL。所有 SQL 都集中在这里，方便审阅与优化。
 */
import type {
  AppSettings,
  Facet,
  GalleryPage,
  PlateFacet,
  GalleryQuery,
  ItemDetail,
  ItemSummary,
  LibraryStats,
  SourceRef
} from '@shared/types'
import type { Database, Row } from './db'
import type { SqlValue } from 'sql.js'

export interface ItemUpsert {
  id: number
  detailUrl: string
  sourceUrl: string | null
  plate: string | null
  word: string | null
  title: string
  width: number | null
  height: number | null
  bytes: number | null
  uploader: string | null
  views: number | null
  publishedAt: string | null
  remotePath: string | null
  remoteExt: string | null
  previewUrl: string | null
  downloadUrl: string | null
  /** 发现该条目的列表页码 */
  page: number | null
  tags: string[]
}

export interface FileUpsert {
  itemId: number
  relPath: string
  thumbRel: string | null
  ext: string
  mime: string
  width: number | null
  height: number | null
  bytes: number
  sha256: string
  variant?: 'original' | 'preview'
}

const nowIso = (): string => new Date().toISOString()

export class Repository {
  constructor(private db: Database) {}

  get database(): Database {
    return this.db
  }

  /* ------------------------------------------------------------- 抓取源 */

  upsertSource(input: Omit<SourceRef, 'id' | 'itemCount' | 'lastCrawledAt'>): number {
    this.db.run(
      `INSERT INTO sources (kind, plate, word, url, title, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET title = excluded.title,
                                      plate = excluded.plate,
                                      word  = excluded.word,
                                      kind  = excluded.kind`,
      [input.kind, input.plate, input.word, input.url, input.title, input.enabled ? 1 : 0, nowIso()]
    )
    const row = this.db.get<{ id: number }>('SELECT id FROM sources WHERE url = ?', [input.url])
    return row ? Number(row.id) : 0
  }

  listSources(): SourceRef[] {
    const rows = this.db.all<Row>(
      `SELECT s.*, (SELECT COUNT(*) FROM items i WHERE i.source_url = s.url) AS item_count
       FROM sources s ORDER BY s.id`
    )
    return rows.map(mapSource)
  }

  updateSourceStats(url: string, totalPages: number | null, totalItems: number | null): void {
    this.db.run(
      `UPDATE sources SET total_pages = COALESCE(?, total_pages),
                          total_items = COALESCE(?, total_items),
                          last_crawled_at = ?
       WHERE url = ?`,
      [totalPages, totalItems, nowIso(), url]
    )
  }

  setSourceEnabled(id: number, enabled: boolean): void {
    this.db.run('UPDATE sources SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id])
  }

  removeSource(id: number): void {
    this.db.run('DELETE FROM sources WHERE id = ?', [id])
  }

  /* --------------------------------------------------------------- 条目 */

  /** 批量写入列表页解析结果；已存在的条目保留收藏/评分/详情补全标记 */
  upsertItems(items: ItemUpsert[]): { inserted: number; updated: number } {
    if (items.length === 0) return { inserted: 0, updated: 0 }
    const existing = new Set<number>()
    return this.db.transaction(() => {
      let inserted = 0
      const ts = nowIso()
      for (const it of items) {
        const before = this.db.get<{ id: number }>('SELECT id FROM items WHERE id = ?', [it.id])
        if (before) existing.add(it.id)

        this.db.run(
          `INSERT INTO items (id, detail_url, source_url, plate, word, title, width, height, bytes,
                              uploader, views, published_at, remote_path, remote_ext,
                              preview_url, download_url, page, indexed_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             detail_url   = excluded.detail_url,
             source_url   = COALESCE(excluded.source_url, items.source_url),
             plate        = COALESCE(excluded.plate, items.plate),
             word         = COALESCE(excluded.word, items.word),
             title        = CASE WHEN excluded.title <> '' THEN excluded.title ELSE items.title END,
             width        = COALESCE(excluded.width, items.width),
             height       = COALESCE(excluded.height, items.height),
             bytes        = COALESCE(excluded.bytes, items.bytes),
             uploader     = COALESCE(excluded.uploader, items.uploader),
             views        = COALESCE(excluded.views, items.views),
             published_at = COALESCE(items.published_at, excluded.published_at),
             remote_path  = COALESCE(excluded.remote_path, items.remote_path),
             remote_ext   = COALESCE(excluded.remote_ext, items.remote_ext),
             preview_url  = COALESCE(excluded.preview_url, items.preview_url),
             download_url = COALESCE(excluded.download_url, items.download_url),
             page         = COALESCE(excluded.page, items.page),
             updated_at   = excluded.updated_at`,
          [
            it.id,
            it.detailUrl,
            it.sourceUrl,
            it.plate,
            it.word,
            it.title,
            it.width,
            it.height,
            it.bytes,
            it.uploader,
            it.views,
            it.publishedAt,
            it.remotePath,
            it.remoteExt,
            it.previewUrl,
            it.downloadUrl,
            it.page,
            ts,
            ts
          ]
        )
        if (!before) inserted += 1

        // 标签：增量替换，避免每次都全量重写
        if (it.tags.length > 0) this.replaceTags(it.id, it.tags)
      }
      return { inserted, updated: items.length - inserted }
    })
  }

  private replaceTags(itemId: number, tags: string[]): void {
    this.db.run('DELETE FROM item_tags WHERE item_id = ?', [itemId])
    for (const raw of tags) {
      const name = raw.trim()
      if (!name) continue
      this.db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [name])
      const tag = this.db.get<{ id: number }>('SELECT id FROM tags WHERE name = ?', [name])
      if (tag) this.db.run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [itemId, tag.id])
    }
  }

  /** 详情页补全后的富字段回写 */
  applyDetail(
    id: number,
    detail: {
      uploader: string | null
      width: number | null
      height: number | null
      bytes: number | null
      views: number | null
      likes: number | null
      collects: number | null
      pixivId: string | null
      pixivArtistUrl: string | null
      remotePath: string | null
      previewUrl: string | null
      downloadUrl: string | null
      remoteExt: string | null
      tags: string[]
    }
  ): void {
    this.db.transaction(() => {
      this.db.run(
        `UPDATE items SET uploader = COALESCE(?, uploader),
                          width = COALESCE(?, width),
                          height = COALESCE(?, height),
                          bytes = COALESCE(?, bytes),
                          views = COALESCE(?, views),
                          likes = COALESCE(?, likes),
                          collects = COALESCE(?, collects),
                          pixiv_id = COALESCE(?, pixiv_id),
                          pixiv_artist_url = COALESCE(?, pixiv_artist_url),
                          remote_path = COALESCE(?, remote_path),
                          preview_url = COALESCE(?, preview_url),
                          download_url = COALESCE(?, download_url),
                          remote_ext = COALESCE(?, remote_ext),
                          rich = 1,
                          updated_at = ?
        WHERE id = ?`,
        [
          detail.uploader,
          detail.width,
          detail.height,
          detail.bytes,
          detail.views,
          detail.likes,
          detail.collects,
          detail.pixivId,
          detail.pixivArtistUrl,
          detail.remotePath,
          detail.previewUrl,
          detail.downloadUrl,
          detail.remoteExt,
          nowIso(),
          id
        ]
      )
      if (detail.tags.length > 0) this.replaceTags(id, detail.tags)
    })
  }

  getItem(id: number): ItemDetail | null {
    const row = this.db.get<Row>(`${ITEM_SELECT} WHERE i.id = ?`, [id])
    return row ? mapItemDetail(row) : null
  }

  /** 下载完成后用「真实文件信息」覆盖站点标注的尺寸/体积 */
  applyFileMetrics(
    id: number,
    metrics: { width: number | null; height: number | null; bytes: number; ext: string }
  ): void {
    this.db.run(
      `UPDATE items SET width = COALESCE(?, width),
                        height = COALESCE(?, height),
                        bytes = ?,
                        remote_ext = ?,
                        updated_at = ?
       WHERE id = ?`,
      [metrics.width, metrics.height, metrics.bytes, metrics.ext, nowIso(), id]
    )
  }

  listItems(query: GalleryQuery): GalleryPage {
    const { where, params } = buildWhere(query)
    const limit = Math.max(1, Math.min(500, query.limit ?? 60))
    const offset = Number.parseInt(query.cursor ?? '0', 10) || 0

    // 计数查询必须带上与 ITEM_SELECT 相同的 LEFT JOIN：
    // where 里可能引用 f.id（已下载 / 待下载），少了 JOIN 会直接报 no such column
    const total = Number(
      this.db.scalar<number>(
        `SELECT COUNT(*) FROM items i
         LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original'
         ${where}`,
        params
      ) ?? 0
    )
    const order = buildOrder(query.sort ?? 'newest')
    const rows = this.db.all<Row>(`${ITEM_SELECT} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset
    ])
    const items = rows.map(mapItemSummary)
    const nextOffset = offset + items.length
    return {
      items,
      total,
      nextCursor: nextOffset < total && items.length > 0 ? String(nextOffset) : null
    }
  }

  /**
   * 下载队列快照。onlyMissing=true 时只取还没有原图文件的条目。
   * 队列一次取完（几万个整数没有压力），下载阶段再按并发消费。
   */
  listDownloadQueue(
    query: GalleryQuery,
    limit: number,
    onlyMissing: boolean
  ): { id: number; remotePath: string | null; title: string }[] {
    const { where, params } = buildWhere(query)
    const cond = onlyMissing ? (where ? `${where} AND f.id IS NULL` : 'WHERE f.id IS NULL') : where
    const rows = this.db.all<Row>(
      `SELECT i.id, i.remote_path, i.title FROM items i
       LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original'
       ${cond}
       ORDER BY COALESCE(i.published_at, i.indexed_at) DESC, i.id DESC
       LIMIT ?`,
      [...params, limit]
    )
    return rows.map((r) => ({
      id: Number(r.id),
      remotePath: r.remote_path == null ? null : String(r.remote_path),
      title: String(r.title ?? '')
    }))
  }

  /** 指定 id 的下载队列（详情页「下载此图」/批量下载用） */
  listDownloadQueueByIds(ids: number[]): { id: number; remotePath: string | null; title: string }[] {
    if (ids.length === 0) return []
    const marks = ids.map(() => '?').join(',')
    const rows = this.db.all<Row>(
      `SELECT id, remote_path, title FROM items WHERE id IN (${marks})`,
      ids
    )
    return rows.map((r) => ({
      id: Number(r.id),
      remotePath: r.remote_path == null ? null : String(r.remote_path),
      title: String(r.title ?? '')
    }))
  }

  countDownloadQueue(query: GalleryQuery, onlyMissing: boolean): number {
    const { where, params } = buildWhere(query)
    const cond = onlyMissing ? (where ? `${where} AND f.id IS NULL` : 'WHERE f.id IS NULL') : where
    return Number(
      this.db.scalar<number>(
        `SELECT COUNT(*) FROM items i
         LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original'
         ${cond}`,
        params
      ) ?? 0
    )
  }

  setFavorite(id: number, favorite: boolean): void {
    this.db.run('UPDATE items SET favorite = ?, updated_at = ? WHERE id = ?', [favorite ? 1 : 0, nowIso(), id])
  }

  setRating(id: number, rating: number): void {
    this.db.run('UPDATE items SET rating = ?, updated_at = ? WHERE id = ?', [
      Math.max(0, Math.min(5, rating)),
      nowIso(),
      id
    ])
  }

  /** 删除条目及其标签关系（磁盘文件由调用方负责） */
  deleteItems(ids: number[]): void {
    if (ids.length === 0) return
    const marks = ids.map(() => '?').join(',')
    this.db.transaction(() => {
      this.db.run(`DELETE FROM item_tags WHERE item_id IN (${marks})`, ids)
      this.db.run(`DELETE FROM files WHERE item_id IN (${marks})`, ids)
      this.db.run(`DELETE FROM items WHERE id IN (${marks})`, ids)
    })
  }

  /* --------------------------------------------------------------- 文件 */

  upsertFile(file: FileUpsert): void {
    const variant = file.variant ?? 'original'
    this.db.run(
      `INSERT INTO files (item_id, rel_path, thumb_rel, ext, mime, width, height, bytes, sha256, variant, downloaded_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(item_id, variant) DO UPDATE SET
         rel_path = excluded.rel_path,
         thumb_rel = COALESCE(excluded.thumb_rel, files.thumb_rel),
         ext = excluded.ext, mime = excluded.mime,
         width = COALESCE(excluded.width, files.width),
         height = COALESCE(excluded.height, files.height),
         bytes = excluded.bytes, sha256 = excluded.sha256,
         downloaded_at = excluded.downloaded_at`,
      [
        file.itemId,
        file.relPath,
        file.thumbRel,
        file.ext,
        file.mime,
        file.width,
        file.height,
        file.bytes,
        file.sha256,
        variant,
        nowIso()
      ]
    )
  }

  getFilesForItems(ids: number[]): Map<number, string> {
    if (ids.length === 0) return new Map()
    const marks = ids.map(() => '?').join(',')
    const rows = this.db.all<Row>(
      `SELECT item_id, rel_path FROM files WHERE variant = 'original' AND item_id IN (${marks})`,
      ids
    )
    return new Map(rows.map((r) => [Number(r.item_id), String(r.rel_path)]))
  }

  removeFile(itemId: number, variant: 'original' | 'preview' = 'original'): void {
    this.db.run('DELETE FROM files WHERE item_id = ? AND variant = ?', [itemId, variant])
  }

  /* --------------------------------------------------------------- 汇总 */

  facets(): { plates: PlateFacet[]; topTags: Facet[]; words: Facet[] } {
    // 一次查询拿全「一级分类 -> 二级分类」树，避免侧栏展开时串味
    const rows = this.db.all<Row>(
      `SELECT plate AS plate, word AS word, COUNT(*) AS count
       FROM items WHERE plate IS NOT NULL AND word IS NOT NULL
       GROUP BY plate, word ORDER BY plate, count DESC`
    )
    const byPlate = new Map<string, PlateFacet>()
    for (const row of rows) {
      const plateName = String(row.plate)
      let entry = byPlate.get(plateName)
      if (!entry) {
        entry = { name: plateName, count: 0, words: [] }
        byPlate.set(plateName, entry)
      }
      const count = Number(row.count)
      entry.count += count
      entry.words.push({ name: String(row.word), count })
    }
    const plates = [...byPlate.values()].sort((a, b) => b.count - a.count)
    const topTags = this.db
      .all<Row>(
        `SELECT t.name AS name, COUNT(*) AS count
         FROM item_tags it JOIN tags t ON t.id = it.tag_id
         GROUP BY t.id ORDER BY count DESC, t.name LIMIT 120`
      )
      .map((r) => ({ name: String(r.name), count: Number(r.count) }))
    // 关键词搜索类目标没有一级分类（plate 为 NULL），
    // 所以另给一份「摊平到 word」的计数，界面用它给分类挂数量
    const words = this.db
      .all<Row>('SELECT word AS name, COUNT(*) AS count FROM items WHERE word IS NOT NULL GROUP BY word')
      .map((r) => ({ name: String(r.name), count: Number(r.count) }))
    return { plates, topTags, words }
  }

  stats(libraryRoot: string): LibraryStats {
    const items = Number(this.db.scalar<number>('SELECT COUNT(*) FROM items') ?? 0)
    const downloaded = Number(this.db.scalar<number>('SELECT COUNT(*) FROM files WHERE variant = "original"') ?? 0)
    const favorites = Number(this.db.scalar<number>('SELECT COUNT(*) FROM items WHERE favorite = 1') ?? 0)
    const totalBytes = Number(this.db.scalar<number>('SELECT COALESCE(SUM(bytes),0) FROM files') ?? 0)
    const sources = Number(this.db.scalar<number>('SELECT COUNT(*) FROM sources') ?? 0)
    return {
      items,
      downloaded,
      favorites,
      totalBytes,
      sources,
      libraryRoot,
      dbBytes: this.db.size(),
      ...this.facets()
    }
  }

  /* --------------------------------------------------------------- 任务 */

  createJob(phase: string, summary: string, request: unknown): number {
    this.db.run('INSERT INTO jobs (phase, summary, request, stats, started_at) VALUES (?,?,?,?,?)', [
      phase,
      summary,
      JSON.stringify(request),
      '{}',
      nowIso()
    ])
    return Number(this.db.scalar<number>('SELECT MAX(id) FROM jobs') ?? 0)
  }

  finishJob(id: number, phase: string, stats: Record<string, number>): void {
    this.db.run('UPDATE jobs SET phase = ?, stats = ?, finished_at = ? WHERE id = ?', [
      phase,
      JSON.stringify(stats),
      nowIso(),
      id
    ])
  }

  recentJobs(limit = 30): Row[] {
    return this.db.all<Row>('SELECT * FROM jobs ORDER BY id DESC LIMIT ?', [limit])
  }

  /* ----------------------------------------------------------- 断点续爬 */

  markPage(sourceUrl: string, page: number, itemCount: number): void {
    this.db.run(
      `INSERT INTO page_marks (source_url, page, item_count, fetched_at) VALUES (?,?,?,?)
       ON CONFLICT(source_url, page) DO UPDATE SET item_count = excluded.item_count, fetched_at = excluded.fetched_at`,
      [sourceUrl, page, itemCount, nowIso()]
    )
  }

  getMarkedPages(sourceUrl: string): Map<number, number> {
    const rows = this.db.all<Row>('SELECT page, item_count FROM page_marks WHERE source_url = ?', [sourceUrl])
    return new Map(rows.map((r) => [Number(r.page), Number(r.item_count)]))
  }

  /* --------------------------------------------------------------- 设置 */

  getSetting<T>(key: string): T | null {
    const row = this.db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [`setting.${key}`])
    if (!row) return null
    try {
      return JSON.parse(row.value) as T
    } catch {
      return null
    }
  }

  setSetting(key: string, value: unknown): void {
    this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [`setting.${key}`, JSON.stringify(value)])
  }

  loadSettings(defaults: AppSettings): AppSettings {
    const stored = this.getSetting<Partial<AppSettings>>('app')
    return { ...defaults, ...(stored ?? {}) }
  }

  saveSettings(settings: AppSettings): void {
    this.setSetting('app', settings)
  }
}

/* -------------------------------------------------------------- SQL 片段 */

const ITEM_SELECT = /* sql */ `
SELECT i.*,
       f.rel_path  AS file_rel_path,
       f.thumb_rel AS file_thumb_rel,
       f.ext       AS file_ext,
       f.bytes     AS file_bytes,
       f.sha256    AS file_sha256,
       f.width     AS file_width,
       f.height    AS file_height,
       f.downloaded_at AS file_downloaded_at,
       (SELECT GROUP_CONCAT(t.name, char(31))
          FROM item_tags it JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id = i.id) AS tag_names
FROM items i
LEFT JOIN files f ON f.item_id = i.id AND f.variant = 'original'
`

function buildWhere(query: GalleryQuery): { where: string; params: SqlValue[] } {
  const clauses: string[] = []
  const params: SqlValue[] = []

  if (query.plate) {
    clauses.push('i.plate = ?')
    params.push(query.plate)
  }
  if (query.word) {
    clauses.push('i.word = ?')
    params.push(query.word)
  }
  if (query.favorite) clauses.push('i.favorite = 1')
  if (query.downloaded === 'only') clauses.push('f.id IS NOT NULL')
  if (query.downloaded === 'never') clauses.push('f.id IS NULL')
  if (query.minWidth && query.minWidth > 0) {
    clauses.push('COALESCE(i.width, 0) >= ?')
    params.push(query.minWidth)
  }
  if (query.minHeight && query.minHeight > 0) {
    clauses.push('COALESCE(i.height, 0) >= ?')
    params.push(query.minHeight)
  }
  if (query.monthFrom) {
    // published_at 存的是 'YYYY-MM-DD HH:mm'，按字典序比较即可。
    // 界面只让选到月，下限就补成当月 1 号 00:00。
    clauses.push("COALESCE(i.published_at, '') >= ?")
    params.push(`${query.monthFrom}-01 00:00`)
  }
  if (query.monthTo) {
    // 上界用「下个月 1 号 00:00」，这样「到 2026-09」是包含整个 9 月的闭区间
    clauses.push("COALESCE(i.published_at, '') < ?")
    params.push(`${nextMonth(query.monthTo)}-01 00:00`)
  }
  if (query.pageFrom != null) {
    clauses.push('i.page IS NOT NULL AND i.page >= ?')
    params.push(query.pageFrom)
  }
  if (query.pageTo != null) {
    clauses.push('i.page IS NOT NULL AND i.page <= ?')
    params.push(query.pageTo)
  }
  if (query.orientation && query.orientation !== 'any') {
    if (query.orientation === 'landscape') clauses.push('i.width > i.height')
    else if (query.orientation === 'portrait') clauses.push('i.height > i.width')
    else clauses.push('i.width = i.height')
  }

  const tags = (query.tags ?? []).filter(Boolean)
  if (tags.length > 0) {
    const marks = tags.map(() => '?').join(',')
    if (query.tagMode === 'all') {
      clauses.push(
        `i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
                  WHERE t.name IN (${marks}) GROUP BY it.item_id HAVING COUNT(DISTINCT t.name) = ?)`
      )
      params.push(...tags, tags.length)
    } else {
      clauses.push(
        `i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name IN (${marks}))`
      )
      params.push(...tags)
    }
  }

  const excludeTags = (query.excludeTags ?? []).filter(Boolean)
  if (excludeTags.length > 0) {
    const marks = excludeTags.map(() => '?').join(',')
    clauses.push(
      `i.id NOT IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name IN (${marks}))`
    )
    params.push(...excludeTags)
  }

  const text = query.text?.trim()
  if (text) {
    const like = `%${text.replace(/[%_]/g, (c) => `\\${c}`)}%`
    clauses.push(
      `(i.title LIKE ? ESCAPE '\\' OR i.plate LIKE ? ESCAPE '\\' OR i.word LIKE ? ESCAPE '\\'
        OR i.pixiv_id LIKE ? ESCAPE '\\' OR i.uploader LIKE ? ESCAPE '\\'
        OR i.id IN (SELECT it.item_id FROM item_tags it JOIN tags t ON t.id = it.tag_id
                    WHERE t.name LIKE ? ESCAPE '\\'))`
    )
    params.push(like, like, like, like, like, like)
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

/** 'YYYY-MM' -> 下个月；用于月份上界的开区间比较 */
function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return month
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function buildOrder(sort: NonNullable<GalleryQuery['sort']>): string {
  switch (sort) {
    case 'oldest':
      return 'COALESCE(i.published_at, i.indexed_at) ASC, i.id ASC'
    case 'views':
      return 'COALESCE(i.views, 0) DESC, i.id DESC'
    case 'size':
      return 'COALESCE(f.bytes, i.bytes, 0) DESC, i.id DESC'
    case 'resolution':
      return '(COALESCE(i.width,0) * COALESCE(i.height,0)) DESC, i.id DESC'
    case 'title':
      return 'i.title ASC, i.id ASC'
    case 'random':
      return 'RANDOM()'
    case 'newest':
    default:
      return 'COALESCE(i.published_at, i.indexed_at) DESC, i.id DESC'
  }
}

/* ---------------------------------------------------------------- 映射器 */

function mapSource(row: Row): SourceRef {
  return {
    id: Number(row.id),
    kind: String(row.kind) as SourceRef['kind'],
    plate: row.plate == null ? null : String(row.plate),
    word: row.word == null ? null : String(row.word),
    url: String(row.url),
    title: String(row.title),
    enabled: Number(row.enabled) === 1,
    itemCount: Number(row.item_count ?? 0),
    lastCrawledAt: row.last_crawled_at == null ? null : String(row.last_crawled_at)
  }
}

function parseTagNames(value: unknown): string[] {
  if (value == null) return []
  return String(value)
    .split('\u001f')
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapItemSummary(row: Row): ItemSummary {
  const hasFile = row.file_rel_path != null
  const id = Number(row.id)
  return {
    id,
    title: String(row.title ?? ''),
    plate: row.plate == null ? null : String(row.plate),
    word: row.word == null ? null : String(row.word),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    bytes: row.bytes == null ? null : Number(row.bytes),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    views: row.views == null ? null : Number(row.views),
    tags: parseTagNames(row.tag_names),
    pixivId: row.pixiv_id == null ? null : String(row.pixiv_id),
    favorite: Number(row.favorite) === 1,
    rating: Number(row.rating ?? 0),
    fileStatus: hasFile ? 'ready' : 'missing',
    ext: row.file_ext == null ? (row.remote_ext == null ? null : String(row.remote_ext)) : String(row.file_ext),
    fileBytes: row.file_bytes == null ? null : Number(row.file_bytes),
    thumbUrl: hasFile ? `gugu://thumb/${id}` : null,
    imageUrl: hasFile ? `gugu://media/${id}` : null
  }
}

function mapItemDetail(row: Row): ItemDetail {
  return {
    ...mapItemSummary(row),
    detailUrl: String(row.detail_url ?? ''),
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    uploader: row.uploader == null ? null : String(row.uploader),
    pixivArtistUrl: row.pixiv_artist_url == null ? null : String(row.pixiv_artist_url),
    likes: Number(row.likes ?? 0),
    collects: Number(row.collects ?? 0),
    remotePath: row.remote_path == null ? null : String(row.remote_path),
    previewUrl: row.preview_url == null ? null : String(row.preview_url),
    downloadUrl: row.download_url == null ? null : String(row.download_url),
    sha256: row.file_sha256 == null ? null : String(row.file_sha256),
    relPath: row.file_rel_path == null ? null : String(row.file_rel_path),
    downloadedAt: row.file_downloaded_at == null ? null : String(row.file_downloaded_at),
    indexedAt: row.indexed_at == null ? null : String(row.indexed_at)
  }
}

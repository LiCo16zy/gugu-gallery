/**
 * SQLite（sql.js / WebAssembly）封装。
 *
 * 为什么用 sql.js 而不是 better-sqlite3：本机没有 MSVC 构建工具链，
 * 任何原生模块都装不上；sql.js 是纯 WASM，跨平台零编译，
 * 代价是整个库常驻内存、写盘靠整库导出 —— 对个人图库这个量级完全够用。
 *
 * 落盘策略：写操作标记 dirty，1.5s 防抖 + 每 30s 兜底 + 退出时强制 flush，
 * 采用「写临时文件再 rename」保证不会有半截数据库文件。
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js'
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema'

export type Row = Record<string, SqlValue>

export class Database_ {
  private constructor(
    private db: Database,
    private path: string
  ) {}

  private dirty = false
  private flushTimer: NodeJS.Timeout | null = null
  private periodicTimer: NodeJS.Timeout | null = null
  private flushing: Promise<void> | null = null
  private closed = false

  static async open(path: string): Promise<Database_> {
    const SQL: SqlJsStatic = await initSqlJs()
    await mkdir(dirname(path), { recursive: true })
    let db: Database
    if (existsSync(path)) {
      const buf = await readFile(path)
      db = new SQL.Database(new Uint8Array(buf))
    } else {
      db = new SQL.Database()
    }
    const self = new Database_(db, path)
    self.migrate()
    self.periodicTimer = setInterval(() => void self.flush(), 30_000)
    self.periodicTimer.unref?.()
    return self
  }

  /** 轻量迁移：老库缺列时补上，避免用户升级后被要求重建索引 */
  private addMissingColumns(): void {
    const columns = new Set(this.all<{ name: string }>('PRAGMA table_info(items)').map((r) => String(r.name)))
    if (!columns.has('page')) {
      this.db.run('ALTER TABLE items ADD COLUMN page INTEGER')
    }
    this.db.run('CREATE INDEX IF NOT EXISTS idx_items_page ON items (page)')
  }

  private migrate(): void {
    this.db.run(SCHEMA_SQL)
    this.addMissingColumns()
    const current = this.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['schema_version'])
    if (!current) {
      this.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['schema_version', String(SCHEMA_VERSION)])
      this.dirty = true
    } else if (Number(current.value) !== SCHEMA_VERSION) {
      this.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['schema_version', String(SCHEMA_VERSION)])
      this.dirty = true
    }
  }

  /* ------------------------------------------------------------ 查询接口 */

  all<T extends Row = Row>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql)
    try {
      stmt.bind(params)
      const out: T[] = []
      while (stmt.step()) out.push(stmt.getAsObject() as T)
      return out
    } finally {
      stmt.free()
    }
  }

  get<T extends Row = Row>(sql: string, params: SqlValue[] = []): T | null {
    const rows = this.all<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  scalar<T extends SqlValue = SqlValue>(sql: string, params: SqlValue[] = []): T | null {
    const row = this.get(sql, params)
    if (!row) return null
    const values = Object.values(row)
    return values.length > 0 ? (values[0] as T) : null
  }

  run(sql: string, params: SqlValue[] = []): void {
    this.db.run(sql, params)
    this.touch()
  }

  /** 批量 upsert 放进事务里，几万条也就几十毫秒 */
  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN')
    try {
      const result = fn()
      this.db.run('COMMIT')
      this.touch()
      return result
    } catch (err) {
      this.db.run('ROLLBACK')
      throw err
    }
  }

  /* ------------------------------------------------------------ 持久化 */

  private touch(): void {
    this.dirty = true
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, 1500)
    this.flushTimer.unref?.()
  }

  async flush(): Promise<void> {
    if (this.closed || !this.dirty) return
    if (this.flushing) return this.flushing
    this.dirty = false
    this.flushing = (async () => {
      try {
        const data = this.db.export()
        const tmp = `${this.path}.tmp`
        await writeFile(tmp, data)
        await rename(tmp, this.path)
      } catch {
        this.dirty = true // 写失败下次再试
      } finally {
        this.flushing = null
      }
    })()
    return this.flushing
  }

  async close(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.periodicTimer) clearInterval(this.periodicTimer)
    this.dirty = true
    await this.flush()
    this.closed = true
    this.db.close()
  }

  get filePath(): string {
    return this.path
  }

  /** 数据库当前占用的字节数（导出后大小） */
  size(): number {
    try {
      return this.db.export().byteLength
    } catch {
      return 0
    }
  }
}

export { Database_ as Database }

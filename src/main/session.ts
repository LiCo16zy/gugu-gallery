/**
 * 登录态存储。
 *
 * 只保存站点的会话 cookie（PHPSESSID），**不保存账号密码** ——
 * 用户在浏览器里自己登录，再把 cookie 交给应用。
 *
 * 落盘用 Electron 的 safeStorage（Windows 下走 DPAPI，绑定当前用户账户），
 * 明文不写文件。若当前环境拿不到加密能力，就退化成「只存内存」，
 * 宁可每次重贴，也不把凭证明文写到磁盘上。
 */
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

export interface SessionStatus {
  loggedIn: boolean
  /** 凭据指纹（只用于界面显示，不可反推），未登录为 null */
  fingerprint: string | null
  savedAt: string | null
  /** 能否加密落盘 */
  encrypted: boolean
  /** 站点校验结果：null 表示还没验过 */
  verified: boolean | null
  verifyMessage: string | null
}

export class SessionStore {
  private readonly file: string
  private cookie: string | null = null
  private savedAt: string | null = null
  private verified: boolean | null = null
  private verifyMessage: string | null = null
  /** 会话失效只提醒一次，避免刷屏 */
  private expiryNotified = false

  constructor() {
    this.file = join(app.getPath('userData'), 'session.bin')
  }

  private get canEncrypt(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  async load(): Promise<void> {
    if (!existsSync(this.file)) return
    try {
      const raw = await readFile(this.file)
      if (!this.canEncrypt) return
      const text = safeStorage.decryptString(raw)
      const parsed = JSON.parse(text) as { cookie?: string; savedAt?: string }
      if (parsed.cookie) {
        this.cookie = parsed.cookie
        this.savedAt = parsed.savedAt ?? null
      }
    } catch {
      // 解不开（换了机器 / 换了用户）就当没有
      await this.clear()
    }
  }

  /** 当前要注入请求的 Cookie 头，未登录返回 null */
  get cookieHeader(): string | null {
    if (!this.cookie) return null
    return this.cookie.includes('=') ? this.cookie : `PHPSESSID=${this.cookie}`
  }

  isLoggedIn(): boolean {
    return this.cookieHeader != null
  }

  /** 提醒过一次就不再提醒 */
  shouldNotifyExpiry(): boolean {
    return !this.expiryNotified
  }

  markExpired(message: string): void {
    this.verified = false
    this.verifyMessage = message
    this.expiryNotified = true
  }

  markVerified(): void {
    this.verified = true
    this.verifyMessage = null
    this.expiryNotified = false
  }

  async save(input: string): Promise<void> {
    const trimmed = input.trim()
    if (!trimmed) throw new Error('cookie 不能为空')
    this.cookie = trimmed
    this.savedAt = new Date().toISOString()
    this.verified = null
    this.verifyMessage = null
    this.expiryNotified = false
    if (!this.canEncrypt) return
    const payload = JSON.stringify({ cookie: this.cookie, savedAt: this.savedAt })
    await writeFile(this.file, safeStorage.encryptString(payload))
  }

  async clear(): Promise<void> {
    this.cookie = null
    this.savedAt = null
    this.verified = null
    this.verifyMessage = null
    this.expiryNotified = false
    await rm(this.file, { force: true }).catch(() => {})
  }

  status(): SessionStatus {
    return {
      loggedIn: this.isLoggedIn(),
      fingerprint: this.cookie ? fingerprint(this.cookie) : null,
      savedAt: this.savedAt,
      encrypted: this.canEncrypt,
      verified: this.verified,
      verifyMessage: this.verifyMessage
    }
  }
}

/** 只暴露头尾几位，用来确认「是不是换了一份」，不足以还原凭证 */
function fingerprint(cookie: string): string {
  const value = cookie.includes('=') ? cookie.split('=').slice(1).join('=') : cookie
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

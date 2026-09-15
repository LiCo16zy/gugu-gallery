import { useState } from 'react'
import type { SessionStatus } from '@shared/bridge'
import type { ToastPayload } from './Toast'
import { api } from '../api'

interface Props {
  session: SessionStatus | null
  /** 上一次操作的结果说明；由外层持有，登录态失效时也能带进来 */
  message: string | null
  onSession: (status: SessionStatus) => void
  onMessage: (message: string | null) => void
  onClose: () => void
  onToast: (text: string, duration?: number, kind?: ToastPayload['kind']) => void
}

/**
 * 登录引导。
 *
 * 站点有一部分内容（泳装分享）只在登录后可见，而登录要过验证码，
 * 所以这里不去模拟登录表单，而是让用户用浏览器登录、把会话 cookie 交过来 ——
 * 好处是**账号密码从头到尾不经过本应用**。
 */
export default function LoginGuide({
  session,
  message,
  onSession,
  onMessage,
  onClose,
  onToast
}: Props): JSX.Element {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    setBusy(true)
    onMessage(null)
    try {
      const r = await api.session.set(draft.trim())
      onSession(r.status)
      onMessage(r.verify.message)
      if (r.verify.ok) {
        setDraft('')
        onToast('登录态已生效', 1600, 'success')
        onClose()
      }
    } catch (err) {
      onMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const verify = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await api.session.verify()
      onSession(r.status)
      onMessage(r.verify.message)
    } finally {
      setBusy(false)
    }
  }

  const clear = async (): Promise<void> => {
    onSession(await api.session.clear())
    onMessage('已清除本地登录凭据')
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal login-guide" data-component="App/LoginGuide" onClick={(e) => e.stopPropagation()}>
        <h3>登录</h3>

        <div className="panel-title" style={{ marginBottom: 8 }}>
          登录态
          <span className="hint">
            {session?.loggedIn
              ? '已登录 ' + (session.fingerprint ?? '') + (session.encrypted ? ' · 已加密保存' : ' · 仅本次有效')
              : '未登录 · 只影响「泳装分享」分类'}
          </span>
        </div>

        {message && (
          <p className="setup-error" style={{ marginTop: 0 }}>
            {message}
          </p>
        )}

        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.8 }}>
          本应用<strong>不保存账号密码</strong>。请先用浏览器登录 guguxz.com，
          按 F12 → Console 输入 <code>document.cookie</code>，
          把 <code>PHPSESSID=...</code> 那一段粘到下面。
          它会用系统密钥链加密后存在本地，随时可以清除。
        </p>

        <textarea
          className="cookie-input"
          rows={2}
          spellCheck={false}
          placeholder="PHPSESSID=xxxxxxxx"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn primary sm" disabled={busy || draft.trim() === ''} onClick={() => void save()}>
            保存并验证
          </button>
          <button className="btn sm" disabled={busy || !session?.loggedIn} onClick={() => void verify()}>
            重新验证
          </button>
          <button className="btn sm danger" disabled={busy || !session?.loggedIn} onClick={() => void clear()}>
            清除
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => void api.openExternal('https://www.guguxz.com/login.html')}>
            去浏览器登录
          </button>
          <button className="btn primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

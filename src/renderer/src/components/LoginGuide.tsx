import { useEffect, useState } from 'react'
import type { SessionStatus } from '@shared/bridge'
import type { ToastPayload } from './Toast'
import { api } from '../api'

interface Props {
  session: SessionStatus | null
  onSession: (status: SessionStatus) => void
  onClose: () => void
  onToast: (text: string, duration?: number, kind?: ToastPayload['kind']) => void
}

/** 按钮点完冷却 1s：既是「点过了」的反馈，也顺手防连点 */
const COOLDOWN_MS = 1000

/**
 * 登录引导。
 *
 * 站点有一部分内容（泳装分享）只在登录后可见，而登录要过验证码，
 * 所以这里不去模拟登录表单，而是让用户用浏览器登录、把会话 cookie 交过来 ——
 * 好处是**账号密码从头到尾不经过本应用**。
 */
export default function LoginGuide({ session, onSession, onClose, onToast }: Props): JSX.Element {
  const [draft, setDraft] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [cooling, setCooling] = useState(false)

  const loggedIn = session?.loggedIn === true && session?.verified !== false

  // 每次打开都是干净的：上一次的提示不带进来
  useEffect(() => {
    setDraft('')
    setMsg(null)
    setCooling(false)
  }, [])

  /** 点一下冷却 1s */
  const cooldown = (): void => {
    setCooling(true)
    setTimeout(() => setCooling(false), COOLDOWN_MS)
  }

  const save = async (): Promise<void> => {
    cooldown()
    try {
      const r = await api.session.set(draft.trim())
      onSession(r.status)
      if (r.verify.ok) {
        setDraft('')
        setMsg({ kind: 'ok', text: '登录态已生效' })
        onToast('登录态已生效', 1600, 'success')
      } else {
        // 失败也要弹一下：光有一行小字容易被当成"点了没反应"
        setMsg({ kind: 'error', text: r.verify.message })
        onToast(r.verify.message, 2800, 'warn')
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : '保存失败'
      setMsg({ kind: 'error', text })
      onToast(text, 2800, 'warn')
    }
  }

  const verify = async (): Promise<void> => {
    cooldown()
    try {
      const r = await api.session.verify()
      onSession(r.status)
      setMsg({ kind: r.verify.ok ? 'ok' : 'error', text: r.verify.message })
      if (!r.verify.ok) onToast(r.verify.message, 2800, 'warn')
    } catch (err) {
      const text = err instanceof Error ? err.message : '校验失败'
      setMsg({ kind: 'error', text })
      onToast(text, 2800, 'warn')
    }
  }

  const visit = (): void => {
    cooldown()
    void api.openExternal('https://www.guguxz.com/login.html')
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal login-guide" data-component="App/LoginGuide" onClick={(e) => e.stopPropagation()}>
        <h3>登录</h3>

        <div className="panel-title" style={{ marginBottom: 8 }}>
          登陆状态
          <span className="hint">
            {session?.loggedIn
              ? (session.verified === false ? '凭据已失效 ' : '已登录 ') +
                (session.fingerprint ?? '') +
                (session.encrypted ? ' · 已加密保存' : ' · 仅本次有效')
              : '未登录'}
          </span>
        </div>

        {msg && (
          <p className={msg.kind === 'error' ? 'setup-error' : 'setup-ok'} style={{ marginTop: 0 }}>
            {msg.text}
          </p>
        )}

        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.8 }}>
          本应用<strong>不保存账号密码</strong>。请先用浏览器登录 guguxz.com，
          按 F12 → Console 输入 <code>document.cookie</code>，
          把 <code>PHPSESSID=...</code> 那一段粘到下面。
          它会用系统密钥链加密后存在本地。
        </p>

        <textarea
          className="cookie-input"
          rows={2}
          spellCheck={false}
          placeholder="PHPSESSID=xxxxxxxx"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <div className="modal-actions">
          <button
            className="btn primary"
            disabled={cooling || (!loggedIn && draft.trim() === '')}
            onClick={() => void (loggedIn ? verify() : save())}
          >
            {loggedIn ? '重新验证' : '保存并验证'}
          </button>
          <button className="btn" disabled={cooling} onClick={visit}>
            去浏览器登录
          </button>
        </div>
      </div>
    </div>
  )
}

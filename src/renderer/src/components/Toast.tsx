import { useEffect, useRef, useState } from 'react'

export interface ToastPayload {
  /** 每次弹出换一个 id，强制重播动画 */
  id: number
  text: string
  /** 可见时长（毫秒），不含淡入淡出 */
  duration: number
  kind?: 'info' | 'success' | 'warn'
}

interface Props {
  toast: ToastPayload | null
  onDismiss: () => void
}

export const TOAST_FADE_MS = 80

/**
 * 轻提示：位置固定在底部居中，淡入淡出各 80ms，中间停留时长由调用方决定。
 * 同一时刻只存在一条，新的会顶掉旧的。
 */
export default function Toast({ toast, onDismiss }: Props): JSX.Element | null {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLeaving(false)
    if (!toast) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setLeaving(true)
      timer.current = setTimeout(onDismiss, TOAST_FADE_MS)
    }, toast.duration)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div
      key={toast.id}
      className={'toast' + (leaving ? ' leaving' : '') + (toast.kind && toast.kind !== 'info' ? ' ' + toast.kind : '')}
      data-component="Toast"
      role="status"
    >
      {toast.text}
    </div>
  )
}

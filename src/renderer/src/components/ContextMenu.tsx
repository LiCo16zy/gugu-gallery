import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface MenuEntry {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  /** 点击后的回调；有 children 时忽略 */
  onSelect?: () => void
  /** 折叠子项：点击父项就地展开，而不是弹出二级浮层 */
  children?: MenuEntry[]
}

interface Props {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}

/** 卡片右键菜单：轻量自绘，样式与应用一致，不引入额外依赖 */
export default function ContextMenu({ x, y, entries, onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [openKey, setOpenKey] = useState<string | null>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 折叠子项的收起刻意做得「迟钝」一些：
   * 菜单项和子菜单之间有一道视觉间隙，鼠标慢速移过去时会经过空白，
   * 立刻收起的话子项根本点不到。所以改成离开 2s 后才收，
   * 中途只要回到父项或进入子项就取消。
   */
  const cancelCollapse = (): void => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
  }
  const scheduleCollapse = (key: string): void => {
    cancelCollapse()
    collapseTimer.current = setTimeout(() => setOpenKey((k) => (k === key ? null : k)), 2000)
  }

  useEffect(() => cancelCollapse, [])

  // 贴边时把菜单收进视口
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.min(x, window.innerWidth - rect.width - 8)
    const top = Math.min(y, window.innerHeight - rect.height - 8)
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [x, y, openKey])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = (): void => onClose()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="ctx-menu"
      data-component="ContextMenu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry) => (
        <div
          key={entry.key}
          onMouseEnter={() => {
            cancelCollapse()
            if (entry.children?.length) setOpenKey(entry.key)
          }}
          onMouseLeave={() => {
            if (entry.children?.length) scheduleCollapse(entry.key)
          }}
        >
          <button
            className={'ctx-item' + (entry.danger ? ' danger' : '') + (openKey === entry.key ? ' open' : '')}
            disabled={entry.disabled}
            onClick={() => {
              if (entry.children?.length) return
              entry.onSelect?.()
              onClose()
            }}
          >
            {entry.icon}
            <span>{entry.label}</span>
            {entry.children?.length ? (
              <span className="ctx-caret" aria-hidden>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </span>
            ) : null}
          </button>
          {entry.children?.length && openKey === entry.key ? (
            <div className="ctx-sub" onMouseEnter={() => cancelCollapse()}>
              {entry.children.map((child) => (
                <button
                  key={child.key}
                  className={'ctx-item' + (child.danger ? ' danger' : '')}
                  disabled={child.disabled}
                  onClick={() => {
                    child.onSelect?.()
                    onClose()
                  }}
                >
                  {child.icon}
                  <span>{child.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

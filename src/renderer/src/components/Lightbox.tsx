import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ItemDetail, ItemSummary } from '@shared/types'
import { api, formatBytes, formatDateTime, megapixels } from '../api'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconExternal,
  IconFolder,
  IconStar,
  IconTrash,
  IconZoomIn,
  IconZoomOut
} from './Icons'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 6

interface Props {
  id: number
  items: ItemSummary[]
  onClose: () => void
  onSelect: (id: number) => void
  onToggleTag: (tag: string) => void
  onChanged: (id: number, patch: Partial<ItemSummary>) => void
  onToast: (message: string) => void
}

export default function Lightbox({
  id,
  items,
  onClose,
  onSelect,
  onToggleTag,
  onChanged,
  onToast
}: Props): JSX.Element {
  const [detail, setDetail] = useState<ItemDetail | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragState, setDragState] = useState<{ active: boolean }>({ active: false })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const index = items.findIndex((i) => i.id === id)
  const prev = index > 0 ? items[index - 1] : null
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null

  useEffect(() => {
    let alive = true
    setDetail(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    void api.library.item(id).then((d) => {
      if (alive) setDetail(d)
    })
    return () => {
      alive = false
    }
  }, [id])

  const step = useCallback(
    (delta: number) => {
      const target = delta < 0 ? prev : next
      if (target) onSelect(target.id)
    },
    [prev, next, onSelect]
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'ArrowRight') step(1)
      else if (event.key === '+' || event.key === '=') setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))
      else if (event.key === '-') setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))
      else if (event.key === '0') {
        setZoom(1)
        setOffset({ x: 0, y: 0 })
      } else if (event.key.toLowerCase() === 'f' && detail) {
        void toggleFavorite()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, onClose, detail])

  const toggleFavorite = useCallback(async () => {
    if (!detail) return
    const value = await api.library.favorite(detail.id, !detail.favorite)
    setDetail({ ...detail, favorite: value })
    onChanged(detail.id, { favorite: value })
  }, [detail, onChanged])

  /**
   * 滚轮缩放：以光标为锚点，保证指针下的那个像素不动。
   * 设容器中心为原点、指针位置 p、图片偏移 offset、缩放 z，
   * 指针指向的图片坐标 q = (p - offset) / z；要让 q 落到新缩放 z2 的同一位置，
   * 需要 offset2 = p - q * z2。
   */
  const onWheel = useCallback((event: WheelEvent) => {
    const stage = stageRef.current
    if (!stage) return
    event.preventDefault()
    const rect = stage.getBoundingClientRect()
    const px = event.clientX - (rect.left + rect.width / 2)
    const py = event.clientY - (rect.top + rect.height / 2)
    setZoom((z) => {
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor))
      if (nextZoom === z) return z
      setOffset((o) => ({
        x: px - ((px - o.x) / z) * nextZoom,
        y: py - ((py - o.y) / z) * nextZoom
      }))
      return nextZoom
    })
  }, [])

  // 滚轮要 preventDefault，React 合成事件挂在 passive 监听上拦不住
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [onWheel, detail])

  // 拖动改为挂在 window 上：鼠标移出舞台也不会丢事件
  useEffect(() => {
    if (!dragState.active) return
    const onMove = (event: MouseEvent): void => {
      const d = drag.current
      if (!d) return
      setOffset({ x: d.ox + (event.clientX - d.x), y: d.oy + (event.clientY - d.y) })
    }
    const onUp = (): void => {
      drag.current = null
      setDragState({ active: false })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragState.active])

  const strip = useMemo(() => {
    const from = Math.max(0, index - 12)
    return items.slice(from, from + 25)
  }, [items, index])

  const summary = items.find((i) => i.id === id) ?? null

  /**
   * 上传者：站点把所有来源都标成「匿名-分享」，没有信息量。
   * 真正有用的是详情页里的 Pixiv 用户链接 —— 它就是转载/上传者本人，
   * 所以优先显示它，并且不再额外宣称对方是「画师」（那只是上传者，未必是作者）。
   */
  const uploaderLabel = (() => {
    const url = detail?.pixivArtistUrl
    if (url) {
      return {
        text: url.replace('https://www.pixiv.net/users/', 'users/'),
        href: url
      }
    }
    const raw = detail?.uploader?.trim()
    if (raw && !/匿名|分享/.test(raw)) return { text: raw, href: null }
    return { text: '未知', href: null }
  })()

  return (
    <div className="lightbox" data-component="Lightbox">
      <div
        ref={stageRef}
        data-component="Lightbox/Stage"
        className={'lightbox-stage' + (dragState.active ? ' dragging' : '')}
        onMouseDown={(e) => {
          // 左键拖动平移：任何时候都能拖，不再要求先放大
          if (e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
          setDragState({ active: true })
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {detail?.imageUrl ? (
          <img
            src={detail.imageUrl}
            alt={detail.title}
            style={{ transform: 'translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + zoom + ')' }}
            draggable={false}
          />
        ) : (
          <div className="lightbox-empty">
            <h3>这张图还没有下载到本地</h3>
            <p>到「抓取」页面对这个分类执行一次下载，或使用右侧的「下载此图」。</p>
          </div>
        )}

        <button className="lb-nav prev" onClick={() => step(-1)} disabled={!prev} title="上一张 (←)">
          <IconChevronLeft width={20} height={20} />
        </button>
        <button className="lb-nav next" onClick={() => step(1)} disabled={!next} title="下一张 (→)">
          <IconChevronRight width={20} height={20} />
        </button>
      </div>

      <div className="lightbox-side" data-component="Lightbox/SidePanel">
        <div className="lb-head">
          <h3>{detail?.title || summary?.title || `#${id}`}</h3>
          <button className="lb-close" onClick={onClose} title="关闭 (Esc)">
            <IconClose width={14} height={14} />
          </button>
        </div>

        <dl className="kv">
          <dt>编号</dt>
          <dd className="mono">{id}</dd>
          <dt>分辨率</dt>
          <dd>
            {detail?.width && detail?.height
              ? `${detail.width} × ${detail.height} · ${megapixels(detail.width, detail.height)}`
              : '—'}
          </dd>
          <dt>文件大小</dt>
          <dd>{formatBytes(detail?.fileBytes ?? detail?.bytes)}</dd>
          <dt>格式</dt>
          <dd>{detail?.ext?.toUpperCase() ?? '—'}</dd>
          <dt>分类</dt>
          <dd>{[detail?.plate, detail?.word].filter(Boolean).join(' / ') || '—'}</dd>
          <dt>发布时间</dt>
          <dd>{formatDateTime(detail?.publishedAt)}</dd>
          <dt>浏览量</dt>
          <dd>{detail?.views ?? 0}</dd>
          <dt>上传者</dt>
          <dd>
            {uploaderLabel.href ? (
              <a onClick={() => void api.openExternal(uploaderLabel.href as string)}>{uploaderLabel.text}</a>
            ) : (
              uploaderLabel.text
            )}
          </dd>
          {detail?.pixivId && (
            <>
              <dt>Pixiv</dt>
              <dd>
                <a onClick={() => void api.openExternal(`https://www.pixiv.net/artworks/${detail.pixivId}`)}>
                  {detail.pixivId}
                </a>
              </dd>
            </>
          )}
          {detail?.relPath && (
            <>
              <dt>本地路径</dt>
              <dd className="mono" style={{ fontSize: 11 }}>
                {detail.relPath}
              </dd>
            </>
          )}
        </dl>

        <div className="lb-actions" data-component="Lightbox/Actions">
          <button className="btn sm" onClick={() => void toggleFavorite()}>
            <IconStar
              width={13}
              height={13}
              style={{ color: detail?.favorite ? 'var(--danger)' : undefined }}
            />
            {detail?.favorite ? '已收藏' : '收藏'}
          </button>
          <button
            className="btn sm"
            disabled={!detail?.relPath}
            onClick={async () => {
              const ok = await api.library.reveal(id)
              if (!ok) onToast('本地文件不存在')
            }}
          >
            <IconFolder width={13} height={13} />
            打开位置
          </button>
          <button
            className="btn sm"
            disabled={detail?.fileStatus === 'ready'}
            onClick={async () => {
              try {
                await api.crawl.downloadItems([id])
                onToast('已加入下载队列')
              } catch (err) {
                onToast(err instanceof Error ? err.message : '启动下载失败')
              }
            }}
          >
            <IconDownload width={13} height={13} />
            下载此图
          </button>
          <button className="btn sm" onClick={() => void api.openExternal(detail?.detailUrl ?? '')}>
            <IconExternal width={13} height={13} />
            原始页面
          </button>
          <button
            className="btn sm danger"
            onClick={async () => {
              await api.library.remove([id], true)
              onChanged(id, { fileStatus: 'none', thumbUrl: null, imageUrl: null })
              setDetail((d) => (d ? { ...d, fileStatus: 'none', imageUrl: null, thumbUrl: null, relPath: null } : d))
              onToast('已删除本地文件与索引')
            }}
          >
            <IconTrash width={13} height={13} />
            删除
          </button>
        </div>

        <div className="row" style={{ gap: 6, marginBottom: 8 }} data-component="Lightbox/Zoom">
          <button
            className="btn icon sm"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}
            disabled={zoom <= MIN_ZOOM + 0.001}
            title="缩小 (-)"
          >
            <IconZoomOut width={14} height={14} />
          </button>
          <input
            className="zoom-slider"
            type="range"
            min={MIN_ZOOM}
            max={3}
            step={0.01}
            value={Math.min(3, zoom)}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="缩放"
          />
          <button
            className="btn icon sm"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
            disabled={zoom >= MAX_ZOOM - 0.001}
            title="放大 (+)"
          >
            <IconZoomIn width={14} height={14} />
          </button>
          <span className="mono muted" style={{ width: 44, textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="btn sm ghost"
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
          >
            重置
          </button>
        </div>

        <p className="lb-tip">滚轮缩放 · 左键拖动 · ← → 翻页 · Esc 关闭</p>

        {detail && detail.tags.length > 0 && (
          <>
            <div className="side-title" style={{ padding: '0 0 8px' }}>
              标签
            </div>
            <div className="lb-tags">
              {detail.tags.map((tag) => (
                <button key={tag} onClick={() => onToggleTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </>
        )}

        {strip.length > 1 && (
          <>
            <div className="side-title" style={{ padding: '0 0 8px' }}>
              当前列表
            </div>
            <div className="lb-strip">
              {strip.map((item) => (
                <button
                  key={item.id}
                  className={item.id === id ? 'active' : ''}
                  onClick={() => onSelect(item.id)}
                  title={item.title}
                >
                  {item.thumbUrl ? <img src={item.thumbUrl} alt="" loading="lazy" /> : null}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

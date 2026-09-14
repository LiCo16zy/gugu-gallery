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
  const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

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
      else if (event.key === '+' || event.key === '=') setZoom((z) => Math.min(6, z * 1.25))
      else if (event.key === '-') setZoom((z) => Math.max(1, z / 1.25))
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

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setZoom((z) => Math.min(6, Math.max(1, z * (event.deltaY < 0 ? 1.12 : 0.9))))
  }, [])

  const strip = useMemo(() => {
    const from = Math.max(0, index - 12)
    return items.slice(from, from + 25)
  }, [items, index])

  const summary = items.find((i) => i.id === id) ?? null

  return (
    <div className="lightbox" onWheel={onWheel}>
      <div
        className="lightbox-stage"
        onMouseDown={(e) => {
          if (zoom <= 1) return
          dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
        }}
        onMouseMove={(e) => {
          const d = dragging.current
          if (!d) return
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) })
        }}
        onMouseUp={() => {
          dragging.current = null
        }}
        onMouseLeave={() => {
          dragging.current = null
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {detail?.imageUrl ? (
          <img
            src={detail.imageUrl}
            alt={detail.title}
            className={zoom > 1 ? 'zoomed' : ''}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            onClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
            draggable={false}
          />
        ) : (
          <div className="empty" style={{ color: 'rgba(255,255,255,0.5)' }}>
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

      <div className="lightbox-side">
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
          <dd>{detail?.uploader ?? '—'}</dd>
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
          {detail?.pixivArtistUrl && (
            <>
              <dt>画师</dt>
              <dd>
                <a onClick={() => void api.openExternal(detail.pixivArtistUrl!)}>
                  {detail.pixivArtistUrl.replace('https://www.pixiv.net/users/', 'users/')}
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

        <div className="lb-actions">
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

        <div className="row" style={{ gap: 6, marginBottom: 16 }}>
          <button className="btn icon sm" onClick={() => setZoom((z) => Math.max(1, z / 1.25))} title="缩小 (-)">
            <IconZoomOut width={14} height={14} />
          </button>
          <span className="mono muted" style={{ width: 46, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn icon sm" onClick={() => setZoom((z) => Math.min(6, z * 1.25))} title="放大 (+)">
            <IconZoomIn width={14} height={14} />
          </button>
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

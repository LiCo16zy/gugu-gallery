import { useEffect, useRef, useState } from 'react'
import type { ItemSummary } from '@shared/types'
import { formatBytes } from '../api'
import { IconStar, IconImage } from './Icons'

interface Props {
  items: ItemSummary[]
  loading: boolean
  cardMin: string
  emptyHint: string
  onOpen: (id: number) => void
  onQuickFavorite: (item: ItemSummary) => void
}

export default function GalleryGrid({
  items,
  loading,
  cardMin,
  emptyHint,
  onOpen,
  onQuickFavorite
}: Props): JSX.Element {
  if (!loading && items.length === 0) {
    return (
      <div className="empty" data-component="GalleryGrid/Empty">
        <IconImage width={34} height={34} />
        <h3>这里还没有内容</h3>
        <p>{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="grid" data-component="GalleryGrid" style={{ ['--card-min' as string]: cardMin }}>
      {items.map((item) => (
        <Card key={item.id} item={item} onOpen={onOpen} onQuickFavorite={onQuickFavorite} />
      ))}
      {loading && <SkeletonCards />}
    </div>
  )
}

/**
 * 站点给的 title 是「2160x3456 1.69M [匿名-分享]」这种说明文字，直接当标题毫无辨识度，
 * 所以卡片主标题用标签，副标题放尺寸 / 体积 / Pixiv ID。
 */
function displayTitle(item: ItemSummary): string {
  if (item.tags.length > 0) return item.tags.slice(0, 2).join(' · ')
  if (item.word) return item.word
  return `#${item.id}`
}

function displayMeta(item: ItemSummary): string {
  const parts: string[] = []
  if (item.width && item.height) parts.push(`${item.width}×${item.height}`)
  const size = item.fileBytes ?? item.bytes
  if (size) parts.push(formatBytes(size))
  if (item.pixivId) parts.push(`pid ${item.pixivId}`)
  return parts.join(' · ') || '—'
}

function SkeletonCards(): JSX.Element {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`sk-${i}`} className="card" style={{ pointerEvents: 'none' }}>
          <div className="card-media placeholder">
            <div className="card-skeleton" />
          </div>
        </div>
      ))}
    </>
  )
}

function Card({
  item,
  onOpen,
  onQuickFavorite
}: {
  item: ItemSummary
  onOpen: (id: number) => void
  onQuickFavorite: (item: ItemSummary) => void
}): JSX.Element {  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // 缓存命中时 onLoad 可能在挂载前就触发，这里补一次检查
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  const ratio = item.width && item.height ? item.width / item.height : 0.75
  const isTall = ratio < 0.66

  return (
    <div className="card" data-component="GalleryGrid/Card" onClick={() => onOpen(item.id)} title={item.title}>
      <div className="card-media" style={!loaded ? { aspectRatio: String(ratio || 0.75) } : undefined}>
        {item.thumbUrl && !failed ? (
          <img
            ref={imgRef}
            src={item.thumbUrl}
            alt={item.title}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{ opacity: loaded ? 1 : 0 }}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : null}
        {!loaded && !failed && <div className="card-skeleton" />}
        {failed && (
          <div
            style={{
              aspectRatio: String(ratio || 0.75),
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-faint)'
            }}
          >
            <IconImage width={26} height={26} />
          </div>
        )}

        <div className="card-badges">
          {item.fileStatus !== 'ready' && <span className="badge">仅索引</span>}
          {isTall && item.width != null && <span className="badge">竖图</span>}
          {item.favorite && (
            <span className="badge fav" style={{ marginLeft: 'auto' }}>
              <IconStar width={10} height={10} />
            </span>
          )}
        </div>

        <div className="card-overlay">
          <div className="dim">
            {item.width && item.height ? `${item.width}×${item.height}` : '尺寸未知'}
            <span>·</span>
            {formatBytes(item.fileBytes ?? item.bytes)}
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="card-title">{displayTitle(item)}</div>
        <div className="card-tags">{displayMeta(item)}</div>
      </div>

      <button
        className="btn icon sm ghost"
        style={{ position: 'absolute', right: 6, bottom: 40, opacity: item.favorite ? 1 : 0 }}
        onClick={(e) => {
          e.stopPropagation()
          onQuickFavorite(item)
        }}
        title={item.favorite ? '取消收藏' : '收藏'}
      >
        <IconStar width={13} height={13} style={{ color: item.favorite ? 'var(--danger)' : undefined }} />
      </button>
    </div>
  )
}

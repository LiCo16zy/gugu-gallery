import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ItemSummary } from '@shared/types'
import { formatDate } from '../api'
import { IconHeart, IconImage } from './Icons'

/** 行高粒度：网格用 4px 的隐式行做像素级定位，卡片之间靠 GAP 撑开 */
const ROW = 4
/** 卡片间距 */
const GAP = 14
/** 卡片正文固定高度，瀑布流计算依赖它是个常数 */
const BODY_H = 50
/**
 * 单栏最小宽度。这两个数是「反推」出来的：
 * 常见的 1080~1300px 内容区里，250 刚好排出 4 栏，166 排出 6 栏。
 */
const MIN_CARD_NORMAL = 250
const MIN_CARD_DENSE = 160
/** 宽高比超过这个值就占两栏 */
const SPAN2_RATIO = 1.5

interface Props {
  items: ItemSummary[]
  loading: boolean
  dense: boolean
  emptyHint: string
  onOpen: (id: number) => void
  onQuickFavorite: (item: ItemSummary) => void
  onContextMenu: (item: ItemSummary, x: number, y: number) => void
}

interface Placement {
  col: number
  /** 占几栏（横图为 2） */
  span: number
  /** 1 起 */
  rowStart: number
  rowSpan: number
  width: number
  imgHeight: number
}

export default function GalleryGrid({
  items,
  loading,
  dense,
  emptyHint,
  onOpen,
  onQuickFavorite,
  onContextMenu
}: Props): JSX.Element {
  // 用回调 ref 而不是 useRef：首次渲染时数据还没到，走的是空状态分支，
  // 网格元素根本不存在；等它挂载出来必须重新绑定观察器，否则宽度永远是 0。
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!gridEl) return
    // 必须减掉左右内边距：clientWidth 含 padding，拿它当可用宽度的话，
    // 算出来的列宽总和会比内容盒宽出 2×padding，页面就出现横向滚动条了
    const update = (): void => {
      const style = getComputedStyle(gridEl)
      const usable =
        gridEl.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
      setWidth(Math.max(0, Math.floor(usable)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(gridEl)
    return () => observer.disconnect()
  }, [gridEl])

  const { placements, columns, colWidth } = useMasonry(items, width, dense ? MIN_CARD_DENSE : MIN_CARD_NORMAL)

  if (!loading && items.length === 0) {
    return (
      <div className="empty" data-component="GalleryGrid/Empty">
        <IconImage width={34} height={34} />
        <h3>这里还没有内容</h3>
        <p>{emptyHint}</p>
      </div>
    )
  }

  // 列模板必须显式给出：留空的话会退回 CSS 里的 auto-fill，列数与计算值不一致，
  // 最后一列宽度会莫名其妙地缩水。
  const gridStyle: React.CSSProperties = {
    gridAutoRows: ROW + 'px',
    gridTemplateColumns: 'repeat(' + columns + ', ' + colWidth + 'px)',
    columnGap: GAP + 'px',
    rowGap: 0
  }

  return (
    <div ref={setGridEl} className="grid" data-component="GalleryGrid" data-columns={columns} style={gridStyle}>
      {items.map((item) => (
        <Card
          key={item.id}
          item={item}
          placement={placements.get(item.id)}
          onOpen={onOpen}
          onQuickFavorite={onQuickFavorite}
          onContextMenu={onContextMenu}
        />
      ))}
      {loading && <SkeletonCards />}
    </div>
  )
}

/**
 * 瀑布流布局计算。
 *
 * 做法：CSS Grid + 极小的隐式行（4px），给每张卡显式指定 grid-row / grid-column。
 * 这样既保住了正常文档流（懒加载、无障碍、content-visibility 都还能用），
 * 又能让不同高度的卡片严丝合缝地错落堆叠 —— 每张卡的底部就是同列下一张卡的顶部。
 *
 * 横图（宽高比达到 SPAN2_RATIO）占两栏，因此每张卡还要在可放置的相邻列组合里，
 * 挑当前最矮的那一组。
 */
function useMasonry(
  items: ItemSummary[],
  width: number,
  minCard: number
): { placements: Map<number, Placement>; columns: number; colWidth: number } {
  return useMemo(() => {
    const placements = new Map<number, Placement>()
    if (width <= 0) return { placements, columns: 1, colWidth: 0 }

    const columns = Math.max(2, Math.min(8, Math.floor((width + GAP) / (minCard + GAP))))
    const colWidth = Math.floor(((width - GAP * (columns - 1)) / columns) * 100) / 100
    const colRows: number[] = []
    for (let i = 0; i < columns; i += 1) colRows.push(0)

    for (const item of items) {
      const ratio = item.width && item.height ? item.width / item.height : 0.75
      const span = ratio >= SPAN2_RATIO && columns >= 2 ? 2 : 1
      const cardWidth = Math.round(colWidth * span + GAP * (span - 1))
      const imgHeight = Math.round(cardWidth / ratio)
      const rowSpan = Math.ceil((imgHeight + BODY_H + GAP) / ROW)

      let bestCol = 0
      let bestTop = Number.POSITIVE_INFINITY
      for (let c = 0; c + span <= columns; c += 1) {
        let top = 0
        for (let k = 0; k < span; k += 1) top = Math.max(top, colRows[c + k])
        if (top < bestTop) {
          bestTop = top
          bestCol = c
        }
      }

      placements.set(item.id, {
        col: bestCol,
        span,
        rowStart: bestTop + 1,
        rowSpan,
        width: cardWidth,
        imgHeight
      })

      const next = bestTop + rowSpan
      for (let k = 0; k < span; k += 1) colRows[bestCol + k] = next
    }

    return { placements, columns, colWidth }
  }, [items, width, minCard])
}

function displayTitle(item: ItemSummary): string {
  if (item.tags.length > 0) return item.tags.slice(0, 2).join(' · ')
  if (item.word) return item.word
  return '#' + item.id
}

/** 卡片副标题：只要 pid 和浏览量（分辨率与体积挪到悬停暗角里） */
function displayMeta(item: ItemSummary): string {
  const parts: string[] = []
  if (item.pixivId) parts.push('pid ' + item.pixivId)
  if (item.views != null) parts.push(item.views + ' 浏览')
  return parts.join(' · ') || '—'
}

function SkeletonCards(): JSX.Element {
  const skeletons: JSX.Element[] = []
  for (let i = 0; i < 8; i += 1) {
    skeletons.push(
      <div
        key={'sk-' + i}
        className="card"
        style={{ gridColumn: 'span 1', gridRow: 'span 60', pointerEvents: 'none' }}
      >
        <div className="card-media placeholder">
          <div className="card-skeleton" />
        </div>
      </div>
    )
  }
  return <>{skeletons}</>
}

function Card({
  item,
  placement,
  onOpen,
  onQuickFavorite,
  onContextMenu
}: {
  item: ItemSummary
  placement?: Placement
  onOpen: (id: number) => void
  onQuickFavorite: (item: ItemSummary) => void
  onContextMenu: (item: ItemSummary, x: number, y: number) => void
}): JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }, [])

  const ratio = item.width && item.height ? item.width / item.height : 0.75
  const imgHeight = placement?.imgHeight ?? 260
  const geometry: React.CSSProperties | undefined = placement
    ? {
        gridColumn: placement.col + 1 + ' / span ' + placement.span,
        gridRow: placement.rowStart + ' / span ' + placement.rowSpan
      }
    : undefined

  return (
    <div
      className="card"
      data-component="GalleryGrid/Card"
      style={geometry}
      onClick={() => onOpen(item.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(item, e.clientX, e.clientY)
      }}
    >
      <div className="card-media" style={{ height: imgHeight }}>
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
          <div className="card-media-fallback">
            <IconImage width={26} height={26} />
          </div>
        )}

        <div className="card-badges">
          {item.fileStatus !== 'ready' && <span className="badge">仅索引</span>}
          {item.width != null && ratio >= SPAN2_RATIO && <span className="badge">横图</span>}
        </div>

        <div className="card-overlay">
          <div className="dim">
            {item.width && item.height ? item.width + '×' + item.height : '尺寸未知'}
            <span>·</span>
            {formatDate(item.publishedAt)}
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="card-title">{displayTitle(item)}</div>
        <div className="card-tags">{displayMeta(item)}</div>
      </div>

      {/* 收藏：鼠标移入卡片才显示按钮；已收藏的爱心在鼠标移开后依然保留 */}
      <button
        className={'card-fav' + (item.favorite ? ' on' : '')}
        onClick={(e) => {
          e.stopPropagation()
          onQuickFavorite(item)
        }}
        title={item.favorite ? '取消收藏' : '收藏'}
        aria-label={item.favorite ? '取消收藏' : '收藏'}
      >
        <IconHeart width={15} height={15} filled={item.favorite} />
      </button>
    </div>
  )
}

import { useState } from 'react'
import type { Facet, LibraryStats, PlateFacet } from '@shared/types'
import { formatBytes } from '../api'
import type { Filters, View } from '../App'
import { IconFolder, IconImage, IconRadar, IconStar, IconDownload } from './Icons'

interface Props {
  collapsed: boolean
  stats: LibraryStats | null
  plates: PlateFacet[]
  topTags: Facet[]
  filters: Filters
  view: View
  jobActive: boolean
  onNavigateGallery: () => void
  onNavigateCrawl: () => void
  onFilters: (patch: Partial<Filters>) => void
  onToggleTag: (tag: string) => void
}

export default function Sidebar({
  collapsed,
  stats,
  plates,
  topTags,
  filters,
  view,
  jobActive,
  onNavigateGallery,
  onNavigateCrawl,
  onFilters,
  onToggleTag
}: Props): JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [tagsOpen, setTagsOpen] = useState(true)

  const isLibraryAll =
    view === 'gallery' && !filters.favorite && filters.downloaded === 'any' && !filters.plate && filters.tags.length === 0

  const go = (fn: () => void): void => {
    onNavigateGallery()
    fn()
  }

  return (
    <aside className="sidebar">
      <div className="side-section">
        <div className="side-title">{!collapsed && <span>资料库</span>}</div>
        <button className={`side-item${isLibraryAll ? ' active' : ''}`} onClick={() => go(() => onFilters({ favorite: false, downloaded: 'any', plate: null, word: null, tags: [] }))} title="全部图片">
          <IconImage />
          {!collapsed && <span className="label">全部图片</span>}
          {!collapsed && <span className="count">{stats?.items ?? 0}</span>}
        </button>
        <button
          className={`side-item${view === 'gallery' && filters.favorite ? ' active' : ''}`}
          onClick={() => go(() => onFilters({ favorite: true }))}
          title="我的收藏"
        >
          <IconStar />
          {!collapsed && <span className="label">我的收藏</span>}
          {!collapsed && <span className="count">{stats?.favorites ?? 0}</span>}
        </button>
        <button
          className={`side-item${view === 'gallery' && filters.downloaded === 'only' ? ' active' : ''}`}
          onClick={() => go(() => onFilters({ favorite: false, downloaded: 'only' }))}
          title="已下载到本地"
        >
          <IconDownload />
          {!collapsed && <span className="label">已下载</span>}
          {!collapsed && <span className="count">{stats?.downloaded ?? 0}</span>}
        </button>
        <button
          className={`side-item${view === 'gallery' && filters.downloaded === 'never' ? ' active' : ''}`}
          onClick={() => go(() => onFilters({ favorite: false, downloaded: 'never' }))}
          title="仅索引、尚未下载"
        >
          <IconFolder />
          {!collapsed && <span className="label">待下载</span>}
          {!collapsed && (
            <span className="count">{(stats?.items ?? 0) - (stats?.downloaded ?? 0)}</span>
          )}
        </button>
        <button
          className={`side-item${view === 'crawl' ? ' active' : ''}`}
          onClick={onNavigateCrawl}
          title="抓取任务"
        >
          <IconRadar />
          {!collapsed && <span className="label">抓取任务</span>}
          {!collapsed && jobActive && <span className="dot running" />}
        </button>
      </div>

      {!collapsed && plates.length > 0 && (
        <div className="side-section">
          <div className="side-title">
            <span>分类</span>
            <button className="collapse-all" onClick={() => setExpanded(null)}>
              收起
            </button>
          </div>
          {plates.map((plate) => {
            const open = expanded === plate.name
            const activePlate = filters.plate === plate.name && !filters.word
            return (
              <div key={plate.name}>
                <button
                  className={`side-item${activePlate ? ' active' : ''}`}
                  onClick={() => {
                    setExpanded(open ? null : plate.name)
                    go(() => onFilters({ plate: plate.name, word: null }))
                  }}
                >
                  <IconFolder />
                  <span className="label">{plate.name}</span>
                  <span className="count">{plate.count}</span>
                </button>
                {open &&
                  plate.words.map((word) => (
                    <button
                      key={word.name}
                      className={`side-item sub${
                        filters.plate === plate.name && filters.word === word.name ? ' active' : ''
                      }`}
                      onClick={() => go(() => onFilters({ plate: plate.name, word: word.name }))}
                    >
                      <span className="label">{word.name}</span>
                      <span className="count">{word.count}</span>
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {!collapsed && topTags.length > 0 && (
        <div className="side-section">
          <div className="side-title">
            <span>热门标签</span>
            <button className="collapse-all" onClick={() => setTagsOpen((v) => !v)}>
              {tagsOpen ? '收起' : '展开'}
            </button>
          </div>
          {tagsOpen && (
            <div className="tag-cloud">
              {topTags.slice(0, 28).map((tag) => (
                <button
                  key={tag.name}
                  className={`tag-chip${filters.tags.includes(tag.name) ? ' active' : ''}`}
                  onClick={() => {
                    onNavigateGallery()
                    onToggleTag(tag.name)
                  }}
                  title={`${tag.name} · ${tag.count} 张`}
                >
                  {tag.name}
                  <span className="n">{tag.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!collapsed && stats && (
        <div className="side-section">
          <div className="side-title">
            <span>占用</span>
          </div>
          <div style={{ padding: '0 9px', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.9 }}>
            <div>原图 {formatBytes(stats.totalBytes)}</div>
            <div>索引 {formatBytes(stats.dbBytes)}</div>
          </div>
        </div>
      )}
    </aside>
  )
}

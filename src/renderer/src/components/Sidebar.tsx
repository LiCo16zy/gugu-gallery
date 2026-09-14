import { useState } from 'react'
import type { Facet, LibraryStats, PlateFacet } from '@shared/types'
import { formatBytes } from '../api'
import type { Filters, View } from '../App'
import { IconFolder, IconHeart, IconImage, IconRadar, IconInfo, IconSettings, IconDownload } from './Icons'

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
  onOpenSettings: () => void
  onOpenHelp: () => void
  onFilters: (patch: Partial<Filters>) => void
  onToggleTag: (tag: string) => void
}

/** 单个数字或单个字母不足以构成有效标签，直接不展示 */
const isWeakTag = (name: string): boolean => /^[0-9A-Za-z]$/.test(name)

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
  onOpenSettings,
  onOpenHelp,
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

  const visibleTags = topTags.filter((t) => !isWeakTag(t.name)).slice(0, 28)

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} data-component="Sidebar">
      <div className="sidebar-scroll">
        <div className="side-section">
          <div className="side-title">{!collapsed && <span>资料库</span>}</div>
          <button
            data-component="Sidebar/Item"
            className={`side-item${isLibraryAll ? ' active' : ''}`}
            onClick={() => go(() => onFilters({ favorite: false, downloaded: 'any', plate: null, word: null, tags: [] }))}
            title="全部图片"
          >
            <IconImage />
            {!collapsed && <span className="label">全部图片</span>}
            {!collapsed && <span className="count">{stats?.items ?? 0}</span>}
          </button>
          <button
            data-component="Sidebar/Item"
            className={`side-item${view === 'gallery' && filters.favorite ? ' active' : ''}`}
            onClick={() => go(() => onFilters({ favorite: true }))}
            title="我的收藏"
          >
            <IconHeart />
            {!collapsed && <span className="label">我的收藏</span>}
            {!collapsed && <span className="count">{stats?.favorites ?? 0}</span>}
          </button>
          <button
            data-component="Sidebar/Item"
            className={`side-item${view === 'gallery' && filters.downloaded === 'only' ? ' active' : ''}`}
            onClick={() => go(() => onFilters({ favorite: false, downloaded: 'only' }))}
            title="已下载到本地"
          >
            <IconDownload />
            {!collapsed && <span className="label">已下载</span>}
            {!collapsed && <span className="count">{stats?.downloaded ?? 0}</span>}
          </button>
          <button
            data-component="Sidebar/Item"
            className={`side-item${view === 'gallery' && filters.downloaded === 'never' ? ' active' : ''}`}
            onClick={() => go(() => onFilters({ favorite: false, downloaded: 'never' }))}
            title="仅索引、尚未下载"
          >
            <IconFolder />
            {!collapsed && <span className="label">待下载</span>}
            {!collapsed && <span className="count">{(stats?.items ?? 0) - (stats?.downloaded ?? 0)}</span>}
          </button>
          <button
            data-component="Sidebar/Item"
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
            {/* 分类不再需要「全部收起」按钮，展开状态挂在每个一级分类自己身上 */}
            <div className="side-title">
              <span>分类</span>
            </div>
            {plates.map((plate) => {
              const open = expanded === plate.name
              const activePlate = filters.plate === plate.name && !filters.word
              return (
                <div key={plate.name}>
                  <button
                    data-component="Sidebar/Plate"
                    className={`side-item${activePlate ? ' active' : ''}`}
                    onClick={() => {
                      setExpanded(open ? null : plate.name)
                      go(() => onFilters({ plate: plate.name, word: null }))
                    }}
                    aria-expanded={open}
                  >
                    <Caret open={open} />
                    <span className="label">{plate.name}</span>
                    <span className="count">{plate.count}</span>
                  </button>
                  <div className={`side-collapsible${open ? ' open' : ''}`}>
                    {plate.words.map((word) => (
                      <button
                        data-component="Sidebar/Word"
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
                </div>
              )
            })}
          </div>
        )}

        {!collapsed && visibleTags.length > 0 && (
          <div className="side-section">
            <div className="side-title">
              <button
                className="side-toggle"
                onClick={() => setTagsOpen((v) => !v)}
                aria-expanded={tagsOpen}
                title={tagsOpen ? '收起标签' : '展开标签'}
              >
                <span>热门标签</span>
                <Caret open={tagsOpen} />
              </button>
            </div>
            <div className={`side-collapsible${tagsOpen ? ' open' : ''}`}>
              <div className="tag-cloud" data-component="Sidebar/TagCloud">
                {visibleTags.map((tag) => (
                  <button
                    key={tag.name}
                    data-component="Sidebar/TagChip"
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
            </div>
          </div>
        )}

        {!collapsed && stats && (
          <div className="side-section">
            <div className="side-title">
              <span>应用与存储</span>
            </div>
            <div className="side-stats">
              <div>原图 {formatBytes(stats.totalBytes)}</div>
              <div>索引 {formatBytes(stats.dbBytes)}</div>
            </div>
          </div>
        )}
      </div>

      {/* 帮助与设置沉到侧栏最底部 */}
      <div className="sidebar-foot">
        <button className="side-item" onClick={onOpenHelp} title="帮助">
          <IconInfo />
          {!collapsed && <span className="label">帮助</span>}
        </button>
        <button className="side-item" onClick={onOpenSettings} title="设置">
          <IconSettings />
          {!collapsed && <span className="label">设置</span>}
        </button>
      </div>
    </aside>
  )
}

/** 三角形的两条边：展开时指向下，收起时指向左 */
function Caret({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      className={`caret${open ? ' open' : ''}`}
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10l5 5 5-5" />
    </svg>
  )
}

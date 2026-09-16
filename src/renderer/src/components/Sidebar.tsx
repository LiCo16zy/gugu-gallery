import { useState } from 'react'
import type { Facet, LibraryStats } from '@shared/types'
import { formatBytes } from '../api'
import type { Filters, View } from '../App'
import { IconFolder, IconHeart, IconImage, IconRadar, IconInfo, IconSettings, IconDownload } from './Icons'

interface Props {
  collapsed: boolean
  stats: LibraryStats | null
  /** 摊平后的分类（名字 + 数据库里的 word + 条目数） */
  categories: { id: string; name: string; word: string; kind: 'category' | 'search'; count: number }[]
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
  categories,
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
            onClick={() =>
              go(() => onFilters({ favorite: false, downloaded: 'any', plate: null, word: null, targetWord: null, tags: [] }))
            }
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

        {!collapsed && categories.length > 0 && (
          <div className="side-section">
            {/*
              分类只有一层：站点原来是「ACG图片 > Pixiv萌图」，
              但真正有价值的就那几栏，摊平之后界面更短，也不用先展开再点。
            */}
            <div className="side-title">
              <span>分类</span>
            </div>
            {categories.map((category) => {
              // 搜索类目标在站点侧没有分类，筛选走「来源分类」而不是 word
              const search = category.kind === 'search'
              const on = search
                ? filters.targetWord === category.word
                : filters.word === category.word && !filters.plate
              return (
                <button
                  key={category.id}
                  data-component="Sidebar/Category"
                  className={`side-item${on ? ' active' : ''}`}
                  onClick={() =>
                    go(() =>
                      onFilters(
                        search
                          ? { plate: null, word: null, targetWord: category.word }
                          : { plate: null, word: category.word, targetWord: null }
                      )
                    )
                  }
                >
                  <IconFolder />
                  <span className="label">{category.name}</span>
                  <span className="count">{category.count}</span>
                </button>
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

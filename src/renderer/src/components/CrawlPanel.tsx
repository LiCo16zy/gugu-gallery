import { useEffect, useMemo, useState } from 'react'
import type { CrawlLogLine, CrawlProgress, CrawlRequest, TargetInput } from '@shared/types'
import { visibleCategories } from '@shared/categories'
import type { AppSettings } from '@shared/types'
import { api, formatBytes, formatDuration, formatSpeed } from '../api'
import type { CrawlSiteInfo } from '../api'
import { IconPause, IconPlay, IconRadar, IconRefresh, IconStop, IconTrash } from './Icons'
interface Props {
  settings: AppSettings
  progress: CrawlProgress | null
  logs: CrawlLogLine[]
  onClearLogs: () => void
  onFinished: () => Promise<void> | void
  onToast: (message: string) => void
}
export default function CrawlPanel({
  settings,
  progress,
  logs,
  onClearLogs,
  onFinished,
  onToast
}: Props): JSX.Element {
  const [site, setSite] = useState<CrawlSiteInfo | null>(null)
  const [siteError, setSiteError] = useState<string | null>(null)
  const [loadingSite, setLoadingSite] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageFrom, setPageFrom] = useState(1)
  const [pageTo, setPageTo] = useState<string>('')
  const [maxItems, setMaxItems] = useState<string>('')
  const [indexOnly, setIndexOnly] = useState(false)
  const [enrich, setEnrich] = useState(true)
  const [skipExisting, setSkipExisting] = useState(true)
  const [includeTags, setIncludeTags] = useState('')
  const [excludeTags, setExcludeTags] = useState('')
  const [minWidth, setMinWidth] = useState(0)
  const [minBytesKb, setMinBytesKb] = useState(0)
  const [listConcurrency, setListConcurrency] = useState(settings.listConcurrency)
  const [downloadConcurrency, setDownloadConcurrency] = useState(settings.downloadConcurrency)
  const [delayMs, setDelayMs] = useState(settings.delayMs)
  const [retries, setRetries] = useState(settings.retries)
  const [resumeFromMarks, setResumeFromMarks] = useState(false)
  const [starting, setStarting] = useState(false)
  /** 当前首个目标的规模，用于给「结束页」之类的输入一个参照 */
  const [pageInfo, setPageInfo] = useState<{ totalPages: number | null; totalItems: number | null } | null>(null)
  useEffect(() => {
    setListConcurrency(settings.listConcurrency)
    setDownloadConcurrency(settings.downloadConcurrency)
    setDelayMs(settings.delayMs)
    setRetries(settings.retries)
  }, [settings])
  const loadSite = async (): Promise<void> => {
    setLoadingSite(true)
    setSiteError(null)
    try {
      const info = await api.crawl.siteInfo()
      setSite(info)
      if (selected.size === 0) {
        const firstCategory = visibleCategories(false)[0]
        if (firstCategory) setSelected(new Set([firstCategory.id]))
      }
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : '读取站点导航失败')
    } finally {
      setLoadingSite(false)
    }
  }
  useEffect(() => {
    void loadSite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 目标直接来自应用分类表，不再从站点导航推导 ——
  // 既不会再被导航里的「示例模板」污染，也不需要先展开一级分类
  const targets: TargetInput[] = useMemo(
    () =>
      visibleCategories(false)
        .filter((c) => selected.has(c.id))
        .map((c) => ({ kind: 'category' as const, plate: c.plate, word: c.word })),
    [selected]
  )
  const firstTargetKey =
    targets.length > 0 ? [targets[0].kind, targets[0].plate, targets[0].word].join('|') : ''
  /** 目标一变就顺手问一次规模，界面上的「约 N 页」就是从这里来的 */
  useEffect(() => {
    if (!firstTargetKey) {
      setPageInfo(null)
      return
    }
    let alive = true
    void api.crawl
      .targetInfo(targets[0])
      .then((info) => {
        if (alive) setPageInfo(info)
      })
      .catch(() => {
        if (alive) setPageInfo(null)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstTargetKey])
  const active = progress != null && !['done', 'cancelled', 'failed'].includes(progress.phase)
  const start = async (): Promise<void> => {
    if (targets.length === 0) {
      onToast('请至少选择一个抓取目标')
      return
    }
    setStarting(true)
    try {
      const request: CrawlRequest = {
        targets,
        pageFrom: Math.max(1, pageFrom),
        pageTo: pageTo.trim() === '' ? null : Math.max(1, Number(pageTo)),
        maxItems: maxItems.trim() === '' ? null : Math.max(1, Number(maxItems)),
        indexOnly,
        download: !indexOnly,
        enrich,
        skipExisting,
        listConcurrency,
        downloadConcurrency,
        delayMs,
        retries,
        includeTags: splitTags(includeTags),
        excludeTags: splitTags(excludeTags),
        resumeFromMarks,
        minWidth: Math.max(0, minWidth),
        minBytes: Math.max(0, minBytesKb) * 1024
      }
      await api.crawl.start(request)
      onToast('抓取任务已启动')
    } catch (err) {
      onToast(err instanceof Error ? err.message : '启动失败')
    } finally {
      setStarting(false)
    }
  }
  const percent = useMemo(() => {
    if (!progress) return 0
    if (progress.downloadTotal && progress.downloadTotal > 0) {
      return Math.min(100, (progress.downloaded / progress.downloadTotal) * 100)
    }
    if (progress.pagesTotal) {
      return Math.min(100, (progress.pagesDone / progress.pagesTotal) * 100)
    }
    return 0
  }, [progress])
  return (
    <div className="page" data-component="CrawlPanel">
      <div className="page-head">
        <h2>抓取任务</h2>
        <p>
          先把分类列表页抓成索引（快、几乎不耗流量），再按条件下载原图。站点接口不稳定，内置了自动重试与完整性校验；
          建议保持 2–3 的并发与 200ms 以上的间隔，既能跑满带宽也不至于被封。
        </p>
      </div>
      {/* ------------------------------------------------------------ 目标 */}
      <section className="card-panel">
        <div className="panel-title">
          <IconRadar width={14} height={14} />
          抓取目标
          <span className="hint">
            已选 {targets.length} 个
            {site ? ` · 站点分类读取于 ${new Date(site.fetchedAt).toLocaleTimeString()}` : ''}
            {pageInfo?.totalPages ? ` · 当前目标共 ${pageInfo.totalPages} 页` : ''}
          </span>
          <div className="spacer" />
          <button className="btn sm ghost" onClick={() => void loadSite()} disabled={loadingSite || active}>
            <IconRefresh width={13} height={13} />
            {loadingSite ? '读取中…' : '重新读取分类'}
          </button>
        </div>
        {siteError && (
          <p className="dim" style={{ marginBottom: 10 }}>
            读取站点分类失败：{siteError}（可以稍后重试，不影响已保存的抓取源）
          </p>
        )}
        {/* 分类只有一层：站点原本是 ACG图片 > Pixiv萌图，这里只留下面那层 */}
        <div className="target-list">
          {visibleCategories(false).map((category) => {
            const on = selected.has(category.id)
            return (
              <button
                key={category.id}
                className={'target-card' + (on ? ' on' : '')}
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (next.has(category.id)) next.delete(category.id)
                    else next.add(category.id)
                    return next
                  })
                }
                aria-pressed={on}
              >
                <span className="target-name">{category.name}</span>
                <span className="target-path">{category.plate} / {category.word}</span>
              </button>
            )
          })}
        </div>
      </section>
      {/* ------------------------------------------------------------ 范围 */}
      <section className="card-panel">
        <div className="panel-title">抓取范围与内容过滤</div>
        <div className="field-grid">
          <div className="field">
            <label>起始页</label>
            <input type="number" min={1} value={pageFrom} onChange={(e) => setPageFrom(Number(e.target.value))} />
            <span className="help">每页 10 条</span>
          </div>
          <div className="field">
            <label>结束页</label>
            <input
              type="number"
              min={1}
              placeholder="留空 = 一直翻到没有内容"
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value)}
            />
            <span className="help">
              {pageInfo?.totalPages
                ? `当前目标共 ${pageInfo.totalPages} 页${pageInfo.totalItems ? ` · ${pageInfo.totalItems} 条` : ''}`
                : '每页 10 条'}
            </span>
          </div>
          <div className="field">
            <label>最多处理条目</label>
            <input
              type="number"
              min={1}
              placeholder="留空 = 不限制"
              value={maxItems}
              onChange={(e) => setMaxItems(e.target.value)}
            />
            <span className="help">你要一次全榨干吗…</span>
          </div>
          <div className="field">
            <label>只保留含这些标签</label>
            <input
              type="text"
              placeholder="碧蓝档案, 女孩子"
              value={includeTags}
              onChange={(e) => setIncludeTags(e.target.value)}
            />
            <span className="help">逗号分隔，任一命中即可</span>
          </div>
          <div className="field">
            <label>排除这些标签</label>
            <input
              type="text"
              placeholder="泳装, 暴露"
              value={excludeTags}
              onChange={(e) => setExcludeTags(e.target.value)}
            />
            <span className="help">逗号分隔</span>
          </div>
          <div className="field">
            <label>最小宽度（像素）</label>
            <input type="number" min={0} value={minWidth} onChange={(e) => setMinWidth(Number(e.target.value))} />
            <span className="help">低于该宽度不下载</span>
          </div>
          <div className="field">
            <label>最小体积（KB）</label>
            <input
              type="number"
              min={0}
              value={minBytesKb}
              onChange={(e) => setMinBytesKb(Number(e.target.value))}
            />
            <span className="help">下载完成后再校验</span>
          </div>
        </div>
        <div className="sep" />
        <div className="row wrap" style={{ gap: 20 }}>
          <label className="switch">
            <input type="checkbox" checked={indexOnly} onChange={(e) => setIndexOnly(e.target.checked)} />
            <span className="track" />
            只建立索引，不下载图片
          </label>
          <label className="switch">
            <input type="checkbox" checked={enrich} onChange={(e) => setEnrich(e.target.checked)} disabled={indexOnly} />
            <span className="track" />
            下载前补全详情（Pixiv ID / 画师 / 完整标签）
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              disabled={indexOnly}
            />
            <span className="track" />
            跳过已下载的图片
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={resumeFromMarks}
              onChange={(e) => setResumeFromMarks(e.target.checked)}
            />
            <span className="track" />
            跳过已索引过的页（断点续爬）
          </label>
        </div>
      </section>
      {/* ---------------------------------------------------------- 限速 */}
      <section className="card-panel">
        <div className="panel-title">
          并发与限速
          <span className="hint">调高会更快，但也更容易被站点掐断</span>
        </div>
        <div className="field-grid">
          <div className="field">
            <label>列表页并发</label>
            <input
              type="number"
              min={1}
              max={8}
              value={listConcurrency}
              onChange={(e) => setListConcurrency(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>下载并发</label>
            <input
              type="number"
              min={1}
              max={8}
              value={downloadConcurrency}
              onChange={(e) => setDownloadConcurrency(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>请求间隔（毫秒）</label>
            <input type="number" min={0} max={5000} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>失败重试次数</label>
            <input type="number" min={0} max={10} value={retries} onChange={(e) => setRetries(Number(e.target.value))} />
          </div>
        </div>
      </section>
      {/* ---------------------------------------------------------- 控制 */}
      <section className="card-panel">
        <div className="row" style={{ gap: 9 }}>
          <button className="btn primary" onClick={() => void start()} disabled={active || starting}>
            <IconPlay width={13} height={13} />
            {starting ? '启动中…' : indexOnly ? '开始建立索引' : '开始抓取'}
          </button>
          <button
            className="btn"
            onClick={() => void (progress?.phase === 'paused' ? api.crawl.resume() : api.crawl.pause())}
            disabled={!active}
          >
            <IconPause width={13} height={13} />
            {progress?.phase === 'paused' ? '继续' : '暂停'}
          </button>
          <button className="btn danger" onClick={() => void api.crawl.cancel()} disabled={!active}>
            <IconStop width={13} height={13} />
            停止
          </button>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={onClearLogs} disabled={logs.length === 0}>
            <IconTrash width={13} height={13} />
            清空日志
          </button>
        </div>
        {progress && (
          <>
            <div className="sep" />
            <div className="progress-block">
              <div className="progress-row">
                <span className={`dot ${progress.phase}`} />
                <strong style={{ fontSize: 12.5 }}>
                  {phaseLabel(progress.phase)}
                  {progress.currentLabel ? ` · ${progress.currentLabel}` : ''}
                </strong>
                <div className={`bar${progress.downloadTotal == null && progress.phase === 'indexing' ? ' indeterminate' : ''}`}>
                  <i style={{ width: `${percent}%` }} />
                </div>
                <span className="mono muted">{percent.toFixed(1)}%</span>
              </div>
              <div className="stat-grid">
                <Stat k="索引页数" v={`${progress.pagesDone}${progress.pagesTotal ? ` / ${progress.pagesTotal}` : ''}`} />
                <Stat k="发现条目" v={progress.itemsFound.toLocaleString()} />
                <Stat k="新增条目" v={progress.itemsNew.toLocaleString()} />
                <Stat
                  k="下载进度"
                  v={progress.downloadTotal != null ? `${progress.downloaded} / ${progress.downloadTotal}` : '—'}
                />
                <Stat k="已下载体积" v={formatBytes(progress.bytesDownloaded)} />
                <Stat k="速度" v={formatSpeed(progress.speedBps)} />
                <Stat k="预计剩余" v={formatDuration(progress.etaSeconds)} />
                <Stat k="跳过 / 失败" v={`${progress.skipped} / ${progress.failed}`} />
              </div>
            </div>
          </>
        )}
      </section>
      {/* ---------------------------------------------------------- 日志 */}
      {logs.length > 0 && (
        <section className="card-panel">
          <div className="panel-title">
            运行日志
            <span className="hint">最近 {logs.length} 条</span>
            <div className="spacer" />
            <button
              className="btn sm ghost"
              onClick={() => void onFinished()}
              title="刷新图库统计"
            >
              <IconRefresh width={13} height={13} />
              刷新图库
            </button>
          </div>
          <div className="logs">
            {logs.slice(-220).map((line, i) => (
              <div className="row" key={`${line.at}-${i}`}>
                <span className="t">{new Date(line.at).toLocaleTimeString()}</span>
                <span className={line.level}>{line.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
function Stat({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  )
}
function phaseLabel(phase: CrawlProgress['phase']): string {
  switch (phase) {
    case 'queued':
      return '排队中'
    case 'indexing':
      return '正在建立索引'
    case 'downloading':
      return '正在下载原图'
    case 'paused':
      return '已暂停'
    case 'done':
      return '任务完成'
    case 'cancelled':
      return '已取消'
    case 'failed':
      return '任务失败'
    default:
      return phase
  }
}
function splitTags(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

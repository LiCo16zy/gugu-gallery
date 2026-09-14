import type { AppInfo, AppSettings, LibraryStats } from '@shared/types'
import { api, formatBytes } from '../api'
import { IconFolder, IconRefresh } from './Icons'

interface Props {
  settings: AppSettings
  info: AppInfo | null
  stats: LibraryStats | null
  onChange: (patch: Partial<AppSettings>) => Promise<void>
  onToast: (message: string) => void
}

const ACCENTS = ['#7c9cff', '#b98cff', '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#fb7185']

export default function SettingsPanel({ settings, info, stats, onChange, onToast }: Props): JSX.Element {
  return (
    <div className="page" data-component="SettingsPanel">
      <div className="page-head">
        <h2>设置</h2>
        <p>抓取与图库的全局参数。改动即时生效，无需重启。</p>
      </div>

      <section className="card-panel">
        <div className="panel-title">
          <IconFolder width={14} height={14} />
          图库位置
        </div>
        <div className="row" style={{ gap: 9, marginBottom: 10 }}>
          <span className="path-chip">{settings.libraryRoot || '（未设置）'}</span>
          <button
            className="btn"
            onClick={async () => {
              const picked = await api.library.pickRoot()
              if (picked) {
                await onChange({ libraryRoot: picked })
                onToast('图库目录已切换')
              }
            }}
            disabled={info === null && settings.libraryRoot === ''}
          >
            更换目录
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11.5 }}>
          原图保存在 <span className="mono">originals/&lt;分类&gt;/</span> 下，缩略图在{' '}
          <span className="mono">thumbs/</span>，索引是 <span className="mono">index.db</span>。
          整个目录可以随意拷贝或备份，脱离本应用也能直接翻图。
        </p>
        {stats && (
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat">
              <div className="k">条目</div>
              <div className="v">{stats.items.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="k">已下载</div>
              <div className="v">{stats.downloaded.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="k">收藏</div>
              <div className="v">{stats.favorites.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="k">原图占用</div>
              <div className="v">{formatBytes(stats.totalBytes)}</div>
            </div>
            <div className="stat">
              <div className="k">索引大小</div>
              <div className="v">{formatBytes(stats.dbBytes)}</div>
            </div>
          </div>
        )}
      </section>

      <section className="card-panel">
        <div className="panel-title">下载行为</div>
        <div className="field-grid">
          <div className="field">
            <label>下载哪个版本</label>
            <select
              value={settings.preferOriginal ? 'original' : 'preview'}
              onChange={(e) => void onChange({ preferOriginal: e.target.value === 'original' })}
            >
              <option value="original">原图（download?dw=true，无损）</option>
              <option value="preview">压缩预览图（体积约 1/5）</option>
            </select>
            <span className="help">原图体积通常是预览图的 5 倍左右</span>
          </div>
          <div className="field">
            <label>文件命名方式</label>
            <select
              value={settings.naming}
              onChange={(e) => void onChange({ naming: e.target.value as AppSettings['naming'] })}
            >
              <option value="id-slug">编号_标签（推荐）</option>
              <option value="id">仅编号</option>
              <option value="pixiv">Pixiv ID</option>
              <option value="hash">内容哈希</option>
            </select>
          </div>
          <div className="field">
            <label>缩略图最长边（像素）</label>
            <input
              type="number"
              min={128}
              max={1024}
              step={64}
              value={settings.thumbSize}
              onChange={(e) => void onChange({ thumbSize: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>每页加载数量</label>
            <input
              type="number"
              min={20}
              max={200}
              value={settings.pageSize}
              onChange={(e) => void onChange({ pageSize: Number(e.target.value) })}
            />
            <span className="help">滚动到底自动加载下一页</span>
          </div>
        </div>
      </section>

      <section className="card-panel">
        <div className="panel-title">网络与限速</div>
        <div className="field-grid">
          <div className="field">
            <label>列表页并发</label>
            <input
              type="number"
              min={1}
              max={8}
              value={settings.listConcurrency}
              onChange={(e) => void onChange({ listConcurrency: Number(e.target.value) })}
            />
            <span className="help">建议 2，实测站点对并发很敏感</span>
          </div>
          <div className="field">
            <label>下载并发</label>
            <input
              type="number"
              min={1}
              max={8}
              value={settings.downloadConcurrency}
              onChange={(e) => void onChange({ downloadConcurrency: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>请求间隔（毫秒）</label>
            <input
              type="number"
              min={0}
              max={5000}
              value={settings.delayMs}
              onChange={(e) => void onChange({ delayMs: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>失败重试次数</label>
            <input
              type="number"
              min={0}
              max={10}
              value={settings.retries}
              onChange={(e) => void onChange({ retries: Number(e.target.value) })}
            />
            <span className="help">站点约 25% 请求会被截断，务必保留重试</span>
          </div>
          <div className="field">
            <label>代理地址</label>
            <input
              type="text"
              placeholder="http://127.0.0.1:7890"
              value={settings.proxy}
              onChange={(e) => void onChange({ proxy: e.target.value })}
            />
            <span className="help">留空表示直连；填了会走 Chromium 网络栈（支持 PAC / 系统代理）</span>
          </div>
        </div>
      </section>

      <section className="card-panel">
        <div className="panel-title">外观</div>
        <div className="row wrap" style={{ gap: 24 }}>
          <div className="seg">
            <button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => void onChange({ theme: 'dark' })}>
              深色
            </button>
            <button
              className={settings.theme === 'light' ? 'active' : ''}
              onClick={() => void onChange({ theme: 'light' })}
            >
              浅色
            </button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="dim">主题色</span>
            {ACCENTS.map((color) => (
              <button
                key={color}
                onClick={() => void onChange({ accent: color })}
                title={color}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  background: color,
                  border: settings.accent === color ? '2px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="card-panel">
        <div className="panel-title">
          关于
          <div className="spacer" />
          <button className="btn sm ghost" onClick={() => window.location.reload()}>
            <IconRefresh width={13} height={13} />
            重新加载界面
          </button>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: '96px 1fr' }}>
          <dt>应用版本</dt>
          <dd className="mono">{info?.version ?? '—'}</dd>
          <dt>Electron</dt>
          <dd className="mono">{info?.electron ?? '—'}</dd>
          <dt>Chromium</dt>
          <dd className="mono">{info?.chrome ?? '—'}</dd>
          <dt>Node</dt>
          <dd className="mono">{info?.node ?? '—'}</dd>
          <dt>索引文件</dt>
          <dd className="mono">{info?.dbPath ?? '—'}</dd>
          <dt>数据来源</dt>
          <dd>
            <a onClick={() => void api.openExternal('https://www.guguxz.com/')}>www.guguxz.com</a>
            <span className="muted"> · 抓取内容版权归原作者所有，仅供个人离线浏览</span>
          </dd>
        </dl>
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api'
import { IconFolder } from './Icons'

interface Props {
  /** 建议位置：安装版是安装目录下的子文件夹 */
  suggested: string
  appVersion: string
  /** 是否安装版：决定要不要提示「卸载会删掉图库」 */
  packaged: boolean
  onConfirm: (dir: string) => Promise<void>
}

/**
 * 首次启动向导：让用户在图库落地之前先决定它放在哪。
 *
 * 之所以放在应用里而不是安装程序里 —— 安装程序跑在管理员上下文，
 * 而且那时用户还没见过软件长什么样；放在首次启动更自然，也能顺便解释目录用途。
 */
export default function SetupWizard({ suggested, appVersion, packaged, onConfirm }: Props): JSX.Element {
  const [dir, setDir] = useState(suggested)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDir(suggested)
  }, [suggested])

  const inInstallDir = packaged && suggested !== '' && dir.trim() === suggested

  const confirm = async (): Promise<void> => {
    const target = dir.trim()
    if (!target) {
      setError('请先选择图库目录')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onConfirm(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup-mask" data-component="App/SetupWizard">
      <div className="setup-card">
        <div className="setup-brand">
          <div className="brand-mark static">咕</div>
          <div>
            <h2>欢迎使用咕咕图库</h2>
            <p className="muted">首次启动，先决定图片存在哪里</p>
          </div>
        </div>

        <div className="setup-body">
          <p>
            图库里会保存<strong>抓取到的原图</strong>、<strong>缩略图</strong>和<strong>索引数据库</strong>。
            整个目录是自包含的，随时可以拷走备份，脱离本应用也能直接翻图。
          </p>

          <label className="setup-label">图库目录</label>
          <div className="setup-path">
            <input
              type="text"
              value={dir}
              spellCheck={false}
              onChange={(e) => setDir(e.target.value)}
              placeholder="选择一个存图片的文件夹"
            />
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                const picked = await api.library.chooseDir(dir || suggested)
                if (picked) setDir(picked)
              }}
            >
              <IconFolder width={14} height={14} />
              浏览
            </button>
          </div>

          {inInstallDir ? (
            <p className="setup-warn">
              默认放在安装目录下。注意：<strong>卸载本应用时这个目录会被一起删除</strong>，
              重要图片建议改到「图片」目录。
            </p>
          ) : (
            <p className="setup-hint">
              已改到安装目录之外，卸载应用不会影响这里的图片。
            </p>
          )}

          {error && <p className="setup-error">{error}</p>}
        </div>

        <div className="setup-foot">
          <span className="muted">版本 {appVersion}</span>
          <button className="btn primary" disabled={busy} onClick={() => void confirm()}>
            {busy ? '正在准备…' : '开始使用'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 咕咕小站（guguxz.com）站点适配层：常量、URL 规则、路径编解码。
 *
 * 站点结构（2026-09 实测）：
 *   首页        /                                        ?page=N
 *   分类列表    /search/index/plate/{一级}/wd/{二级}.html    ?page=N
 *   关键词搜索  /search/index/wd/{关键词}.html              ?page=N
 *   月排行      /ranking/image/plate/{一级}/wd/排行/nav/month.html
 *   随机图      /archives/image/plate/{一级}/wd/{二级}/rand/yes.html
 *   详情页      /archives/image/plate/{一级}/wd/{二级}/id/{id}.html
 *
 * 图片本体不直接暴露：
 *   预览（压缩） https://www.guguxz.com/index/imageBed?item=<base64(相对路径)>
 *   原图        https://www.guguxz.com/index/imageBed?item=<相对路径>&dw=true
 * 两个入口都会 302 到 CDN（total.wdbed.vip），并且**必须带 Referer**，否则 403。
 */

export const SITE_ORIGIN = 'https://www.guguxz.com'
export const SITE_REFERER = 'https://www.guguxz.com/'
export const CDN_HOST = 'total.wdbed.vip'

/** 未登录访客的通用 UA，保持和浏览器一致可降低被风控概率 */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

export type SiteTargetKind = 'home' | 'category' | 'search' | 'ranking' | 'custom'

export interface SiteTarget {
  kind: SiteTargetKind
  plate?: string | null
  word?: string | null
  url?: string | null
}

const enc = encodeURIComponent

/** 构造某个目标在第 page 页的列表 URL（page 从 1 开始，第 1 页可省略 query） */
export function listUrl(target: SiteTarget, page: number): string {
  const q = page > 1 ? `?page=${page}` : ''
  switch (target.kind) {
    case 'home':
      return `${SITE_ORIGIN}/${q}`
    case 'category':
      if (!target.plate || !target.word) throw new Error('category 目标需要 plate 和 word')
      return `${SITE_ORIGIN}/search/index/plate/${enc(target.plate)}/wd/${enc(target.word)}.html${q}`
    case 'search':
      if (!target.word) throw new Error('search 目标需要 word')
      return `${SITE_ORIGIN}/search/index/wd/${enc(target.word)}.html${q}`
    case 'ranking':
      if (!target.plate) throw new Error('ranking 目标需要 plate')
      return `${SITE_ORIGIN}/ranking/image/plate/${enc(target.plate)}/wd/${enc(target.word ?? '排行')}/nav/month.html${q}`
    case 'custom':
      if (!target.url) throw new Error('custom 目标需要 url')
      return withPage(target.url, page)
    default:
      throw new Error(`未知目标类型: ${String(target.kind)}`)
  }
}

function withPage(url: string, page: number): string {
  const u = new URL(url, SITE_ORIGIN)
  if (page > 1) u.searchParams.set('page', String(page))
  else u.searchParams.delete('page')
  return u.toString()
}

/** 目标的可读标题 */
export function targetTitle(target: SiteTarget): string {
  switch (target.kind) {
    case 'home':
      return '首页最新'
    case 'category':
      return `${target.plate ?? ''} · ${target.word ?? ''}`.trim()
    case 'search':
      return `搜索 · ${target.word ?? ''}`
    case 'ranking':
      return `${target.plate ?? ''} · ${target.word ?? '排行'} 月排行`
    case 'custom':
      return target.url ?? '自定义地址'
  }
}

/** 由相对路径（d/y/orig/xxxx/item/<md5>.<ext>）生成原图下载 URL */
export function originalUrl(remotePath: string): string {
  return `${SITE_ORIGIN}/index/imageBed?item=${remotePath}&dw=true`
}

/** 由相对路径生成预览（压缩）图 URL */
export function previewUrl(remotePath: string): string {
  return `${SITE_ORIGIN}/index/imageBed?item=${encodeBase64(remotePath)}`
}

export function encodeBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

/**
 * 解开列表页 <img src=".../imageBed?item=XXX"> 里的相对路径。
 * 站点对 item 参数做的是「相对路径的 base64」，偶有 padding 被吞掉的情况，这里补齐。
 */
export function decodeItemParam(param: string): string | null {
  let s = param.trim()
  if (!s) return null
  // 有些位置站点直接给明文路径
  if (/^[A-Za-z0-9_\-./]+$/.test(s) && s.includes('/')) return s
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad === 1) return null
  if (pad) s += '='.repeat(4 - pad)
  try {
    const decoded = Buffer.from(s, 'base64').toString('utf8')
    // 必须长得像路径，否则视为解码失败
    return /^[\w./\-]+$/.test(decoded) && decoded.includes('/') ? decoded : null
  } catch {
    return null
  }
}

/** 从相对路径里取扩展名（站点 URL 的扩展名经常与实际格式不符，仅供参考） */
export function pathExt(remotePath: string): string {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(remotePath)
  return m ? m[1].toLowerCase() : 'jpg'
}

/** 把「1.69M」「222.38K」「13.64M」这类站点标注换算成字节 */
export function parseHumanSize(text: string): number | null {
  const m = /^\s*([\d.]+)\s*([KMG]?)\s*B?\s*$/i.exec(text)
  if (!m) return null
  const value = Number.parseFloat(m[1])
  if (!Number.isFinite(value)) return null
  const unit = m[2].toUpperCase()
  const factor = unit === 'K' ? 1024 : unit === 'M' ? 1024 ** 2 : unit === 'G' ? 1024 ** 3 : 1
  return Math.round(value * factor)
}

/** 首页导航里硬编码的默认目标（离线也能用） */
export const DEFAULT_TARGETS: SiteTarget[] = [
  { kind: 'category', plate: 'ACG图片', word: 'Pixiv萌图' },
  { kind: 'category', plate: 'ACG图片', word: '电脑壁纸' },
  { kind: 'category', plate: 'ACG图片', word: '手机壁纸' },
  { kind: 'ranking', plate: 'ACG图片', word: '排行' }
]

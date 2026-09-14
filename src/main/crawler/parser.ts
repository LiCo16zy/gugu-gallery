/**
 * 列表页 / 详情页 HTML -> 结构化数据的纯函数解析层。
 * 不依赖任何 DOM 库，便于单元测试（见 tests/parser.test.ts）。
 */
import { decodeItemParam, parseHumanSize, pathExt, SITE_ORIGIN } from './site'

export interface RawListItem {
  id: number
  detailUrl: string
  /** 原图相对路径，如 d/y/orig/acbab8/item/<md5>.png */
  remotePath: string | null
  title: string
  width: number | null
  height: number | null
  bytes: number | null
  uploader: string | null
  tags: string[]
  publishedAt: string | null
  plate: string | null
  word: string | null
  views: number | null
}

export interface RawNavPlate {
  name: string
  words: string[]
}

export interface RawDetail {
  id: number | null
  title: string
  width: number | null
  height: number | null
  bytes: number | null
  uploader: string | null
  views: number | null
  likes: number | null
  collects: number | null
  publishedAt: string | null
  categories: string[]
  tags: string[]
  pixivId: string | null
  pixivArtistUrl: string | null
  /** 详情页里的原图相对路径（可能来自 dw 链接） */
  remotePath: string | null
}

/* ------------------------------------------------------------------ 工具 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#34': '"'
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const n = Number.parseInt(code.slice(2), 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    if (code.startsWith('#')) {
      const n = Number.parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code] ?? whole
  })
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html)
  return m ? m[1] : null
}

function toInt(text: string | null | undefined): number | null {
  if (text == null) return null
  const m = /-?\d+/.exec(text.replace(/[,，\s]/g, ''))
  if (!m) return null
  const n = Number.parseInt(m[0], 10)
  return Number.isFinite(n) ? n : null
}

/** 从 `<h2>2160x3456 1.69M [匿名-分享]</h2>` 里拆出尺寸/大小/上传者 */
export function parseCaption(caption: string): {
  width: number | null
  height: number | null
  bytes: number | null
  uploader: string | null
} {
  const text = stripTags(caption)
  const dim = /(\d{2,5})\s*[x×*]\s*(\d{2,5})/.exec(text)
  const size = /(\d[\d.]*\s*[KMG]?B?)\s*(?=\s|\[|$)/i.exec(text.slice(dim ? dim.index + dim[0].length : 0))
  let bytes = size ? parseHumanSize(size[1].replace(/\s+/g, '')) : null
  if (bytes === 0) bytes = null
  const bracket = /\[([^\]]+)\]/.exec(text)
  return {
    width: dim ? Number.parseInt(dim[1], 10) : null,
    height: dim ? Number.parseInt(dim[2], 10) : null,
    bytes,
    uploader: bracket ? bracket[1].trim() : null
  }
}

/** 解析列表页底部「共<b>1430</b>页<b>14294</b>条数据」 */
export function parsePagination(html: string): { totalPages: number | null; totalItems: number | null } {
  const block = firstMatch(html, /<p class='pageRemark'[^>]*>([\s\S]*?)<\/p>/)
  const scope = block ?? html
  const pages = /共\s*<b>\s*(\d+)\s*<\/b>\s*页/.exec(scope)
  const items = /<\/b>\s*页\s*<b>\s*(\d+)\s*<\/b>\s*条/.exec(scope)
  return {
    totalPages: pages ? Number.parseInt(pages[1], 10) : null,
    totalItems: items ? Number.parseInt(items[1], 10) : null
  }
}

/* -------------------------------------------------------------- 导航分类 */

/**
 * 导航里的「示例模板」占位名。
 *
 * 站点在 <nav> 里留了一段注释掉的格式说明：
 *   <a class="nav_one">...一级分类名</a>
 *   <a href=".../plate/一级分类名/wd/二级分类名1.html">二级分类名1</a>
 * 注释里同样有大段**真实**分类（例如搞笑图片，URL 至今可用）需要采集，
 * 所以不能简单跳过注释，而要把这段模板单独识别出来丢掉 ——
 * 否则它会变成列表里的第一个分类，抓取时默认就选中一个不存在的目标。
 */
function isTemplatePlaceholder(name: string): boolean {
  return name.includes('分类名')
}

/**
 * 解析顶部导航，得到「一级分类 -> 二级分类」树。
 * 导航里有大段被注释掉的分类（例如搞笑图片），它们对应的 URL 依然可用，因此一并采集。
 */
export function parseNav(html: string): RawNavPlate[] {
  const navStart = html.indexOf('<nav>')
  const navEnd = html.indexOf('</nav>')
  if (navStart < 0 || navEnd < 0) return []
  const nav = html.slice(navStart, navEnd)

  const plates: RawNavPlate[] = []
  const plateRe = /(?:<a class="nav_one"[^>]*>\s*<p>[\s\S]*?<\/p>\s*<\/a>|<a[^>]*href="([^"]*\/search\/index\/wd\/[^"]+\.html)"[^>]*>\s*<p>[\s\S]*?<\/p>\s*<\/a>)([\s\S]*?)(?=<a class="nav_one"|<a[^>]*href="https:\/\/www\.guguxz\.com\/(?:pixiv|bilibili)|<div><\/div>|<\/nav>)/g

  let m: RegExpExecArray | null
  while ((m = plateRe.exec(nav))) {
    const source = m[0]
    // 一级分类名：从 <p> 的 span 之后的文本里取
    const nameHtml = firstMatch(source, /<\/span>([\s\S]*?)<\/p>/)
    const name = nameHtml ? stripTags(nameHtml) : ''
    if (!name || name.length > 20) continue
    if (isTemplatePlaceholder(name)) continue

    // 二级分类：优先看 nav_two 区块里的链接，没有则退化为整个片段里的链接
    const sectionStart = source.indexOf('nav_two')
    const scope = sectionStart >= 0 ? source.slice(source.indexOf('>', sectionStart) + 1) : source
    const words: string[] = []
    const linkRe = /href="[^"]*\/wd\/([^"/]+)\.html"/g
    let lm: RegExpExecArray | null
    while ((lm = linkRe.exec(scope))) {
      const w = decodeURIComponent(lm[1])
      if (w && w !== '排行' && !isTemplatePlaceholder(w) && !words.includes(w)) words.push(w)
    }
    const existing = plates.find((p) => p.name === name)
    if (existing) {
      for (const w of words) if (!existing.words.includes(w)) existing.words.push(w)
    } else {
      plates.push({ name, words })
    }
  }
  return plates
}

/* ---------------------------------------------------------------- 列表页 */

const LIST_ANCHOR_RE = /<a\s[^>]*href="([^"]*?\/id\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g

/** 解析列表页中的所有条目卡片 */
export function parseListItems(html: string): RawListItem[] {
  const out: RawListItem[] = []
  const seen = new Set<number>()
  LIST_ANCHOR_RE.lastIndex = 0

  let m: RegExpExecArray | null
  while ((m = LIST_ANCHOR_RE.exec(html))) {
    const [, href, idText, block] = m
    const id = Number.parseInt(idText, 10)
    if (!Number.isFinite(id) || seen.has(id)) continue
    // 只认真正的封面卡片
    if (!block.includes('article_cover_list')) continue
    seen.add(id)

    const caption = firstMatch(block, /<h2>([\s\S]*?)<\/h2>/) ?? ''
    const meta = parseCaption(caption)
    const tagsHtml = firstMatch(block, /<div class="content">[\s\S]*?<p>([\s\S]*?)<\/p>/) ?? firstMatch(block, /<p>([\s\S]*?)<\/p>/) ?? ''
    const tags = [...tagsHtml.matchAll(/\[([^\]]+)\]/g)].map((t) => decodeEntities(t[1]).trim()).filter(Boolean)
    const dateText = stripTags(firstMatch(block, /<span>([\s\S]*?)<\/span>/) ?? '')
    const emText = stripTags(firstMatch(block, /<em>([\s\S]*?)<\/em>/) ?? '')

    const publishedAt = /(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)/.exec(dateText)?.[1] ?? null
    const views = /(\d+)\s*浏览/.exec(emText)?.[1]

    const categories = emText.replace(/\s*\d+\s*浏览.*$/, '').trim().split(/\s+/).filter(Boolean)

    out.push({
      id,
      detailUrl: new URL(decodeEntities(href), SITE_ORIGIN).toString(),
      remotePath: extractRemotePath(block),
      title: stripTags(caption),
      width: meta.width,
      height: meta.height,
      bytes: meta.bytes,
      uploader: meta.uploader,
      tags,
      publishedAt,
      plate: categories[0] ?? null,
      word: categories[1] ?? null,
      views: views ? Number.parseInt(views, 10) : null
    })
  }
  return out
}

/**
 * 从卡片片段里挖出原图相对路径。
 * 优先级：<!--tc/?item=路径--> 注释 > imageBed?item=<base64>
 */
function extractRemotePath(block: string): string | null {
  const comment = /<!--[^>]*?files\.guguxz\.com\/[^?]*\?item=([^\s"'<&]+)/.exec(block)
  if (comment) {
    const p = decodeItemParam(decodeEntities(comment[1]))
    if (p) return p
  }
  const img = /imageBed\?item=([A-Za-z0-9+/=_\-]+)/.exec(block)
  if (img) {
    const p = decodeItemParam(img[1])
    if (p) return p
  }
  // 兜底：直接出现明文路径
  const plain = /item=(d\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]{2,5})/.exec(block)
  return plain ? plain[1] : null
}

/* ---------------------------------------------------------------- 详情页 */

/** 解析详情页，补齐列表页拿不到的字段（Pixiv id、画师、点赞等） */
export function parseDetail(html: string, fallbackId?: number): RawDetail {
  const body = html

  const idFromDom = toInt(firstMatch(body, /<div id="archive_id">\s*(\d+)\s*<\/div>/))
  const title = stripTags(firstMatch(body, /<div class="article_div2">\s*<h2>([\s\S]*?)<\/h2>/) ?? '')
  const caption = parseCaption(title)

  const widthDirect = toInt(firstMatch(body, /图片分辨率：\s*(\d+)\s*[x×]/))
  const heightDirect = toInt(firstMatch(body, /图片分辨率：\s*\d+\s*[x×]\s*(\d+)/))
  const sizeText = firstMatch(body, /图片大小：\s*([\d.]+\s*[KMG]?B?)/i)
  const uploader = firstMatch(body, /发布者：\s*([^<\n]+)/)

  const likesBlock = /点赞<\/span>\s*\+\s*<em>\s*(\d+)\s*<\/em>/.exec(body)
  const collectBlock = /收藏<\/span>\s*\+\s*<em>\s*(\d+)\s*<\/em>/.exec(body)

  const p1Html = firstMatch(body, /<p class="p1">([\s\S]*?)<\/p>/) ?? ''
  const categories = [...p1Html.matchAll(/\/search\/index\/wd\/[^"]*"[^>]*>\s*([^<]+?)\s*</g)].map((x) =>
    decodeEntities(x[1]).trim()
  )
  const publishedAt = /<span>\s*(\d{4}-\d{2}-\d{2})\s*<\/span>/.exec(p1Html)?.[1] ?? null
  const views = toInt(/<span>\s*(\d+)\s*浏览\s*<\/span>/.exec(p1Html)?.[1])

  const emHtml = firstMatch(body, /<em>\s*<!--view-图片属性标签-->([\s\S]*?)<\/em>/) ?? firstMatch(body, /<em>([\s\S]*?)<\/em>\s*<\/div>/) ?? ''
  const tags = [...emHtml.matchAll(/\/search\/index\/wd\/[^"']*["'][^>]*>\s*([^<]+?)\s*</g)].map((x) =>
    decodeEntities(x[1]).trim()
  )

  const pixivId = /Pid=(\d+)/.exec(body)?.[1] ?? null
  const pixivArtistUrl = /https:\/\/www\.pixiv\.net\/users\/(\d+)/.exec(body)?.[1]
    ? `https://www.pixiv.net/users/${/https:\/\/www\.pixiv\.net\/users\/(\d+)/.exec(body)![1]}`
    : null

  // 下载原图按钮：item=<明文相对路径>&dw=true
  const dwPath = /imageBed\?item=(d\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]{2,5})&(?:amp;)?dw=true/.exec(body)?.[1]
  let remotePath = dwPath ? decodeEntities(dwPath) : null
  if (!remotePath) {
    const b64 = /imageBed\?item=([A-Za-z0-9+/=_\-]+)/.exec(body)?.[1]
    remotePath = b64 ? decodeItemParam(b64) : null
  }

  return {
    id: idFromDom ?? fallbackId ?? null,
    title,
    width: widthDirect ?? caption.width,
    height: heightDirect ?? caption.height,
    bytes: sizeText ? parseHumanSize(sizeText.replace(/\s+/g, '')) : caption.bytes,
    uploader: uploader ? decodeEntities(uploader).trim() : caption.uploader,
    views,
    likes: likesBlock ? Number.parseInt(likesBlock[1], 10) : null,
    collects: collectBlock ? Number.parseInt(collectBlock[1], 10) : null,
    publishedAt,
    categories: categories.length ? categories : [],
    tags: [...new Set(tags)],
    pixivId,
    pixivArtistUrl,
    remotePath
  }
}

/** 依据魔数嗅探真实图片格式，站点给的扩展名常常是错的（.png 实际是 JPEG） */
export function sniffImageFormat(buf: Uint8Array): { ext: string; mime: string } | null {
  const b = buf
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: 'gif', mime: 'image/gif' }
  if (b[0] === 0x42 && b[1] === 0x4d) return { ext: 'bmp', mime: 'image/bmp' }
  const ascii = (i: number, s: string): boolean => {
    for (let k = 0; k < s.length; k += 1) if (b[i + k] !== s.charCodeAt(k)) return false
    return true
  }
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { ext: 'webp', mime: 'image/webp' }
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (brand.startsWith('avif') || brand.startsWith('mif1')) return { ext: 'avif', mime: 'image/avif' }
    if (brand.startsWith('heic') || brand.startsWith('heix')) return { ext: 'heic', mime: 'image/heic' }
  }
  return null
}

export { pathExt }

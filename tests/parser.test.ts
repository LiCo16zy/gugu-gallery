import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseCaption,
  parseDetail,
  parseListItems,
  parseNav,
  parsePagination,
  sniffImageFormat
} from '../src/main/crawler/parser'
import { decodeItemParam, listUrl, originalUrl, parseHumanSize, previewUrl } from '../src/main/crawler/site'

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8')

describe('URL 规则', () => {
  it('构造分类列表地址', () => {
    expect(listUrl({ kind: 'category', plate: 'ACG图片', word: 'Pixiv萌图' }, 1)).toBe(
      'https://www.guguxz.com/search/index/plate/ACG%E5%9B%BE%E7%89%87/wd/Pixiv%E8%90%8C%E5%9B%BE.html'
    )
    expect(listUrl({ kind: 'category', plate: 'ACG图片', word: 'Pixiv萌图' }, 3)).toContain('?page=3')
    expect(listUrl({ kind: 'home' }, 2)).toBe('https://www.guguxz.com/?page=2')
    expect(listUrl({ kind: 'search', word: '分享' }, 1)).toContain('/search/index/wd/%E5%88%86%E4%BA%AB.html')
  })

  it('构造图片地址', () => {
    const path = 'd/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png'
    expect(originalUrl(path)).toBe(
      'https://www.guguxz.com/index/imageBed?item=d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png&dw=true'
    )
    expect(previewUrl(path)).toContain('item=ZC95L29yaWcvZjEzZjk0')
  })
})

describe('base64 item 解码', () => {
  it('解开标准 base64', () => {
    expect(
      decodeItemParam('ZC95L29yaWcvZjEzZjk0L2l0ZW0vZDU3OTg2ZjliNWNiNDgxYmQ5Zjk3ZmUwMGI3NGNmNjgucG5n')
    ).toBe('d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png')
  })
  it('接受明文路径', () => {
    expect(decodeItemParam('d/y/orig/acbab8/item/abc.png')).toBe('d/y/orig/acbab8/item/abc.png')
  })
  it('拒绝非法输入', () => {
    expect(decodeItemParam('not base64!!!')).toBeNull()
  })
})

describe('尺寸描述解析', () => {
  it('常规标题', () => {
    expect(parseCaption('2160x3456 1.69M [匿名-分享]')).toEqual({
      width: 2160,
      height: 3456,
      bytes: Math.round(1.69 * 1024 ** 2),
      uploader: '匿名-分享'
    })
  })
  it('KB 级', () => {
    const r = parseCaption('1856x1280 222.38K [匿名-分享]')
    expect(r.bytes).toBe(Math.round(222.38 * 1024))
  })
  it('人类可读大小换算', () => {
    expect(parseHumanSize('1.69M')).toBe(Math.round(1.69 * 1024 ** 2))
    expect(parseHumanSize('222.38K')).toBe(Math.round(222.38 * 1024))
    expect(parseHumanSize('512')).toBe(512)
    expect(parseHumanSize('abc')).toBeNull()
  })
})

describe('列表页解析', () => {
  const html = fixture('list-pixiv.html')

  it('解析出全部 10 个条目且字段完整', () => {
    const items = parseListItems(html)
    expect(items).toHaveLength(10)
    const first = items[0]
    expect(first.id).toBe(19521)
    expect(first.detailUrl).toContain('/id/19521.html')
    expect(first.width).toBe(2160)
    expect(first.height).toBe(1080)
    expect(first.remotePath).toBe('d/y/orig/acbab8/item/0b70bb331c620d066380564c077ed4f5.png')
    expect(first.plate).toBe('ACG图片')
    expect(first.word).toBe('Pixiv萌图')
    expect(first.views).toBe(3)
    expect(first.publishedAt).toBe('2026-09-14 10:00')
    expect(first.tags).toContain('明日方舟')
  })

  it('条目 id 不重复', () => {
    const ids = parseListItems(html).map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('所有条目都有原图路径', () => {
    for (const item of parseListItems(html)) expect(item.remotePath).toBeTruthy()
  })

  it('分页信息', () => {
    expect(parsePagination(html)).toEqual({ totalPages: 1430, totalItems: 14294 })
  })

  it('排行页同样可解析', () => {
    const items = parseListItems(fixture('list-ranking.html'))
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].remotePath).toBeTruthy()
  })

  it('首页同样可解析', () => {
    const items = parseListItems(fixture('home.html'))
    expect(items).toHaveLength(10)
  })

  it('空页返回空数组', () => {
    expect(parseListItems('<html><body>什么都没有</body></html>')).toHaveLength(0)
  })
})

describe('导航解析', () => {
  it('得到一级/二级分类树', () => {
    const plates = parseNav(fixture('home.html'))
    const acg = plates.find((p) => p.name === 'ACG图片')
    expect(acg).toBeTruthy()
    expect(acg!.words).toContain('Pixiv萌图')
    expect(acg!.words).toContain('电脑壁纸')
    // 被注释掉的搞笑图片分类也应被采集到
    expect(plates.some((p) => p.name === '搞笑图片')).toBe(true)
    // 但注释里的「示例模板」必须被丢掉，否则它会变成默认选中的第一个分类
    expect(plates.some((p) => p.name.includes('分类名'))).toBe(false)
    expect(plates.every((p) => p.words.every((w) => !w.includes('分类名')))).toBe(true)
  })
})

describe('详情页解析', () => {
  const detail = parseDetail(fixture('detail-19519.html'), 19519)

  it('基础字段', () => {
    expect(detail.id).toBe(19519)
    expect(detail.width).toBe(2160)
    expect(detail.height).toBe(3456)
    expect(detail.bytes).toBe(Math.round(1.69 * 1024 ** 2))
    expect(detail.uploader).toBe('匿名')
    expect(detail.views).toBe(6)
    expect(detail.publishedAt).toBe('2026-09-14')
  })

  it('标签与分类', () => {
    expect(detail.tags).toEqual(expect.arrayContaining(['碧蓝档案', '女孩子', '海滩']))
    expect(detail.categories).toEqual(expect.arrayContaining(['ACG图片', 'Pixiv萌图']))
  })

  it('pixiv 信息与原图路径', () => {
    expect(detail.pixivId).toBe('115534247')
    expect(detail.pixivArtistUrl).toBe('https://www.pixiv.net/users/50077972')
    expect(detail.remotePath).toBe('d/y/orig/f13f94/item/d57986f9b5cb481bd9f97fe00b74cf68.png')
  })
})

describe('图片格式嗅探', () => {
  it('JPEG', () => {
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({
      ext: 'jpg',
      mime: 'image/jpeg'
    })
  })
  it('PNG', () => {
    expect(sniffImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.ext).toBe('png')
  })
  it('WebP', () => {
    const b = new Uint8Array(12)
    b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
    b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8)
    expect(sniffImageFormat(b)?.ext).toBe('webp')
  })
  it('未知格式返回 null', () => {
    expect(sniffImageFormat(new Uint8Array(12))).toBeNull()
  })
})

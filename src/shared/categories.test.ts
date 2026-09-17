import { describe, expect, it } from 'vitest'
import { APP_CATEGORIES, categoryTagFor, findCategory, toTarget, visibleCategories } from '@shared/categories'

describe('应用分类表', () => {
  it('未登录时看不到需要登录的分类', () => {
    const names = visibleCategories(false).map((c) => c.name)
    expect(names).toEqual(['Pixiv萌图', '电脑壁纸', '手机壁纸'])
    expect(names).not.toContain('泳装分享')
  })

  it('登录后泳装分享才出现', () => {
    const names = visibleCategories(true).map((c) => c.name)
    expect(names).toContain('泳装分享')
  })

  it('不再出现搞笑图片与一级分类前缀', () => {
    const names = APP_CATEGORIES.map((c) => c.name)
    expect(names.some((n) => n.includes('搞笑'))).toBe(false)
    expect(names.some((n) => n.startsWith('ACG图片'))).toBe(false)
  })
})

describe('分类 -> 抓取目标', () => {
  it('两层分类带上 plate', () => {
    const cat = findCategory('电脑壁纸')
    expect(cat).toBeDefined()
    expect(toTarget(cat!)).toEqual({ kind: 'category', plate: 'ACG图片', word: '电脑壁纸' })
  })

  it('泳装分享是关键词搜索，没有 plate', () => {
    const cat = findCategory('泳装分享')
    expect(cat?.kind).toBe('search')
    expect(toTarget(cat!)).toEqual({ kind: 'search', word: '泳装类分享' })
  })
})

describe('抓取时补的应用侧标签', () => {
  it('用显示名而不是站点关键词，和界面上的分类名保持一致', () => {
    expect(categoryTagFor('泳装类分享')).toBe('泳装分享')
    expect(categoryTagFor('Pixiv萌图')).toBe('Pixiv萌图')
  })

  it('认不出来的关键词原样返回', () => {
    expect(categoryTagFor('随便什么')).toBe('随便什么')
  })
})

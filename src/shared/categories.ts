/**
 * 应用一级分类。
 *
 * 站点把内容放在两层里（ACG图片 > Pixiv萌图），但对未登录用户来说
 * 真正有价值的只有 ACG图片 下的少数几栏，所以这里直接摊平成一层：
 * 界面上只出现「Pixiv萌图」这样的名字，不再出现「ACG图片」前缀。
 *
 * plate / word 仍然保留，因为拼站点 URL 时两层都得给。
 * 由此带来的好处是：站点导航里那段被注释掉的「示例模板」
 * 再也不可能混进抓取目标里。
 */
export interface AppCategory {
  id: string
  /** 界面上显示的名字 */
  name: string
  /**
   * 站点目标的类型。
   * 多数分类是「一级分类 / 二级分类」两层路径（category），
   * 但登录后才出现的「泳装类分享」站点是用**关键词搜索**实现的 ——
   * 实测其导航链接就是 /search/index/wd/泳装类分享.html。
   */
  kind: 'category' | 'search'
  /** 站点一级分类；kind = 'search' 时为 null */
  plate: string | null
  /** 站点二级分类 / 搜索关键词（同时是数据库里的 word 字段） */
  word: string
  /** 是否只在登录态下可见 */
  requiresLogin: boolean
}

export const APP_CATEGORIES: AppCategory[] = [
  { id: 'pixiv', name: 'Pixiv萌图', kind: 'category', plate: 'ACG图片', word: 'Pixiv萌图', requiresLogin: false },
  { id: 'pc-wallpaper', name: '电脑壁纸', kind: 'category', plate: 'ACG图片', word: '电脑壁纸', requiresLogin: false },
  { id: 'phone-wallpaper', name: '手机壁纸', kind: 'category', plate: 'ACG图片', word: '手机壁纸', requiresLogin: false },
  // 登录后站点导航里才出现；链接形如 /search/index/wd/泳装类分享.html
  { id: 'swimsuit', name: '泳装分享', kind: 'search', plate: null, word: '泳装类分享', requiresLogin: true }
]

/** 当前可见的分类（泳装分享需要登录） */
export const visibleCategories = (loggedIn: boolean): AppCategory[] =>
  APP_CATEGORIES.filter((c) => !c.requiresLogin || loggedIn)

export const findCategory = (name: string): AppCategory | undefined =>
  APP_CATEGORIES.find((c) => c.name === name)

/** 应用分类 -> 爬虫目标 */
export function toTarget(category: AppCategory): { kind: 'category' | 'search'; plate?: string; word: string } {
  return category.kind === 'category'
    ? { kind: 'category', plate: category.plate ?? undefined, word: category.word }
    : { kind: 'search', word: category.word }
}

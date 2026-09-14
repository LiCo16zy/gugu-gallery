/**
 * 应用一级分类。
 *
 * 站点把内容放在「一级分类 / 二级分类」两层里（ACG图片 > Pixiv萌图），
 * 但对未登录用户来说真正有价值的只有 ACG图片 下的少数几栏，
 * 所以这里直接把它摊平成一层：界面只出现「Pixiv萌图」这样的名字，
 * 不再出现「ACG图片」前缀。
 *
 * plate / word 仍然保留，因为拼站点 URL 时两层都得给。
 * 由此带来的好处是：站点导航里那段被注释掉的「示例模板」
 * 再也不可能混进抓取目标里（上一轮踩过这个坑）。
 */
export interface AppCategory {
  id: string
  /** 界面上显示的名字 */
  name: string
  /** 站点一级分类（仅用于拼 URL） */
  plate: string
  /** 站点二级分类（同时也是数据库里的 word 字段） */
  word: string
  /** 是否只在登录态下可见 */
  requiresLogin: boolean
}

export const APP_CATEGORIES: AppCategory[] = [
  { id: 'pixiv', name: 'Pixiv萌图', plate: 'ACG图片', word: 'Pixiv萌图', requiresLogin: false },
  { id: 'pc-wallpaper', name: '电脑壁纸', plate: 'ACG图片', word: '电脑壁纸', requiresLogin: false },
  { id: 'phone-wallpaper', name: '手机壁纸', plate: 'ACG图片', word: '手机壁纸', requiresLogin: false },
  // 站点在登录后才会出现这一栏，名字以实际页面为准
  { id: 'swimsuit', name: '泳装分享', plate: 'ACG图片', word: '泳装类分享', requiresLogin: true }
]

export const visibleCategories = (loggedIn: boolean): AppCategory[] =>
  APP_CATEGORIES.filter((c) => !c.requiresLogin || loggedIn)

export const findCategory = (name: string): AppCategory | undefined =>
  APP_CATEGORIES.find((c) => c.name === name)

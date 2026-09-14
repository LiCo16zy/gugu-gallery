/**
 * 元素自省：把一个 DOM 元素翻译成一段「可以脱离截图理解」的描述。
 *
 * 之所以这么啰嗦：审阅者标注完只会说「去看 devlog/rounds/xxx」，
 * 执行改动的人（或模型）很可能看不到图，只能靠这些文字 + 截图裁片定位问题。
 * 所以选择器、父级链、组件名、关键样式、对比度都要一并记录下来。
 */
import type { AnnotationRect, AnnotationTarget } from './types'

/** 只挑和视觉/布局判断相关的属性，避免把几百行计算样式灌进去 */
const STYLE_KEYS = [
  'display',
  'position',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'grid-template-columns',
  'width',
  'height',
  'min-width',
  'max-width',
  'padding',
  'margin',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'color',
  'background-color',
  'background-image',
  'border',
  'border-radius',
  'box-shadow',
  'opacity',
  'overflow',
  'text-overflow',
  'white-space',
  'z-index',
  'transition',
  'aspect-ratio',
  'object-fit'
]

const ATTR_KEYS = ['type', 'placeholder', 'title', 'href', 'src', 'value', 'role', 'aria-label', 'disabled']

export function rectOf(el: Element): AnnotationRect {
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

/** 生成一条尽量唯一、又保持可读的 CSS 路径 */
export function cssPath(el: Element, maxDepth = 5): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && parts.length < maxDepth) {
    const tag = current.tagName.toLowerCase()
    if (tag === 'html') {
      parts.unshift('html')
      break
    }
    let part = tag
    // 标注工具自己加的类名不参与定位
    const classes = [...current.classList].filter((c) => !c.startsWith('gugu-anno')).slice(0, 2)
    if (classes.length > 0) part += `.${classes.join('.')}`

    const parent: Element | null = current.parentElement
    if (parent) {
      const sameTag = [...parent.children].filter((c) => c.tagName === current!.tagName)
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`
    }
    parts.unshift(part)
    current = parent
  }
  return parts.join(' > ')
}

/** 父级链，用来快速判断这段 UI 属于哪个区域 */
export function parentChain(el: Element, maxDepth = 5): string[] {
  const chain: string[] = []
  let current = el.parentElement
  while (current && chain.length < maxDepth) {
    const tag = current.tagName.toLowerCase()
    if (tag === 'html') break
    const cls = [...current.classList].filter((c) => !c.startsWith('gugu-anno')).slice(0, 2)
    chain.push(cls.length > 0 ? `${tag}.${cls.join('.')}` : tag)
    current = current.parentElement
  }
  return chain
}

/** 就近取 data-component，方便一步定位到源码文件 */
export function componentOf(el: Element): string | null {
  const owner = el.closest('[data-component]')
  if (!owner) return null
  const name = owner.getAttribute('data-component')
  if (!name) return null
  if (owner === el) return name
  const tag = el.tagName.toLowerCase()
  const cls = [...el.classList].filter((c) => !c.startsWith('gugu-anno'))[0]
  return `${name} › ${cls ? `${tag}.${cls}` : tag}`
}

export function describeElement(el: Element): AnnotationTarget {
  const computed = window.getComputedStyle(el)
  const styles: Record<string, string> = {}
  for (const key of STYLE_KEYS) {
    const value = computed.getPropertyValue(key)
    if (!value) continue
    if (isNeutral(key, value)) continue
    styles[key] = value
  }

  const contrast = contrastOf(computed.color, computed.backgroundColor)
  if (contrast) styles['── 对比度'] = contrast

  const attributes: Record<string, string> = {}
  for (const key of ATTR_KEYS) {
    const value = el.getAttribute(key)
    if (value) attributes[key] = value
  }

  return {
    selector: cssPath(el),
    component: componentOf(el),
    tag: el.tagName.toLowerCase(),
    classes: [...el.classList].filter((c) => !c.startsWith('gugu-anno')).join(' '),
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
    parentChain: parentChain(el),
    styles,
    attributes
  }
}

/** 纯区域标注没有具体元素，给一个基于坐标的占位描述 */
export function describeRegion(rect: AnnotationRect, viewport: { width: number; height: number }): AnnotationTarget {
  const center = document.elementFromPoint(
    Math.min(viewport.width - 1, Math.max(0, rect.x + rect.width / 2)),
    Math.min(viewport.height - 1, Math.max(0, rect.y + rect.height / 2))
  )
  const base: AnnotationTarget = {
    selector: `(区域) x=${Math.round(rect.x)} y=${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(
      rect.height
    )}`,
    component: null,
    tag: '',
    classes: '',
    text: '',
    parentChain: [],
    styles: {},
    attributes: {}
  }
  if (!center) return base
  const info = describeElement(center)
  return {
    ...info,
    selector: `区域中心命中 → ${info.selector}`,
    text: `[区域中心元素] ${info.text}`.slice(0, 400)
  }
}

function isNeutral(key: string, value: string): boolean {
  const neutral: Record<string, string[]> = {
    position: ['static'],
    display: ['block'],
    'background-image': ['none'],
    'box-shadow': ['none'],
    'text-overflow': ['clip'],
    'letter-spacing': ['normal'],
    overflow: ['visible'],
    'aspect-ratio': ['auto'],
    'object-fit': ['fill'],
    opacity: ['1'],
    'z-index': ['auto'],
    transform: ['none'],
    transition: ['all 0s ease 0s', 'none']
  }
  return neutral[key]?.includes(value) ?? false
}

/**
 * 文本与背景的 WCAG 对比度。审阅者要的是「好看」，而好看里最硬的一条指标就是可读性，
 * 所以顺手算出来放进标注里，省得来回问。
 */
function contrastOf(color: string, background: string): string | null {
  const fg = parseColor(color)
  const bg = parseColor(background)
  if (!fg || !bg) return null
  if (fg.a < 0.95 || bg.a < 0.95) return null
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : '不足'
  return `${ratio.toFixed(2)}:1（${grade}）`
}

function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(value)
  if (!m) return null
  return {
    r: Number.parseFloat(m[1]),
    g: Number.parseFloat(m[2]),
    b: Number.parseFloat(m[3]),
    a: m[4] === undefined ? 1 : Number.parseFloat(m[4])
  }
}

function luminance(c: { r: number; g: number; b: number }): number {
  const channel = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

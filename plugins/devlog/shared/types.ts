/**
 * 标注与轮次的领域类型。
 * 放在 devlog 插件里，标注工具通过 @plugins/devlog/shared/types 复用，
 * 与 plugin.json 里 "dependsOn": ["devlog"] 的依赖声明保持一致。
 */

export interface AnnotationRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationTarget {
  selector: string
  component: string | null
  tag: string
  classes: string
  text: string
  parentChain: string[]
  styles: Record<string, string>
  attributes: Record<string, string>
}

export type AnnotationCategory = 'style' | 'layout' | 'content' | 'behavior' | 'bug' | 'other'
export type AnnotationSeverity = 'must' | 'should' | 'nice'

export interface Annotation {
  id: string
  index: number
  comment: string
  category: AnnotationCategory
  severity: AnnotationSeverity
  kind: 'element' | 'region'
  createdAt: number
  /** 记录时的视口坐标，供截图裁切参照 */
  rect: AnnotationRect
  /** 文档坐标：滚动之后靠它把标注钉在原地 */
  pageRect: AnnotationRect
  /** 记录时的滚动偏移 */
  scroll: { x: number; y: number }
  viewport: { width: number; height: number }
  target: AnnotationTarget
}

export interface ExportPayload {
  annotations: Annotation[]
  /** 本轮的整体说明 */
  note: string
  /** 标注时所在的界面 */
  view: string
  devicePixelRatio: number
  appVersion: string
}

export interface RoundInfo {
  id: string
  dir: string
  createdAt: string
  annotationCount: number
  hasScreenshot: boolean
}

export interface ExportResult {
  roundId: string
  roundDir: string
  files: string[]
}

export const CATEGORY_OPTIONS: { value: AnnotationCategory; label: string }[] = [
  { value: 'style', label: '视觉样式' },
  { value: 'layout', label: '布局结构' },
  { value: 'content', label: '文案内容' },
  { value: 'behavior', label: '交互行为' },
  { value: 'bug', label: '缺陷' },
  { value: 'other', label: '其它' }
]

export const SEVERITY_OPTIONS: { value: AnnotationSeverity; label: string }[] = [
  { value: 'must', label: '必须改' },
  { value: 'should', label: '建议改' },
  { value: 'nice', label: '锦上添花' }
]

export const CATEGORY_LABEL: Record<AnnotationCategory, string> = {
  style: '视觉样式',
  layout: '布局结构',
  content: '文案内容',
  behavior: '交互行为',
  bug: '缺陷',
  other: '其它'
}

export const SEVERITY_LABEL: Record<AnnotationSeverity, string> = {
  must: '必须改',
  should: '建议改',
  nice: '锦上添花'
}

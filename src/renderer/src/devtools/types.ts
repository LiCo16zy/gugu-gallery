/** 标注工具的共享类型（渲染进程侧）。主进程有一份对应的镜像定义。 */

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

export interface DevlogRound {
  id: string
  dir: string
  createdAt: string
  annotationCount: number
  hasScreenshot: boolean
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

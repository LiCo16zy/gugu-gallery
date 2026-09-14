/** 把一次导出的标注渲染成人可读的 Markdown。 */
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  type Annotation,
  type ExportPayload
} from '../shared/types'

export interface ExportRecord extends ExportPayload {
  roundId: string
  exportedAt: string
  viewport: { width: number; height: number } | null
}

export function renderRoundReadme(record: ExportRecord): string {
  const viewport = record.viewport ? `${record.viewport.width}×${record.viewport.height}` : '未知'
  return `# 轮次 ${record.roundId}

> 由页面标注工具自动生成，请在完成本轮改动后补全下面的小节。

## 背景

<!-- 这一轮要解决什么问题、由谁提出 -->

${record.note ? record.note : '（待补充）'}

## 反馈标注

共 ${record.annotations.length} 条，详见 [\`annotations.md\`](annotations.md) 与 [\`annotations.json\`](annotations.json)。

导出时视口 ${viewport}，界面 ${record.view}，应用版本 ${record.appVersion}。

## 改动

<!-- 逐条说明做了什么，以及为什么这么做（含取舍） -->

## 验证

<!-- 跑了哪些测试、截图证据、以及没能验证到的部分 -->

## 遗留

<!-- 本轮没做、留待下轮的事项 -->
`
}

export function renderMarkdown(record: ExportRecord): string {
  const lines: string[] = []
  lines.push(`# 界面标注 · 轮次 ${record.roundId}`)
  lines.push('')
  lines.push(`- 导出时间：${record.exportedAt}`)
  lines.push(`- 所在界面：${record.view}`)
  if (record.viewport) {
    lines.push(`- 视口：${record.viewport.width}×${record.viewport.height}（DPR ${record.devicePixelRatio}）`)
  }
  lines.push(`- 应用版本：${record.appVersion}`)
  lines.push(`- 标注条数：${record.annotations.length}`)
  if (record.note) {
    lines.push('')
    lines.push('## 总体说明')
    lines.push('')
    lines.push(record.note)
  }
  lines.push('')
  lines.push('## 逐条标注')
  lines.push('')

  for (const a of record.annotations) {
    lines.push(...renderOne(a))
  }
  return lines.join('\n')
}

function renderOne(a: Annotation): string[] {
  const t = a.target
  const lines: string[] = []
  lines.push(`### ${a.index}. ${firstLine(a.comment) || '(无标题)'}`)
  lines.push('')
  lines.push(
    `- **类别**：${CATEGORY_LABEL[a.category]} ｜ **优先级**：${SEVERITY_LABEL[a.severity]} ｜ **方式**：${
      a.kind === 'element' ? '点选元素' : '框选区域'
    }`
  )
  if (t.component) lines.push(`- **组件**：\`${t.component}\``)
  lines.push(`- **选择器**：\`${t.selector}\``)
  if (t.parentChain.length > 0) {
    lines.push(`- **父级链**：${t.parentChain.map((p) => `\`${p}\``).join(' ← ')}`)
  }
  if (t.text) lines.push(`- **元素文本**：${truncate(t.text.replace(/\s+/g, ' '), 120)}`)
  lines.push(
    `- **位置尺寸**：x=${Math.round(a.rect.x)} y=${Math.round(a.rect.y)} ${Math.round(a.rect.width)}×${Math.round(
      a.rect.height
    )}`
  )
  const styles = Object.entries(t.styles)
  if (styles.length > 0) {
    lines.push(`- **关键样式**：${styles.map(([k, v]) => `${k}: ${v}`).join('; ')}`)
  }
  const attrs = Object.entries(t.attributes)
  if (attrs.length > 0) {
    lines.push(`- **属性**：${attrs.map(([k, v]) => `${k}="${truncate(v, 40)}"`).join(' ')}`)
  }
  lines.push('')
  lines.push('> ' + a.comment.split('\n').join('\n> '))
  lines.push('')
  return lines
}

export function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim().slice(0, 60)
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

/** 文件名片段：清掉半角与全角标点，中文保留 */
export function slugify(text: string): string {
  const cleaned = firstLine(text)
    .replace(/[\\/:*?"<>|：；？！，。、（）【】《》""''…—]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 28) || 'annotation'
}

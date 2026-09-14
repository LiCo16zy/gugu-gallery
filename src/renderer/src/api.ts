/**
 * 渲染进程访问主进程能力的入口。
 *
 * 契约定义在 @shared/bridge，这样插件界面也能用同一份类型，
 * 不需要反过来依赖应用源码（插件只依赖 preload 暴露的 window.gugu）。
 */
import type { GuguBridge } from '@shared/bridge'

export type { GuguBridge }
export type { CrawlSiteInfo, JobRow } from '@shared/bridge'

const unavailable = (): never => {
  throw new Error('主进程桥接不可用：请通过 Electron 启动本应用')
}

/** 没有 bridge 时退化成会在调用时报错的空壳，避免模块加载阶段直接崩掉 */
export const api: GuguBridge =
  typeof window !== 'undefined' && window.gugu
    ? window.gugu
    : (new Proxy({} as GuguBridge, { get: () => unavailable }) as GuguBridge)

/* ------------------------------------------------------------ 展示层格式化 */

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export const formatSpeed = (bytesPerSecond: number): string =>
  bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : '—'

export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`
  return `${Math.floor(seconds / 3600)} 小时 ${Math.round((seconds % 3600) / 60)} 分`
}

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const formatRelative = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T')).getTime()
  if (Number.isNaN(d)) return value
  const diff = Date.now() - d
  const mins = Math.round(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} 天前`
  return formatDate(value)
}

export const megapixels = (width: number | null, height: number | null): string => {
  if (!width || !height) return '—'
  return `${((width * height) / 1_000_000).toFixed(1)} MP`
}

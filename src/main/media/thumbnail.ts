/**
 * 缩略图生成。直接用 Electron 内置的 nativeImage（Skia 解码），
 * 不需要 sharp / jimp 这类原生或重型依赖，1080p -> 512px 约 10ms。
 */
import { writeFile } from 'node:fs/promises'
import { nativeImage } from 'electron'

export interface ImageProbe {
  width: number
  height: number
}

/** 读取真实像素尺寸；不是图片则返回 null */
export function probeImage(absPath: string): ImageProbe | null {
  const img = nativeImage.createFromPath(absPath)
  if (img.isEmpty()) return null
  const size = img.getSize()
  if (!size.width || !size.height) return null
  return { width: size.width, height: size.height }
}

/**
 * 生成最长边为 maxSize 的 JPEG 缩略图。
 * 返回原图尺寸，方便顺手回写数据库。
 */
export async function makeThumbnail(
  srcPath: string,
  destPath: string,
  maxSize: number
): Promise<ImageProbe | null> {
  const img = nativeImage.createFromPath(srcPath)
  if (img.isEmpty()) return null
  const size = img.getSize()
  if (!size.width || !size.height) return null

  const longest = Math.max(size.width, size.height)
  const target = Math.max(64, Math.round(maxSize))
  let out = img
  if (longest > target) {
    const ratio = target / longest
    out = img.resize({
      width: Math.max(1, Math.round(size.width * ratio)),
      height: Math.max(1, Math.round(size.height * ratio)),
      quality: 'good'
    })
  }
  await writeFile(destPath, out.toJPEG(82))
  return { width: size.width, height: size.height }
}

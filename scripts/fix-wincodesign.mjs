/**
 * 预置 electron-builder 的 winCodeSign 缓存，绕开 Windows 符号链接权限问题。
 *
 * 背景：electron-builder 打包 Windows 目标时会下载 winCodeSign 并解压，
 * 压缩包里 darwin/10.12/lib/ 下有两个符号链接，普通用户权限下解压会直接失败：
 *     ERROR: Cannot create symbolic link : 客户端没有所需的特权
 * 失败之后不仅出不了 NSIS 安装包，连 exe 的版本信息都来不及写
 * （文件属性里会显示成 "Electron"）。
 *
 * 做法：自己把压缩包解开，**跳过 darwin 目录**（Windows 打包根本用不到它），
 * 放到 electron-builder 期望的位置。它会直接命中缓存，不再尝试解压。
 *
 *   node scripts/fix-wincodesign.mjs
 *
 * 幂等：目标目录已存在且含 rcedit 就直接跳过。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** electron-builder-binaries 当前的 winCodeSign 版本 */
const WINCODESIGN_DIR = 'winCodeSign-2.6.0'

const cacheRoot =
  process.env.ELECTRON_BUILDER_CACHE ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache')

const vendorDir = join(cacheRoot, 'winCodeSign')
const targetDir = join(vendorDir, WINCODESIGN_DIR)
const sevenZip = join(
  process.cwd(),
  'node_modules',
  '7zip-bin',
  'win',
  'x64',
  '7za.exe'
)

if (process.platform !== 'win32') {
  console.log('[fix-wincodesign] 非 Windows 平台，无需处理')
  process.exit(0)
}

if (existsSync(join(targetDir, 'rcedit-x64.exe'))) {
  console.log(`[fix-wincodesign] 缓存已就绪：${targetDir}`)
  process.exit(0)
}

if (!existsSync(vendorDir)) {
  console.log('[fix-wincodesign] 还没有下载过 winCodeSign，先跑一次打包让它下载，再执行本脚本')
  process.exit(0)
}

// 找最近一次下载下来的压缩包
const archives = readdirSync(vendorDir)
  .filter((name) => name.endsWith('.7z'))
  .map((name) => ({ name, path: join(vendorDir, name), mtime: statSync(join(vendorDir, name)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

if (archives.length === 0) {
  console.log('[fix-wincodesign] 缓存目录里没有 .7z，跳过')
  process.exit(0)
}

if (!existsSync(sevenZip)) {
  console.error(`[fix-wincodesign] 找不到 7za：${sevenZip}`)
  process.exit(1)
}

console.log(`[fix-wincodesign] 从 ${archives[0].name} 解压（跳过 darwin）`)
rmSync(targetDir, { recursive: true, force: true })
try {
  execFileSync(sevenZip, ['x', archives[0].path, `-o${targetDir}`, "-xr!darwin", '-y'], { stdio: 'ignore' })
} catch (err) {
  console.error('[fix-wincodesign] 解压失败：', err instanceof Error ? err.message : err)
  process.exit(1)
}

if (existsSync(join(targetDir, 'rcedit-x64.exe'))) {
  console.log(`[fix-wincodesign] 已就绪：${targetDir}`)
} else {
  console.error('[fix-wincodesign] 解压后没找到 rcedit，打包可能仍会失败')
  process.exit(1)
}

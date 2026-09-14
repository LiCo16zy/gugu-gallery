/**
 * 发布构建：显式地把所有插件排除在外。
 *
 *   node scripts/release.mjs build     # 只构建
 *   node scripts/release.mjs pack      # 构建 + 免安装目录
 *   node scripts/release.mjs dist      # 构建 + 安装包
 *
 * 插件是开发/协作期的工具，不该出现在给最终用户的应用里 ——
 * 构建完成后本脚本会实际检查产物里是否残留插件代码，避免「以为排除了其实没有」。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const mode = process.argv[2] ?? 'build'

function sh(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts })
    child.on('exit', (code) => resolvePromise(code ?? 1))
  })
}

console.log('== 发布构建（不装载任何插件）')
const buildCode = await sh('npx', ['electron-vite', 'build'], {
  env: { ...process.env, GUGU_PLUGINS: '' }
})
if (buildCode !== 0) {
  console.error('构建失败')
  process.exit(buildCode)
}

console.log('\n== 检查产物里是否残留插件代码')
const problems = []

// 1) 主进程不应该有插件 chunk
const pluginChunkDir = join(root, 'out', 'main', 'plugins')
if (existsSync(pluginChunkDir)) {
  const files = await readdir(pluginChunkDir)
  if (files.length > 0) problems.push(`out/main/plugins 下仍有 ${files.length} 个插件产物: ${files.join(', ')}`)
}

// 2) 渲染进程 bundle 不应包含插件的类名/文案特征串
const assetsDir = join(root, 'out', 'renderer', 'assets')
if (existsSync(assetsDir)) {
  const markers = ['gugu-anno-toolbar', 'gugu-anno-editor', 'annotations.json', '页面标注工具']
  for (const file of await readdir(assetsDir)) {
    if (!file.endsWith('.js') && !file.endsWith('.css')) continue
    const content = await readFile(join(assetsDir, file), 'utf8')
    for (const marker of markers) {
      if (content.includes(marker)) problems.push(`${file} 里出现了插件特征串: ${marker}`)
    }
  }
}

if (problems.length > 0) {
  console.error('✗ 产物检查未通过：')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('✓ 产物中没有任何插件代码')

if (mode === 'pack' || mode === 'dist') {
  // 先把 winCodeSign 缓存备好，绕开 Windows 符号链接权限问题
  // （否则不仅出不了安装包，exe 的版本信息也会缺失）
  console.log('\n== 准备 winCodeSign 缓存')
  await sh('node', [join(root, 'scripts', 'fix-wincodesign.mjs')])

  console.log(`\n== 打包（${mode === 'dist' ? '安装包' : '免安装目录'}）`)
  const args = mode === 'dist' ? [] : ['--dir']
  const code = await sh('npx', ['electron-builder', ...args])
  process.exit(code)
}

console.log('\n完成。产物在 out/')

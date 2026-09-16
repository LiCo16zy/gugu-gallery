/**
 * 发布构建：显式地把所有插件排除在外。
 *
 *   node scripts/release.mjs build   # 前端 + Rust 可执行文件（不打包安装包）
 *   node scripts/release.mjs dist    # 再加 NSIS 安装包
 *
 * 插件是开发/协作期的工具，不该出现在给最终用户的应用里 ——
 * 构建完成后本脚本会实际检查产物里是否残留插件代码，避免「以为排除了其实没有」。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const mode = process.argv[2] ?? 'build'

/** Rust 不一定在 PATH 上（本机就装在 ~/.cargo/bin） */
function cargoBinary() {
  if (process.env.CARGO) return process.env.CARGO
  const local = join(homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo')
  return existsSync(local) ? local : 'cargo'
}

function sh(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts })
    child.on('exit', (code) => resolvePromise(code ?? 1))
  })
}

/** 产物里不该出现的插件特征串 */
const PLUGIN_MARKERS = ['gugu-anno-toolbar', 'gugu-anno-editor', 'annotations.json', '页面标注工具']

async function findPluginResidue() {
  const problems = []
  const assetsDir = join(root, 'out', 'renderer', 'assets')
  if (existsSync(assetsDir)) {
    for (const file of await readdir(assetsDir)) {
      if (!file.endsWith('.js') && !file.endsWith('.css')) continue
      const content = await readFile(join(assetsDir, file), 'utf8')
      for (const marker of PLUGIN_MARKERS) {
        if (content.includes(marker)) problems.push(`out/renderer/assets/${file} 里出现了插件特征串: ${marker}`)
      }
    }
  }

  const exe = join(root, 'src-tauri', 'target', 'release', process.platform === 'win32' ? 'gugu-gallery.exe' : 'gugu-gallery')
  if (existsSync(exe)) {
    const raw = await readFile(exe)
    for (const marker of PLUGIN_MARKERS) {
      if (raw.includes(Buffer.from(marker, 'utf8'))) problems.push(`可执行文件里出现了插件特征串: ${marker}`)
    }
  }
  return problems
}

console.log('== 发布构建（不装载任何插件）')
const env = { ...process.env, GUGU_PLUGINS: '' }

const webCode = await sh('npm', ['run', 'build:web'], { env })
if (webCode !== 0) {
  console.error('前端构建失败')
  process.exit(webCode)
}

console.log('\n== 检查渲染产物里是否残留插件代码')
let problems = await findPluginResidue()
if (problems.length > 0) {
  console.error('✗ 产物检查未通过：')
  for (const problem of problems) console.error('  - ' + problem)
  process.exit(1)
}
console.log('✓ 渲染产物中没有任何插件代码')

console.log(`\n== 编译 Rust（${mode === 'dist' ? 'release + NSIS 安装包' : 'release'}）`)
const cargo = cargoBinary()
const code =
  mode === 'dist'
    ? await sh('npx', ['tauri', 'build'], { env })
    : await sh(cargo, ['build', '--release', '--manifest-path', 'src-tauri/Cargo.toml'], { env, shell: false })
if (code !== 0) {
  console.error('编译/打包失败')
  process.exit(code)
}

if (mode === 'dist') {
  console.log('\n== 复核打包后的可执行文件')
  problems = await findPluginResidue()
  const exeProblems = problems.filter((p) => p.startsWith('可执行文件'))
  if (exeProblems.length > 0) {
    console.error('✗ 可执行文件检查未通过：')
    for (const problem of exeProblems) console.error('  - ' + problem)
    process.exit(1)
  }
  console.log('✓ 可执行文件里没有任何插件代码')
  console.log('\n产物：src-tauri/target/release/bundle/nsis/')
} else {
  console.log('\n产物：src-tauri/target/release/')
}

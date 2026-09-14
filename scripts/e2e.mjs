/**
 * 端到端冒烟测试：真连 www.guguxz.com，索引 1 页并下载少量原图，
 * 然后校验数据库与磁盘产物是否自洽。
 *
 *   node scripts/e2e.mjs            # 默认下载 4 张
 *   node scripts/e2e.mjs --max 10
 *
 * 需要能访问外网；失败时以非 0 退出。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const electronBinary = join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
)

const maxIndex = process.argv.indexOf('--max')
const max = maxIndex >= 0 ? process.argv[maxIndex + 1] : '4'
const library = join(root, 'data', 'e2e')

if (!existsSync(join(root, 'out', 'main', 'cli.js'))) {
  console.error('缺少构建产物，请先 npm run build')
  process.exit(1)
}

await rm(library, { recursive: true, force: true })
await mkdir(library, { recursive: true })

console.log('== 1/3 运行 CLI 抓取（1 页，最多 ' + max + ' 张原图）')
const code = await new Promise((resolvePromise) => {
  const child = spawn(
    electronBinary,
    [
      join(root, 'out', 'main', 'cli.js'),
      '--pages',
      '1',
      '--max',
      String(max),
      '--delay',
      '150',
      '--library',
      library
    ],
    { cwd: root, stdio: 'inherit', env: { ...process.env, GUGU_LIBRARY_ROOT: library } }
  )
  child.on('exit', (c) => resolvePromise(c ?? 1))
})

if (code !== 0) {
  console.error('抓取进程退出码非 0')
  process.exit(1)
}

console.log('== 2/3 校验磁盘产物')
const checks = []
const originalDir = join(library, 'originals', 'ACG图片', 'Pixiv萌图')
const originals = existsSync(originalDir) ? await readdir(originalDir) : []
const thumbs = existsSync(join(library, 'thumbs')) ? await readdir(join(library, 'thumbs')) : []
checks.push(['索引数据库存在', existsSync(join(library, 'index.db'))])
checks.push([`原图数量 >= 1（实际 ${originals.length}）`, originals.length >= 1])
checks.push([`缩略图数量与原图一致（${thumbs.length} / ${originals.length}）`, thumbs.length === originals.length])

let totalBytes = 0
for (const name of originals) totalBytes += (await stat(join(originalDir, name))).size
checks.push([`原图总字节数 > 100KB（实际 ${(totalBytes / 1024).toFixed(0)} KB）`, totalBytes > 100 * 1024])

const badNames = originals.filter((n) => !/\.[a-z0-9]+$/i.test(n))
checks.push([`文件名都带扩展名`, badNames.length === 0])

console.log('== 3/3 结果')
let failed = 0
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failed += 1
}

if (failed > 0) {
  console.error(`\n端到端测试失败 ${failed} 项`)
  process.exit(1)
}
console.log('\n端到端测试通过。图库位于 ' + library)

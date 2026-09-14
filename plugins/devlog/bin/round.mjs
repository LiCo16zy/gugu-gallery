/**
 * 轮次档案工具。
 *
 *   node scripts/round.mjs list                 列出所有轮次
 *   node scripts/round.mjs new <slug>           开一轮：建目录 + 起始截图 + 元数据
 *   node scripts/round.mjs finalize <轮次ID>    收尾：改动截图 + 代码 diff + 更新说明 + 打 tag
 *
 * 配合界面上的「标注工具」使用：
 *   标注工具负责产出 annotations.md/json 与逐条裁片，
 *   本脚本负责补齐「改动前后对照截图 + 代码差异 + 轮次说明」，
 *   让整个开发过程可以完整回溯与展示。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const roundsDir = join(root, 'devlog', 'rounds')
const indexPath = join(root, 'devlog', 'index.json')
const libraryRoot = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')

const [command, ...rest] = process.argv.slice(2)

/* ------------------------------------------------------------------ 工具 */

function sh(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: root, shell: process.platform === 'win32', ...opts })
    let out = ''
    child.stdout?.on('data', (d) => (out += String(d)))
    child.stderr?.on('data', (d) => (out += String(d)))
    child.on('exit', (code) => resolvePromise({ code, out }))
  })
}

const git = async (args) => (await sh('git', args)).out.trim()

async function listRoundDirs() {
  if (!existsSync(roundsDir)) return []
  const entries = await readdir(roundsDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(indexPath, 'utf8'))
  } catch {
    return { rounds: [] }
  }
}

async function writeIndex(index) {
  await mkdir(dirname(indexPath), { recursive: true })
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8')
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 调用主进程的截图模式，把四个界面截到指定目录 */
async function capture(targetDir) {
  await mkdir(targetDir, { recursive: true })
  const result = await sh(process.execPath, [join(root, 'scripts', 'shot.mjs')], {
    env: {
      ...process.env,
      GUGU_SHOT_DIR: targetDir,
      GUGU_SHOT_FORMAT: 'jpeg',
      GUGU_LIBRARY_ROOT: libraryRoot,
      GUGU_SETTINGS_FILE: join(root, 'data', 'round-settings.json'),
      GUGU_DIAG: ''
    },
    stdio: 'inherit'
  })
  return result.code === 0
}

/* ---------------------------------------------------------------- 子命令 */

async function cmdList() {
  const dirs = await listRoundDirs()
  if (dirs.length === 0) {
    console.log('还没有任何轮次。用 `node scripts/round.mjs new <slug>` 开一轮。')
    return
  }
  const index = await readIndex()
  console.log('轮次档案：\n')
  for (const dir of dirs) {
    const meta = index.rounds.find((r) => r.id === dir)
    const files = await readdir(join(roundsDir, dir))
    const anno = existsSync(join(roundsDir, dir, 'annotations.json'))
    console.log(`  ${dir}`)
    console.log(`    文件: ${files.join(', ')}`)
    if (meta?.summary) console.log(`    说明: ${meta.summary}`)
    if (anno) console.log('    含界面标注')
    console.log('')
  }
}

async function cmdNew(slug) {
  if (!slug) {
    console.error('用法: node scripts/round.mjs new <slug>')
    process.exit(1)
  }
  const safe = slug.replace(/[^\w\u4e00-\u9fa5-]/g, '-').replace(/-+/g, '-')
  const dirs = await listRoundDirs()
  const number = String(dirs.length + 1).padStart(4, '0')
  const id = `${number}-${safe}`
  const dir = join(roundsDir, id)
  if (existsSync(dir)) {
    console.error(`轮次已存在: ${id}`)
    process.exit(1)
  }
  await mkdir(join(dir, 'screenshots-before'), { recursive: true })

  const commit = await git(['rev-parse', '--short', 'HEAD'])
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

  console.log(`== 采集起始截图 -> ${id}/screenshots-before`)
  const ok = await capture(join(dir, 'screenshots-before'))
  if (!ok) console.warn('  （截图失败，可稍后手动补）')

  const readme = `# 轮次 ${id}

- 时间：${stamp()}
- 起点提交：\`${commit}\`（分支 ${branch}）
- 应用版本：${pkg.version}

## 背景

<!-- 这一轮要解决什么问题、由谁提出 -->

## 反馈标注

<!-- 若本轮有界面标注，链接到 annotations.md；没有就删掉这段 -->

## 改动

<!-- 逐条说明做了什么，以及为什么这么做（含取舍） -->

## 验证

<!-- 跑了哪些测试、截图证据、以及没能验证到的部分 -->

## 遗留

<!-- 本轮没做、留待下轮的事项 -->
`
  await writeFile(join(dir, 'README.md'), readme, 'utf8')

  const index = await readIndex()
  index.rounds = index.rounds.filter((r) => r.id !== id)
  index.rounds.push({
    id,
    slug: safe,
    createdAt: stamp(),
    baseCommit: commit,
    branch,
    summary: '',
    status: 'open'
  })
  await writeIndex(index)

  console.log(`\n已创建轮次 ${id}`)
  console.log(`  目录: devlog/rounds/${id}`)
  console.log('  完成后执行: node scripts/round.mjs finalize ' + id)
}

async function cmdFinalize(roundId) {
  if (!roundId) {
    console.error('用法: node scripts/round.mjs finalize <轮次ID>')
    process.exit(1)
  }
  const dirs = await listRoundDirs()
  const id = dirs.find((d) => d === roundId) ?? dirs.find((d) => d.startsWith(roundId))
  if (!id) {
    console.error(`找不到轮次: ${roundId}\n现有：${dirs.join(', ') || '(无)'}`)
    process.exit(1)
  }
  const dir = join(roundsDir, id)
  const index = await readIndex()
  const meta = index.rounds.find((r) => r.id === id) ?? {}
  const baseCommit = meta.baseCommit ?? 'HEAD~1'

  console.log(`== 采集改动后截图 -> ${id}/screenshots-after`)
  await capture(join(dir, 'screenshots-after'))

  const commit = await git(['rev-parse', '--short', 'HEAD'])
  const diffStat = await git(['diff', '--stat', `${baseCommit}..HEAD`])
  const diffNameStatus = await git(['diff', '--name-status', `${baseCommit}..HEAD`])
  const fullDiff = await git(['diff', `${baseCommit}..HEAD`])

  await writeFile(
    join(dir, 'changes.patch'),
    `# 轮次 ${id} 代码差异\n# 基线提交 ${baseCommit} -> ${commit}\n\n${fullDiff}`,
    'utf8'
  )
  await writeFile(
    join(dir, 'changes.md'),
    `# 轮次 ${id} 代码差异概览\n\n- 基线：\`${baseCommit}\`\n- 结果：\`${commit}\`\n\n## 变更文件\n\n\`\`\`\n${diffNameStatus}\n\`\`\`\n\n## 统计\n\n\`\`\`\n${diffStat}\n\`\`\`\n`,
    'utf8'
  )

  // 统计一下有截图的话列进 README
  const shotsBefore = existsSync(join(dir, 'screenshots-before')) ? await readdir(join(dir, 'screenshots-before')) : []
  const shotsAfter = existsSync(join(dir, 'screenshots-after')) ? await readdir(join(dir, 'screenshots-after')) : []
  const hasAnnotations = existsSync(join(dir, 'annotations.json'))

  const readmePath = join(dir, 'README.md')
  let readme = existsSync(readmePath) ? await readFile(readmePath, 'utf8') : `# 轮次 ${id}\n`
  const evidence = [
    '',
    '## 过程存档',
    '',
    `- 起始截图（${shotsBefore.length} 张）：\`screenshots-before/\``,
    `- 改动后截图（${shotsAfter.length} 张）：\`screenshots-after/\``,
    `- 代码差异：\`changes.patch\` / \`changes.md\``,
    hasAnnotations ? '- 界面标注原文：`annotations.md` / `annotations.json`' : '- （本轮无界面标注）',
    ''
  ].join('\n')
  if (!readme.includes('## 过程存档')) readme += evidence
  await writeFile(readmePath, readme, 'utf8')

  index.rounds = index.rounds.filter((r) => r.id !== id)
  index.rounds.push({ ...meta, id, finishedAt: stamp(), endCommit: commit, status: 'closed' })
  await writeIndex(index)

  const tag = `round/${id}`
  const tagResult = await git(['tag', '-f', tag])
  void tagResult

  console.log(`\n轮次 ${id} 已收尾`)
  console.log(`  改动文件：\n${diffNameStatus.split('\n').map((l) => '    ' + l).join('\n')}`)
  console.log(`  git tag: ${tag}`)
}

/* ---------------------------------------------------------------- 分发 */

switch (command) {
  case 'list':
    await cmdList()
    break
  case 'new':
    await cmdNew(rest[0])
    break
  case 'finalize':
    await cmdFinalize(rest[0])
    break
  default:
    console.log(`轮次档案工具

  node scripts/round.mjs list                 列出所有轮次
  node scripts/round.mjs new <slug>           开一轮（建目录 + 起始截图 + 元数据）
  node scripts/round.mjs finalize <轮次ID>    收尾（改动截图 + 代码 diff + 更新说明 + 打 tag）
`)
}

/**
 * 一行命令进入「demo 图库 + 页面标注工具」的开发模式
 * （和 Electron 时代 `npm run dev` 是同一个体验）。
 *
 *   npm run dev
 *
 * - 图库指向仓库里的 data/demo：随便点、随便删，都碰不到你的真实图库
 * - 设置与用户数据同样隔离在 data/ 下
 * - debug 构建默认装载 plugins.json 里的插件 —— 页面标注工具按 Ctrl+Shift+A 打开
 *   （顶栏右侧也有笔形按钮），导出会写进 devlog/rounds/
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { root } from './tauri-app.mjs'

mkdirSync(join(root, 'data'), { recursive: true })

const env = { ...process.env }
env.GUGU_LIBRARY_ROOT ??= join(root, 'data', 'demo')
env.GUGU_SETTINGS_FILE ??= join(root, 'data', 'demo-settings.json')
env.GUGU_USER_DATA ??= join(root, 'data', 'demo-userdata')

// Rust 工具链不一定在 PATH 上（本机装在 ~/.cargo/bin）
const cargoBin = join(homedir(), '.cargo', 'bin')
const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
if (!(env[pathKey] ?? '').toLowerCase().includes(cargoBin.toLowerCase())) {
  env[pathKey] = `${cargoBin};${env[pathKey] ?? ''}`
}

console.log('== demo 开发模式')
console.log(`   图库: ${env.GUGU_LIBRARY_ROOT}`)
console.log(`   设置: ${env.GUGU_SETTINGS_FILE}`)
console.log('   标注工具: Ctrl+Shift+A（或顶栏右侧笔形按钮）\n')

const child = spawn('npm', ['run', 'tauri:dev'], { cwd: root, env, stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))

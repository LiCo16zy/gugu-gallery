/**
 * 启动 Tauri 版应用的公共部分：找可执行文件、起 Vite 开发服务器、跑一次应用并收输出。
 *
 * debug 构建从 devUrl 加载界面，所以每次运行前都要先把 Vite 开发服务器起起来；
 * 打包好的 release 版本自带前端资源，不需要这一步。
 *
 * 注意：开发服务器的输出写进 data/dev-server.log（不是管道）——
 * Windows 上 npm 会再 fork 一层，留下的孙进程会一直握着管道，脚本会僵着不退出。
 */
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const root = resolve(here, '..')

/** 应用本体：默认 debug 构建 */
export function appBinary({ release = false } = {}) {
  const exe = process.platform === 'win32' ? 'gugu-gallery.exe' : 'gugu-gallery'
  return join(root, 'src-tauri', 'target', release ? 'release' : 'debug', exe)
}

/** 连同子进程一起干掉（Windows 上 npm 会再 fork 一层） */
export function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

/** 起 Vite 开发服务器，返回 { kill }（就绪后返回，超时抛错） */
export async function startDevServer({ port = 5173, timeoutMs = 40000 } = {}) {
  mkdirSync(join(root, 'data'), { recursive: true })
  const logPath = join(root, 'data', 'dev-server.log')
  const log = openSync(logPath, 'a')
  const child = spawn('npm run dev:web', [], {
    shell: true,
    cwd: root,
    stdio: ['ignore', log, log]
  })
  closeSync(log)

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`)
      if (res.ok) return { kill: () => killTree(child), logPath }
    } catch {
      // 还没起来，继续等
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  killTree(child)
  throw new Error(`Vite 开发服务器没能在超时前就绪，见 ${logPath}`)
}

/** 跑一次应用，收集 stdout/stderr 直到它自己退出（或超时被杀） */
export function runApp(env, { timeoutMs = 180000, echo = true } = {}) {
  const exe = appBinary()
  if (!existsSync(exe)) {
    throw new Error(`未找到应用产物：${exe}（先执行 cd src-tauri && cargo build）`)
  }
  return new Promise((resolvePromise) => {
    const child = spawn(exe, [], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let buf = ''
    const onData = (d) => {
      buf += String(d)
      if (echo) process.stdout.write(String(d))
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    const killer = setTimeout(() => {
      killTree(child)
      resolvePromise({ output: buf, code: null, timedOut: true })
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(killer)
      resolvePromise({ output: buf, code, timedOut: false })
    })
  })
}

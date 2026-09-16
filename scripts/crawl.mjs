/**
 * 命令行抓取：把参数原样转发给应用本体的命令行模式。
 * 和界面走同一套引擎、HTTP 客户端与落盘逻辑。
 *
 *   npm run crawl -- --search --word 泳装类分享 --pages 3 --index-only
 *   npm run crawl -- --pages 1 --max 3 --delay 150 --library D:/Pics/GuguGallery
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { appBinary, root } from './tauri-app.mjs'

const exe = appBinary()
if (!existsSync(exe)) {
  console.error('未找到应用产物：' + exe + '（先执行 cd src-tauri && cargo build）')
  process.exit(1)
}

const child = spawn(exe, process.argv.slice(2), { cwd: root, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))

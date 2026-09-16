/**
 * 暂停 / 继续自检：跑一次真实的「批量下载」，验证
 *   1) 暂停后阶段变「已暂停」、按钮变「继续」、进度真的停住
 *   2) 继续后能接着往下跑（不是从头再来）
 *   3) 运行日志不重复刷同一行
 *   4) 停止能把任务收掉
 *
 *   npm run pausecheck
 *
 * 需要联网（和 e2e 同类）。图库用 data/demo 的副本；下载队列直接从图库里挑
 * 「还没下载」的条目，不依赖索引速度，所以暂停窗口稳定可控。
 */
import { cp, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { appBinary, root, runApp, startDevServer } from './tauri-app.mjs'

const sourceLibrary = process.env.GUGU_LIBRARY_ROOT ?? join(root, 'data', 'demo')
const library = join(root, 'data', 'pausecheck-lib')
const userData = join(root, 'data', 'pausecheck-userdata')
const outDir = join(root, 'data', 'pausecheck-shots')

if (!existsSync(appBinary())) {
  console.error('未找到应用产物，请先执行：cd src-tauri && cargo build')
  process.exit(1)
}

await rm(library, { recursive: true, force: true })
await rm(userData, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await cp(sourceLibrary, library, { recursive: true })

const SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const snap = (p) => [p.downloadTotal, p.downloaded, p.failed, p.bytesDownloaded].join('/');
  const btn = (label) =>
    Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === label);
  const bodyText = () => document.body.innerText || '';
  // 只数页面整体文本（日志面板就在里面），否则同一行会被数两遍
  const count = (needle) => bodyText().split(needle).length - 1;

  window.dispatchEvent(new CustomEvent('gugu:navigate', { detail: 'crawl' }));
  await sleep(1200);
  out.onCrawlPage = Boolean(document.querySelector('.card-panel'));

  // 挑 8 个还没下载的条目，直接用桥发起批量下载（不依赖索引阶段）
  let ids = [];
  try {
    const page = await window.gugu.library.query({ pageSize: 60 });
    // 挑「还没下载」里最小的几张：单张下得快，暂停/继续的窗口才稳定
    ids = (page?.items ?? [])
      .filter((it) => it.fileStatus !== 'ready')
      .sort((a, b) => (a.bytes ?? Number.MAX_SAFE_INTEGER) - (b.bytes ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 6)
      .map((it) => it.id);
    out.picked = ids.length;
    if (ids.length === 0) { out.error = '图库里没有可下载的条目'; return out; }
    await window.gugu.crawl.downloadItems(ids);
    out.started = true;
  } catch (e) {
    out.startError = String(e);
    return out;
  }

  // 队列一拿到就说明任务真的跑起来了；具体下完几张要看站点脸色，不当作断言
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const p = await window.gugu.crawl.progress();
    if (p && (p.downloadTotal ?? 0) > 0) { out.queued = true; break; }
    if (p && ['done', 'cancelled', 'failed'].includes(p.phase)) { out.finishedTooEarly = p.phase; break; }
  }
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const p = await window.gugu.crawl.progress();
    if (p && p.downloaded + p.failed > 0) { out.startedDownloading = true; break; }
    if (p && ['done', 'cancelled', 'failed'].includes(p.phase)) break;
  }
  if (out.finishedTooEarly) return out;

  await sleep(2000);
  btn('暂停')?.click();
  // 暂停不打断「在途的那一次请求」（否则会留半截文件），所以要等它落地、
  // 进度连续 3 秒不动，再取基准快照 —— 否则会把在途请求的完成误判成"暂停无效"
  let lastSnap = null;
  let stable = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const cur = snap(await window.gugu.crawl.progress());
    if (cur === lastSnap) stable += 1;
    else {
      stable = 0;
      lastSnap = cur;
    }
    if (stable >= 3) break;
  }
  const p1 = await window.gugu.crawl.progress();
  out.phaseAfterPause = p1.phase;
  out.pausedFlag = p1.paused;
  out.buttonAfterPause = (btn('继续') || btn('暂停'))?.textContent.trim() ?? null;
  out.labelShowsPaused = bodyText().includes('已暂停');
  const frozen = snap(p1);
  out.snapshotAtPause = frozen;

  await sleep(6000);
  const p2 = await window.gugu.crawl.progress();
  out.frozenWhilePaused = snap(p2) === frozen && p2.phase === 'paused';
  out.snapshotAfterWait = snap(p2);

  out.pauseLineCount = count('已暂停：');

  btn('继续')?.click();
  await sleep(1500);
  const p3 = await window.gugu.crawl.progress();
  out.phaseAfterResume = p3.phase;
  out.pausedAfterResume = p3.paused;

  let advanced = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1500);
    const p = await window.gugu.crawl.progress();
    if (snap(p) !== snap(p2)) { advanced = true; out.snapshotAfterResume = snap(p); break; }
    if (['done', 'cancelled', 'failed'].includes(p.phase)) {
      out.snapshotAfterResume = snap(p)
      out.phaseBeforeStop = p.phase
      advanced = true
      break
    }
  }
  out.advancedAfterResume = advanced;
  out.resumeLineCount = count('继续抓取');

  // 任务可能已经自己跑完了；只有还在跑时才需要点「停止」
  const phaseNow = (await window.gugu.crawl.progress())?.phase;
  if (phaseNow && !['done', 'cancelled', 'failed'].includes(phaseNow)) {
    btn('停止')?.click();
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const p = await window.gugu.crawl.progress();
      if (!p || p.phase === 'cancelled' || p.phase === 'done' || p.phase === 'failed') {
        out.phaseAfterStop = p ? p.phase : null;
        break;
      }
    }
  } else {
    out.phaseAfterStop = phaseNow;
  }
  return out;
})()`

const vite = await startDevServer()
let output = ''
try {
  const run = await runApp(
    {
      GUGU_SHOT: outDir,
      GUGU_SHOT_VIEW: 'crawl',
      GUGU_SHOT_DELAY: '4000',
      GUGU_LIBRARY_ROOT: library,
      GUGU_SETTINGS_FILE: join(root, 'data', 'pausecheck-settings.json'),
      GUGU_USER_DATA: userData,
      GUGU_SESSION_EPHEMERAL: '1',
      GUGU_EVAL: SCRIPT
    },
    { timeoutMs: 300000, echo: false }
  )
  output = run.output
} finally {
  vite.kill()
}

const match = /__EVAL__(\{.*\})/s.exec(output)
if (!match) {
  console.error('未拿到执行结果，原始输出：\n' + output)
  process.exit(1)
}
const { ok, result, error } = JSON.parse(match[1])
if (!ok) {
  console.error('注入脚本执行失败:', error)
  process.exit(1)
}

const checks = [
  ['挑到可下载的条目并启动任务', result.started === true && result.picked > 0],
  ['任务拿到下载队列（真的跑起来了）', result.queued === true],
  ['暂停后阶段是 paused', result.phaseAfterPause === 'paused'],
  ['进度里 paused 标志为 true', result.pausedFlag === true],
  ['按钮切换成「继续」', result.buttonAfterPause === '继续'],
  ['面板显示「已暂停」', result.labelShowsPaused === true],
  ['暂停期间进度不再前进', result.frozenWhilePaused === true],
  ['继续后阶段回到抓取中', result.phaseAfterResume === 'downloading' || result.phaseAfterResume === 'indexing'],
  ['继续后 paused 标志复位', result.pausedAfterResume === false],
  // 站点抽风时可能整轮都没完成/失败过：那时"继续后是否前进"观察不到，不当作失败
  ['继续后进度继续前进（站点太慢时跳过）', result.advancedAfterResume === true || result.startedDownloading !== true],
  ['停止后任务收掉（cancelled/done）', result.phaseAfterStop === 'cancelled' || result.phaseAfterStop === 'done' || result.phaseAfterStop === null],
  ['「已暂停」日志只出现一次', result.pauseLineCount === 1],
  ['「继续抓取」日志只出现一次', result.resumeLineCount === 1]
]

if (result.startedDownloading !== true) {
  console.log('（提示：本轮站点太慢，没有观察到任何下载完成/失败，"继续后前进"这条按跳过处理）\n')
}

console.log('暂停 / 继续自检：')
let failed = 0
for (const [label, pass] of checks) {
  console.log('  ' + (pass ? '✓' : '✗') + ' ' + label)
  if (!pass) failed += 1
}
console.log('\n页面脚本返回值：')
console.log(JSON.stringify(result, null, 2).split('\n').map((l) => '  ' + l).join('\n'))

if (failed > 0) {
  console.error('\n' + failed + ' 项检查未通过')
  process.exit(1)
}
console.log('\n暂停 / 继续自检通过。')

/** 粗略比较两张截图的差异面积占比，用来判断「视觉上是否一致」。 */
const { app, nativeImage } = require('electron')

app.whenReady().then(() => {
  const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('-'))
  const ia = nativeImage.createFromPath(a)
  const ib = nativeImage.createFromPath(b)
  if (ia.isEmpty() || ib.isEmpty()) {
    console.log('读取失败')
    app.quit()
    return
  }
  const size = ia.getSize()
  const w = 320
  const h = Math.round((size.height / size.width) * w)
  const sa = ia.resize({ width: w, height: h, quality: 'good' }).getBitmap()
  const sb = ib.resize({ width: w, height: h, quality: 'good' }).getBitmap()

  let diff = 0
  let maxDelta = 0
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const d = Math.abs(sa[i] - sb[i]) + Math.abs(sa[i + 1] - sb[i + 1]) + Math.abs(sa[i + 2] - sb[i + 2])
      if (d > 24) {
        diff++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      if (d > maxDelta) maxDelta = d
    }
  }
  const pct = ((diff / (w * h)) * 100).toFixed(2)
  const box = diff > 0 ? `${minX},${minY} -> ${maxX},${maxY}（缩略 ${w}x${h}）` : '—'
  console.log(`差异像素 ${pct}%  最大通道差 ${maxDelta}  区域 ${box}`)
  app.quit()
})

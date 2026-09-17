# 咕咕小站站点分析笔记

> 抓取时间：2026-09-14。站点是 PHP 应用，前面套了 Cloudflare。
> 本文记录实测到的 URL 规则、页面结构、图片分发机制与失败特征，
> 是 `src-tauri/src/crawler/` 那套实现的事实依据。**站点改版后请回来更新这份文档。**

---

## 1. URL 规则

| 用途 | 形式 |
| --- | --- |
| 首页 | `/`，翻页 `/?page=N` |
| 分类列表 | `/search/index/plate/{一级分类}/wd/{二级分类}.html?page=N` |
| 关键词搜索 | `/search/index/wd/{关键词}.html?page=N` |
| 月排行 | `/ranking/image/plate/{一级}/wd/排行/nav/month.html` |
| 随机图片 | `/archives/image/plate/{一级}/wd/{二级}/rand/yes.html` |
| 详情页 | `/archives/image/plate/{一级}/wd/{二级}/id/{文章ID}.html` |
| 评论（iframe） | `/comment/index/aid/{文章ID}.html` |

中文分类名需要 URL 编码（UTF-8），例如 `ACG图片` → `ACG%E5%9B%BE%E7%89%87`。

**分页行为**：每页固定 10 条。超出末页返回 200 且条数为 0（不是 404），
所以「翻到空页就停」是可靠的终止条件。

以 `ACG图片 / Pixiv萌图` 为例，实测 **1430 页 / 14294 条**。

---

## 2. 列表页结构

```html
<section>
  <a href="https://www.guguxz.com/archives/image/plate/ACG图片/wd/Pixiv萌图/id/19521.html" target="_blank">
      <!--https://files.guguxz.com/tc/?item=d/y/orig/acbab8/item/0b70bb331c620d066380564c077ed4f5.png-->
      <img src="https://www.guguxz.com/index/imageBed?item=ZC95L29yaWcvYWNiYWI4L2l0ZW0v...png"
           style="min-height:100%; margin-top:0%" class="article_cover_list imageSpareSrc" />
      <img src="/static/home/image/loading.gif" class="article_cover_load" />
      <div class="content">
          <h2>2160x1080 1.65M [匿名-分享]</h2>
          <p>[明日方舟] [空弦（明日方舟）] </p>
          <span>2026-09-14 10:00</span>
          <em>ACG图片 Pixiv萌图 3浏览</em>
      </div>
  </a>
</section>
```

可提取字段：

| 字段 | 来源 | 备注 |
| --- | --- | --- |
| 文章 ID | `<a href=".../id/{N}.html">` | 稳定的主键 |
| 原图相对路径 | HTML 注释里的 `item=`，或 `<img>` 的 base64 解码 | 见第 4 节 |
| 分辨率 | `<h2>` 的 `{W}x{H}` | 与真实一致 |
| 文件大小 | `<h2>` 的 `1.65M` / `222.38K` | 指**原图**大小，与 `dw=true` 下载结果吻合 |
| 上传者 | `<h2>` 的 `[匿名-分享]` | |
| 标签 | `<p>` 里的 `[tag]` | 列表页标签可能比详情页少 |
| 发布时间 | `<span>` | |
| 分类 / 浏览量 | `<em>` 的 `ACG图片 Pixiv萌图 3浏览` | |

分页信息在底部：

```html
<p class='pageRemark'>共<b>1430</b>页<b>14294</b>条数据</p>
```

导航分类树在 `<nav>` 里，格式为 `<a class="nav_one">` + 紧随其后的 `<section class="nav_two">`。
注意 **`搞笑图片` 这一整块被 HTML 注释掉了**，但对应的 URL 依然可用，所以解析时把注释放开一起采集。

---

## 3. 详情页结构

比列表页多出来的信息：

```html
<h2>2160x3456 1.69M [匿名-分享]</h2>
<p class="p1">
  <span>6 浏览</span>
  <span>2026-09-14</span>
  <span><a href=".../search/index/wd/ACG图片.html">ACG图片</a>
        <a href=".../search/index/wd/Pixiv萌图.html">Pixiv萌图</a></span>
</p>
<em>
  <a href='.../search/index/wd/碧蓝档案.html'>碧蓝档案</a>
  <a href='.../search/index/wd/小鸟游星野（泳装）.html'>小鸟游星野（泳装）</a>
  ...
</em>

图片信息：图片分辨率：2160x3456 / 图片大小：1.69M / 发布者：匿名
关于画师：https://www.pixiv.net/users/50077972
图片ID：Pid=115534247
点赞/收藏：<span>点赞</span> + <em>0</em>
<div id="archive_id">19519</div>
```

下载按钮指向原图通道：

```html
<a href="https://www.guguxz.com/index/imageBed?item=d/y/orig/f13f94/item/d57986f9....png&dw=true">下载原图</a>
```

---

## 4. 图片分发机制（最关键的部分）

图片不直接暴露，统一走 `/index/imageBed`：

```
GET /index/imageBed?item=<base64(相对路径)>            → 302 → CDN .../sign/<hash>/item/<file>
GET /index/imageBed?item=<相对路径>&dw=true            → 302 → CDN .../dw/yes/orig/<xx>/save/origin/sign/<hash>/item/<file>
```

- **必须带 `Referer: https://www.guguxz.com/`**，否则直接 **403 Forbidden**。
  带上的话返回 302，`Location` 指向 `total.wdbed.vip` 上的签名地址。
- 拿到签名地址之后，再请求 **CDN 不需要 Referer**。
- 需要跟随重定向（`curl -L` / `redirect: 'follow'`）。

两条通道的内容**完全不同**：

| 通道 | 实例（#19519） | 说明 |
| --- | --- | --- |
| base64 `item=` | 322,534 字节，JPEG q70 | 压缩预览图，就是列表页显示的那张 |
| `item=...&dw=true` | 1,769,100 字节（1.69 MiB） | **真原图**，与站点标注的「图片大小：1.69M」一致 |

所以下载原图必须走 `dw=true`。相对路径可以从列表页的 base64 解出来，
**不必为了下载而先访问详情页**，这是整个爬虫效率的关键。

相对路径形如 `d/y/orig/<6位桶名>/item/<32位md5>.<ext>`。

### 扩展名不可信

```
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Length: 322534
```

而请求的路径是 `...d57986f9b5cb481bd9f97fe00b74cf68.png` —— 实际是 **JPEG**。
站点用 GD 重新编码过，扩展名沿用上传时的原始名。因此必须靠**魔数**判断真实格式，
否则缩略图生成和图片加载都会出问题。

支持通过魔数识别的格式：JPEG、PNG、GIF、BMP、WebP、AVIF、HEIC。

---

## 5. 失败特征与对策

这是本站最需要认真对待的地方。实测：

```
顺序请求 12 个列表页（间隔 1s）：
  page=1  ok  20377 bytes  1.29s
  page=2  ok  20739 bytes  1.18s
  page=3  FAIL      0 bytes 20.02s   ← 连接建立后挂死直到超时
  page=4  ok  20469 bytes  1.25s
  page=5  ok  20461 bytes  1.16s
  page=6  FAIL      0 bytes  20.02s
  page=7  FAIL    618 bytes  20.02s   ← 响应被截断，但状态码仍是 200
  page=8..12 ok
```

并发 4~6 时失败率更高（约 30%）。HTTP/1.1 强制与 HTTP/2 表现一致。

**关键点：失败不会表现为网络异常。** 截断的响应 HTTP 状态是 200，body 也非空，
直接 `res.text()` 会拿到半截 HTML 而不报错。

对策（`src/main/crawler/http.ts`）：

1. **内容完整性校验**
   - HTML：必须以 `</html>` 结尾，且包含 `<body`
   - 图片：实际写入字节数必须等于 `Content-Length`
2. **指数退避重试**：700ms × 2ⁿ + 0~400ms 抖动，默认 4 次。实测重试后基本都能成功。
3. **停滞看门狗**：下载过程中超过 30s 没有新数据就中止重连。
4. **低频 + 小并发**：默认列表页并发 2、下载并发 3、间隔 220ms。
   实测这个组合下 CDN 下载可达约 1.4 MB/s，且失败率可接受。

---

## 6. 其它观察

- `robots.txt` 内容是 `User-agent: *` + `Disallow:`，即全站允许抓取。
  本项目仍保持保守速率，并遵守个人使用与版权边界（见 README 合规声明）。
- 站点有 `/pixiv.html`（Pixiv 原图提取工具）、`/bilibili.html`（B 站封面提取）等页面，
  与抓取目标无关。
- 站点提供 Android APP（`https://image.guguxz.com/app.apk`），说明背后有 App 接口，
  但本项目选择走 HTML 页面，接口变动风险更低、也更容易维护与测试。
- 详情页评论是 iframe（`/comment/index/aid/{id}.html`），本项目不抓评论。

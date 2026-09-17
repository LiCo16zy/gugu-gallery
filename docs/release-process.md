# 发布流程：从源码到 GitHub Release 资产

这份文档只回答一件事：**安装包怎么产生、怎么挂到 GitHub Release 上**，以及本机网络限制下的每一条通路。

> 当前是 Tauri 2（Rust）技术栈：本地打包命令与产物路径见第四节，
> 资产从哪来、怎么上传、怎么校验见第五节。

---

## 一、本机网络事实（实测）

| 通路 | 用途 | 结果 |
| --- | --- | --- |
| `github.com` / `api.github.com` / `uploads.github.com`（HTTPS 直连） | 网页面板、API 上传资产 | ✗ 全部 `000`（连不上） |
| `git@github.com`（SSH） | `git push` 代码与标签 | ✓ 正常（v0.6.3 就是这么推上去的） |
| `objects.githubusercontent.com`（Release 资产直链） | 下载资产（打包工具链） | ✗ `000` |
| `ghproxy.net`（GitHub 资产镜像） | 同上，走镜像 | ✓ `206`，文件 SHA1 与官方一致 |
| `go.microsoft.com` → `msedge.sf.dl.delivery.mp.microsoft.com` | 打包时拉 WebView2 引导程序 | ✓ `301` / `206` |

**两条结论，决定了后面所有步骤：**

1. **下载**：凡是「GitHub Release 资产」类的下载，直连不通 —— 用镜像或提前手工放缓存（第三节）。
2. **上传**：本机 HTTPS 到 `github.com` 不通 —— 资产上传只能走浏览器/代理（第五节 A–C），
   或者干脆交给 GitHub 自己的机器（第五节 D，推荐）。

---

## 二、版本号与产物命名

发布前必须同步两个地方（两处都参与产物生成，不一致会出「exe 里写着 0.6.3、文件名是 0.7.0」这种事）：

| 位置 | 谁在用 |
| --- | --- |
| `package.json` → `version` | `src-tauri/build.rs` 读它注入 `GUGU_APP_VERSION`（界面「关于」显示） |
| `src-tauri/tauri.conf.json` → `version` | Tauri 打包器用它命名安装包、写 exe 版本信息 |

一致性检查（发布前跑一次，三项必须相同）：

```bash
node -e "const p=require('./package.json'),t=require('./src-tauri/tauri.conf.json');const tag=process.argv[1];console.log(p.version,t.version,tag);if(!(p.version===t.version&&tag==='v'+p.version))process.exit(1)" v0.7.0
```

**产物命名**（Tauri 打包器固定格式，`arch = x64`）：

```
src-tauri/target/release/bundle/nsis/GuguGallery_<version>_x64-setup.exe
```

---

## 三、打包工具链（一次性准备，本机已完成）

Tauri 的 NSIS 打包需要三样东西，其中两样来自 GitHub Release 资产：

| 东西 | 来源 | 缓存位置（本机） |
| --- | --- | --- |
| NSIS 3.11 工具链（`nsis-3.11.zip`，2.36 MB，SHA1 `EF7FF7…0BB10D`） | GitHub 资产 | `%LOCALAPPDATA%\tauri\NSIS\` |
| `nsis_tauri_utils.dll`（v0.5.3，SHA1 `75197F…49B860`） | GitHub 资产 | `%LOCALAPPDATA%\tauri\NSIS\Plugins\x86-unicode\additional\` |
| `MicrosoftEdgeWebview2Setup.exe`（1.84 MB） | 微软（可达） | `%LOCALAPPDATA%\tauri\` |

**本机已经放好**（共 ~9.7 MB）：打包器发现目录存在且必需文件齐全就跳过下载，打包阶段不再需要联网。

校验（可选，确认缓存没坏）：

```bash
sha1sum "$LOCALAPPDATA/tauri/NSIS/Plugins/x86-unicode/additional/nsis_tauri_utils.dll"
# 期望 75197fee3c6a814fe035788d1c34ead39349b860
```

### 换机器 / 清空缓存后的两种补法

**A. 走镜像**（`ghproxy.net` 实测可用，二选一）：

```bash
# 基础镜像：打包器会把 GitHub URL 直接当成路径拼在后面
export TAURI_BUNDLER_TOOLS_GITHUB_MIRROR=https://ghproxy.net

# 或模板镜像：<owner>/<repo>/<version>/<asset> 四个占位符
export TAURI_BUNDLER_TOOLS_GITHUB_MIRROR_TEMPLATE='https://ghproxy.net/https://github.com/<owner>/<repo>/releases/download/<version>/<asset>'
```

> 打包器只对 `https://github.com/…` 开头的 URL 套镜像；同时也接受 `HTTPS_PROXY`/`ALL_PROXY`
> 这类标准代理环境变量。`--use-local-tools-dir` 则可以把工具链放进项目目录而不是用户缓存。

**B. 完全离线：手工放缓存**（下载在别的机器/浏览器里做，把文件搬过来）：

```bash
cd "$LOCALAPPDATA/tauri"
curl -L -o nsis-3.11.zip "https://ghproxy.net/https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip"
curl -L -o nsis_tauri_utils.dll "https://ghproxy.net/https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll"
unzip -q nsis-3.11.zip && rm -rf NSIS && mv nsis-3.11 NSIS
mkdir -p NSIS/Plugins/x86-unicode/additional && mv nsis_tauri_utils.dll NSIS/Plugins/x86-unicode/additional/
curl -L -o MicrosoftEdgeWebview2Setup.exe "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
```

放好后打包器会自动核验 SHA1，校验不过会重下（也说明缓存放错了）。

---

## 四、本地打包

```bash
npm run tauri:build      # = tauri build：先 npm run build:web，再编 Rust，再打 NSIS
```

产物：

| 文件 | 说明 |
| --- | --- |
| `src-tauri/target/release/gugu-gallery.exe` | 主程序（免安装可直接跑，仍需同目录的 WebView2 运行时，Windows 10/11 一般自带） |
| `src-tauri/target/release/bundle/nsis/GuguGallery_<version>_x64-setup.exe` | 安装包（NSIS，可选安装目录，按用户级安装、不需要管理员） |

打包后自检（版本号写进去了没有）：

```powershell
(Get-Item "src-tauri\target\release\bundle\nsis\GuguGallery_0.6.3_x64-setup.exe").VersionInfo | Format-List FileVersion,ProductVersion,CompanyName
```

生成校验清单（随资产一起上传）：

```bash
cd src-tauri/target/release/bundle/nsis && sha256sum GuguGallery_0.6.3_x64-setup.exe > SHA256SUMS.txt && cat SHA256SUMS.txt
```

> 应用**未做代码签名**，SmartScreen 会提示「未知发布者」；安装包体积实测 **2.8 MB**（WebView2 走在线引导程序，运行时本体不打包）。

**windows-gnu 工具链的一个坑：`WebView2Loader.dll`**

它是**动态依赖**，必须跟着 exe 一起装到同一个目录，否则装完双击只会闪一下打不开
（命令行能看到 `error while loading shared libraries: WebView2Loader.dll`）。
打包器只为**显式指定 `-gnu` target** 的构建自动带上它，所以本项目的做法是：
`scripts/release.mjs` 先把 `target/release/WebView2Loader.dll` 复制到 `src-tauri/`，
再由 `tauri.conf.json` 的 `bundle.resources` 把它装到程序目录根。改打包流程时别把这两步弄丢。

**静默安装的坑（Git Bash）**：在 MSYS/Git Bash 里直接
`./GuguGallery_0.7.0_x64-setup.exe /S /D=D:\path` 会被 MSYS 的路径转换吃掉参数，
表现为**退出码 1、什么都没装**。要用：

```bash
cmd //c "release\\GuguGallery_0.7.0_x64-setup.exe /S /D=D:\\path\\to\\dir"
```

---

## 五、把资产挂到 Release 上

前提：**代码与标签先推上去**（SSH 通，这条任何时候都能做）。

```bash
git tag -a v0.7.0 -m "咕咕图库 v0.7.0" && git push origin v0.7.0
```

标签是**不可变的锚点**：同一个 tag 不要重打、不要强推，资产以后可以补传/重传。

### A. 浏览器上传（需要能访问 github.com 的网络/代理）

1. 打开 `https://github.com/LiCo16zy/gugu-gallery/releases`；
2. 若是新版本：`Draft a new release` → 选择已推上来的 tag → 标题写 `咕咕图库 v0.7.0`；
   若是补资产：直接进已有 release → `Edit`；
3. 正文粘贴 `docs/release-notes/v0.7.0.md` 的内容；
4. 把安装包与 `SHA256SUMS.txt` 拖进 `Attach binaries` 区域（大文件进度条走完再保存）；
5. `Publish release`（想先自查就留 Draft，检查完再点 `Publish`）。

### B. `gh` CLI（本机未安装；装好后同样需要能访问 github.com）

```bash
# 首次
gh auth login
# 新建 release 并直接带资产
gh release create v0.7.0 \
  --title "咕咕图库 v0.7.0" \
  --notes-file docs/release-notes/v0.7.0.md \
  src-tauri/target/release/bundle/nsis/GuguGallery_0.7.0_x64-setup.exe \
  src-tauri/target/release/bundle/nsis/SHA256SUMS.txt
# 给已有 release 补/换资产（同名覆盖）
gh release upload v0.7.0 --clobber <文件…>
```

### C. REST API + `curl`（脚本化，需要 Personal Access Token，`contents: write`）

```bash
export GH_TOKEN=ghp_xxx
REPO=LiCo16zy/gugu-gallery
TAG=v0.7.0

# 1) 建 release（也可以先在网页上建好再跳过这步）
curl -sS -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$REPO/releases \
  -d "{\"tag_name\":\"$TAG\",\"name\":\"咕咕图库 $TAG\",\"body\":\"见 docs/release-notes/$TAG.md\"}"

# 2) 取 release id
RID=$(curl -sS -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/$REPO/releases/tags/$TAG | grep -m1 '"id":' | tr -dc 0-9)

# 3) 传资产（uploads.github.com，Content-Type 必须是 octet-stream）
F=src-tauri/target/release/bundle/nsis/GuguGallery_0.7.0_x64-setup.exe
curl -sS -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @"$F" "https://uploads.github.com/repos/$REPO/releases/$RID/assets?name=$(basename "$F")"
```

> 覆盖同名资产：先列 `GET /releases/$RID/assets` 找到 asset id，`DELETE` 掉再传（API 不支持直接覆盖）。

### D. 交给 CI 打包并挂资产（**本机网络限制下的推荐通路**）

本机唯一稳定的 GitHub 通路是 SSH 的 `git push`；**GitHub Actions 的机器上传资产走的是内网**，
所以「本地只推标签、构建与挂资产在云端完成」这条链路完全绕开了本机的 HTTPS 限制。

仓库里加 `.github/workflows/release.yml`（内容如下，可直接复制）：

```yaml
name: release
on:
  push:
    tags: ["v*"]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - uses: dtolnay/rust-toolchain@stable
      - uses: swatinem/rust-cache@v2
        with: { workspaces: src-tauri }
      - run: npm ci
      - run: npm run typecheck && npm test
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "咕咕图库 ${{ github.ref_name }}"
          releaseBody: "见 docs/release-notes/${{ github.ref_name }}.md"
          releaseDraft: true
          prerelease: false
      - name: 校验清单
        shell: pwsh
        run: |
          $dir = "src-tauri/target/release/bundle/nsis"
          Get-ChildItem "$dir/*.exe" | ForEach-Object {
            "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  $($_.Name)"
          } | Set-Content "$dir/SHA256SUMS.txt"
      - name: 挂上校验清单
        shell: bash
        run: gh release upload "${{ github.ref_name }}" src-tauri/target/release/bundle/nsis/SHA256SUMS.txt --clobber
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

用法与注意：

- 本机只需要 `git push origin v0.7.0`（SSH，通）；标签推送后 CI 自动出包并挂成 **Draft Release**，
  网页/代理能上的时候看一眼再 Publish；
- `github.ref_name` 就是标签名，`releaseName`/`releaseBody` 直接对齐；
- CI 里 `npm ci` 依赖已提交的 `package-lock.json`；
- CI 的 `windows-latest` 自带 WebView2 与 Node 20，但**不含 NSIS 工具链** —— 打包器会自己从 GitHub 下
  （GitHub 自己的网络，畅通），本机缓存不需要搬上去；
- 想只在本地验证 CI 能不能过：`workflow_dispatch` 那行可以手动触发一次。

---

## 六、发布前检查清单

- [ ] `package.json` / `tauri.conf.json` 版本一致，且等于要打的 tag（第二节的一行检查脚本）
- [ ] `docs/release-notes/vX.Y.Z.md` 已写好（Release 正文直接用它）
- [ ] `npm test`（30 项）/ `cargo test`（16 项）/ `node scripts/uicheck.mjs`（63 项）全绿
- [ ] 本地打得出版本正确、体积合理的 `GuguGallery_X.Y.Z_x64-setup.exe`
- [ ] `SHA256SUMS.txt` 与安装包一起上传
- [ ] Release 正文与 `README.md` 的「下载 & 安装」段落一致
- [ ] 资产下载回来复核（`sha256sum` 对得上），且**没有覆盖历史 tag 的旧资产**

复核命令（能访问 GitHub 的机器上跑）：

```bash
curl -L -o /tmp/check.exe "https://github.com/LiCo16zy/gugu-gallery/releases/download/v0.7.0/GuguGallery_0.7.0_x64-setup.exe"
sha256sum /tmp/check.exe   # 与 SHA256SUMS.txt 比对
```

---

## 七、当前纪律

重构期间（`refactor/tauri-2` 分支）**不对外发布**：只推分支、不打 tag、不建 Release。
重构验收通过、PR 合并之后再走本文流程。

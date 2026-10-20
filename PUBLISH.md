# 发布指南（GitHub → npm → 插件市场）

面向本仓库维护者。所有命令都在仓库根目录执行（macOS / Linux / WSL 用 sh，Windows 用 PowerShell 均可）：

```sh
cd /path/to/dsh-coding-sound    # 换成你的仓库路径
```

当前包信息：

| 项 | 值 |
|---|---|
| npm 包名 | `dsh-coding-sound`（2026-10-20 查询：registry 返回 404，未被占用） |
| 版本 | `0.1.0` |
| 许可 | MIT（见 `LICENSE`） |
| 安装方式 | `dsh plugin --profile <profile> add dsh-coding-sound` |
| 市场分类 | `voice`（Voice & Audio） |
| 第三方素材 | 无（6 个通知音效全部合成，包内没有 WAV） |

> 示例里的 GitHub 地址按 `mhlywxl/dsh-coding-sound` 写。换成别的 owner/repo 时，务必同步修改
> `package.json` 的 `repository` / `homepage` / `bugs`、下面的 catalog 条目，以及（如果连包名也换）
> `package.json.name`、`cordis.patch.yml` 的 `name:`、`build.mjs` 的 `PACKAGE` 常量并重新构建。

---

## 0. 发布前本地检查（不需要联网）

```sh
node build.mjs --check   # client.js 必须与 src/ 一致
node test.mjs            # 36 项离线测试
npm pack --dry-run       # 看最终会进入 npm 包的文件列表
```

`npm pack --dry-run` 的输出里应当有：

`package.json`、`index.js`、`client.js`、`src/*.js`、`cordis.patch.yml`、`icon.svg`、
`locale/en.json`、`locale/zh.json`、`README.md`、`LICENSE`、`build.mjs`、`test.mjs`

不应当出现：`node_modules`、`*.log`、任何 `.wav`、`assets/`。

如果 `build.mjs --check` 报 stale，先 `node build.mjs` 再提交。

---

## 1. 建立 GitHub 仓库

### 1.1 补全 `package.json` 元数据

仓库创建后，在 `package.json` 顶层加入（把 owner/repo 换成你的）：

```json
"repository": { "type": "git", "url": "git+https://github.com/mhlywxl/dsh-coding-sound.git" },
"homepage": "https://github.com/mhlywxl/dsh-coding-sound#readme",
"bugs": { "url": "https://github.com/mhlywxl/dsh-coding-sound/issues" }
```

### 1.2 推送本地仓库

本轮已经执行过 `git init -b main` 和首个提交；远程仓库建好后：

```sh
git remote add origin https://github.com/mhlywxl/dsh-coding-sound.git
git push -u origin main
```

如果改用 GitHub 网页新建仓库，**不要**勾选 “Add a README / .gitignore / license”（本地已经有这些文件），
否则首次 push 会冲突。

### 1.3 仓库设置

- Description：`Generative background music and notification chimes for DeepSeek Harness.`
- Topics：`dsh-plugin`、`deepseek-harness`、`dsh`、`web-audio`、`audio`
  （**`dsh-plugin` 是市场 CI 的硬性要求**）
- 建议开启 Issues，`bugs.url` 指向它。

### 1.4 tag / Release

用 `release.yml` 时这一步自动完成：`publish` 成功后创建 `v<version>` tag 与 GitHub Release
（Release 正文由 `--generate-notes` 生成）。**不要**在本地再打同名 tag。

只有完全不用 Actions、纯手工发布时才需要：

```sh
git tag v0.1.0
git push origin v0.1.0
```

然后在 GitHub 上基于 `v0.1.0` 建 Release，正文写：

```markdown
Initial release.

- Token-driven generative background music (4 presets, per-session voices)
- Separate completion, approval and attention chimes (6 synthesized options)
- Per-phase sounds: thinking / answer / tool execution, each with its own rate and pitch
- Hear whether the agent is thinking, still working, or waiting for you without watching the screen
- Settings card under Settings → Sound & alerts
```

> 市场条目只需要仓库；Release 不是必需项，但用户和 CI 都会更容易核对版本。

---

## 2. 发布到 npm

> 常规流程：配好 Trusted Publishing（推荐，见第 5 节）或 `NPM_TOKEN` 后，在 Actions 里手动 Run workflow，
> `release.yml` 完成发布（带 provenance）。
> 想恢复 push 到 `main` 自动发布，把 `release.yml` 的 `on:` 加回 `push: branches: [main]` 即可。
> 本节是**手动兜底**——Actions 不可用、或需要立即补发时使用。

### 2.1 登录

```sh
npm login
npm whoami
```

需要 2FA 的账号按提示走。发布前确认 registry：

```sh
npm config get registry     # 应为 https://registry.npmjs.org/
```

### 2.2 发布

```sh
npm publish
```

未 scoped 的包默认就是 public，不需要 `--access public`。
发布成功后核对：

```sh
npm view dsh-coding-sound version
npm view dsh-coding-sound dist.tarball
```

### 2.3 用一个干净 profile 验证“从 npm 安装”

不要动现在能用的 desktop profile（它是指向本地目录的 link）。另建一个临时 profile：

```sh
dsh plugin --profile sound-check add dsh-coding-sound
```

启动该 profile，确认：设置里出现「声音与提醒」、试听有声音、控制台无 `[coding-sound]` 报错。
所有 6 个通知音效都应发声——包内没有 WAV，四个命名选项现在是合成音型。

### 2.4 包名被占用怎么办

如果发布前发现 `dsh-coding-sound` 被别人注册：

1. 改用 `@mhlywxl/dsh-coding-sound`（或别的名字）；
2. 同步改 `package.json.name`、`cordis.patch.yml` 里的 `name:`、`build.mjs` 的 `PACKAGE` 常量；
3. `node build.mjs && node test.mjs` 后重新提交；
4. 用户安装命令和 catalog 条目里的 `name` 都要换成新包名。

---

## 3. 提交到插件市场（Awesome DSH Plugin）

> 常规流程已自动化：`release.yml` 的 `catalog` job 会 fork 市场仓库、写下面这个 YAML、开 PR
> （需要 `MARKET_TOKEN`，且仓库满 1 天）。本节说明它会提交什么，以及不能跑 Actions 时怎么手工做。

市场本体（dshmarket）不维护插件列表；列表来自
[awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，
它同时被发布成 `dsh-plugin-catalog` npm 包并生成
`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`（format-1 市场索引）。

### 3.1 硬性条件

- 仓库里有 `dsh.bundle` 清单（本仓库有：`package.json` 的 `dsh.bundle.patch`）。
- 仓库里放 `cordis.patch.yml`（本仓库有）。
- 仓库是真实、可安装、可运行的代码，描述与代码一致。
- **仓库创建满 1 天**（CI 自动检查，PR 前几分钟才建好的仓库会被拒）。
- 仓库带 `dsh-plugin` topic。
- 一次 PR 最多 3 条；只改自己那一行。

### 3.2 新增一个 YAML 文件

Fork 上面那个仓库，新增文件：

`data/plugins/mhlywxl__dsh-coding-sound.yml`

```yaml
url: https://github.com/mhlywxl/dsh-coding-sound
name: mhlywxl/dsh-coding-sound
category: voice
description:
  en: 'Generative background music while the model streams, plus completion, approval and attention chimes: hear whether the agent is thinking, still working, or waiting for you without watching the screen.'
  zh: '模型输出时演奏生成式背景音乐，完成、审批与等待操作各有独立提示音：不盯屏幕也能听出 Agent 在思考、仍在工作还是在等你。'
```

注意：

- `description` 里出现 `: `（冒号+空格）时整行必须加引号，否则 YAML 解析失败。
- 描述是“对插件的声明”，会被逐条对照代码核验，不要写做不到的数字或功能。
- `category` 用 `voice`（Voice & Audio）。若维护者认为更合适的分类，他们会直接改，不会因此打回。
- 中文可选；不写也会由维护者补，但建议写。

### 3.3 提 PR

标题示例：`Add mhlywxl/dsh-coding-sound`

PR 正文写清楚：插件做什么、npm 包名、如何安装、已自测的操作系统/DSH 版本。

CI 依次检查：条目数 → `dsh.bundle` → 仓库年龄 → awesome-lint / 站点构建。
失败会给出具体要改的地方，在同一分支继续 push 即可。

### 3.4 合并之后

- 站点与 catalog 在合并后自动重建，通常一天内出现在市场里；
- dshmarket 与 `Plugins → Discover` 会读取同一份索引；
- 之后的版本更新**不需要**再改 catalog 条目（条目指向仓库，版本从 npm 自动取），
  除非仓库地址、描述或分类变了。

### 3.5 可选：市场截图

在 `package.json` 同级放 `screenshots.json`，列出 1–8 张图片路径（相对仓库根）：

```json
["assets/screenshot-settings.png"]
```

建议至少一张「设置 → 声音与提醒」卡片、一张桌面/深色主题的对照图。截图可以由你在 DSH 里截好后放进
`assets/` 并提交；**不要**把 `assets/` 加进 `package.json.files`，它只用于市场展示。

---

## 4. 版本迭代流程（手动触发发布）

仓库带 `.github/workflows/release.yml`：目前由 Actions → release → **Run workflow** 触发，
依次执行 **测试 → npm 发布 → 建 tag/Release → 提插件市场 PR**。每一步幂等，重跑安全。
首版发布前需要配好 npm 认证（Trusted Publishing 或 `NPM_TOKEN`）与 `MARKET_TOKEN`（见第 5 节）；配好并验证后，若想改回
push 到 `main` 自动发布，恢复 `release.yml` 的 `push: branches: [main]` 触发即可。

```sh
# 1) 改代码并自检
node build.mjs
node test.mjs

# 2) 只升版本号（不要在本机打 tag：tag 由 CI 创建）
npm version patch --no-git-tag-version

# 3) 提交并推送
git add -A
git commit -m "release: 0.1.1"
git push origin main

# 4) 到 Actions → release → Run workflow 手动发布
```

- 不要在本机 `npm publish`，也不要在本机 `git tag v*` + `push --tags`；
- 版本号没升就 push，CI 会识别「该版本已发布」并跳过；
- 市场条目指向仓库本身，升版本**不需要**重新提 PR；只有仓库地址、描述或分类变了才要手动更新。

兼容性建议：若以后新增对官方 `@deepseek-ai/*` 包的 import，把它们写进 `peerDependencies`，
并且预发布分支要显式写，例如：

```json
"peerDependencies": {
  "@deepseek-ai/dsh-client-ui-settings": ">=0.0.1-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.3.0-0"
}
```

只写 `>=0.1.7-rc.2 <0.3` 这类范围会静默排除所有预发布版本，用户会遇到 `ERESOLVE`。

---

## 5. 自动化发布：Trusted Publishing（推荐）与 Secret

两个工作流：

| 文件 | 触发 | 作用 |
|---|---|---|
| `.github/workflows/test.yml` | 任意 push / PR | `node test.mjs` + `node build.mjs --check` |
| `.github/workflows/release.yml` | 手动 Run workflow（Secret 配好后可恢复 push 到 `main`） | 测试 → npm 发布（OIDC + provenance）→ GitHub Release → 市场 PR |

### 5.1 推荐：Trusted Publishing（不再需要 npm token）

npm CLI 在 CI 里会**优先使用 OIDC**，配置一次后可以删掉 `NPM_TOKEN`。步骤：

1. 打开 <https://www.npmjs.com/package/dsh-coding-sound> → 右上 **Settings** → **Trusted Publisher**
2. **Select your publisher** 选 **GitHub Actions**，填：
   - Organization or user：`mhlywxl`
   - Repository：`dsh-coding-sound`
   - Workflow filename：`release.yml`（只写文件名，不带路径）
   - Environment name：留空
   - **Allowed actions**：勾选 **`npm publish`**。2026-09-03 之后新建的配置默认只允许 `npm stage publish`，
     不勾这一项时 `npm publish` 会被拒绝。
3. 确认 OIDC 发布成功后再删除仓库 Secret `NPM_TOKEN`，并到 npm 的 Access Tokens 里吊销旧 token。

注意：

- **已知阻塞（2026-10）**：2026-07-15 之后创建的 GitHub 仓库，OIDC token 使用 immutable subject claims
  （`repo:owner@id/repo@id:ref:...`）。npm registry 的受信发布者查找暂不认这个格式，会返回
  `OIDC token exchange error - package not found`（npm/cli#9969），与上面的配置无关；GitHub 侧该格式无法关闭。
  修复前请继续使用 `NPM_TOKEN`（受信发布者配置可以保留，npm 修复后删掉 token 即可）。
- Trusted Publishing 需要 `npm` CLI ≥ 11.5.1、Node ≥ 22.14；`release.yml` 已固定 Node 24（自带 npm 11.x）。
- 用 CLI 配置（`npm trust github ... --file release.yml --allow-publish`）要求**未启用 bypass 的 2FA 登录会话**；
  bypass GAT 会被直接 403 拒绝。网页配置最省事。
- 一个包最多 10 个受信发布者；配置建好后不能原地改，需要先 `npm trust revoke --id <id>` 再重建。
- 发布后 npm 需要几分钟到最长约 1 小时处理新包；期间 registry 只显示 `0.0.0-stage` 占位版本，属正常现象，
  处理完成会自动替换成真实版本。

### 5.2 兼容方案：NPM_TOKEN

Trusted Publishing 不可用（或尚未配好）时，用仓库 Secret 发版（Settings → Secrets and variables → Actions）：

| Secret | 作用 | 生成方式 |
|---|---|---|
| `NPM_TOKEN` | 发 npm 包 | Granular Access Token：Read and write（publish and stage）、All packages、Bypass 2FA；有效期 ≤ 90 天 |
| `MARKET_TOKEN` | fork `awesome-dsh-plugin/awesome-dsh-plugin` 并开 PR | GitHub classic PAT，只勾 `public_repo` |

> 带直接发布权限的 bypass token 将在 **2027 年 1 月**停止支持，届时必须使用 Trusted Publishing；
> 另外这类 token 出现在日志或聊天里就应立刻吊销重发。

### 5.3 其他前置条件与市场

- 仓库必须是 **Public**（npm provenance 与市场收录都要求）；
- 仓库需要 `dsh-plugin` topic；市场 CI 还会检查仓库是否满 1 天（未满时 `catalog` 自动推迟，不会失败）；
- `package.json.repository` 必须指向本仓库，否则工作流在发布前直接报错；
- `GITHUB_TOKEN` 由 Actions 自动提供，无需配置。

仓库刚建好时 `catalog` 任务会推迟（市场要求仓库满 1 天），Summary 里会给出重跑时间；
之后在 Actions 页手动 Run workflow 即可补提。

完整的一次性手动清单（建仓库、Secret、Topics、首次发布、失败对照）放在工作区根目录的
`GITHUB-SETUP.md`，它不随仓库发布；如果希望它跟着仓库走，把该文件复制进本目录并提交即可。

---

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| `npm publish` 报 403 / 需要 OTP | 重新 `npm login`，按提示输入一次性验证码；确认 `registry` 指向 npmjs |
| 市场里搜不到 | ① 目录 PR 还没合并；② 仓库不满 1 天；③ 缺 `dsh-plugin` topic；④ 只在 GitHub、没有 npm 版本（Discover 索引优先展示有 npm 版本的条目） |
| 市场安装后没有声音 | 打开浏览器控制台看 `[coding-sound]`；确认浏览器允许音频、页面有过一次点击（自动播放策略）；确认通知音量 > 0、对应选项不是「关闭」 |
| 设置页没有「声音与提醒」 | 插件未启用或 Host 未重启；检查 `Settings → Plugins` 里 `dsh-coding-sound` 是否 enabled |
| `dsh plugin add` 失败 | 确认包已发布且 `npm view dsh-coding-sound version` 有值；旧版本缓存可清 pnpm store 后重试 |
| 发布后 npm 只显示 `0.0.0-stage` | npm 正在处理新包（首次最长约 1 小时）；占位版本会自动被真实版本替换，别在此期间判断失败 |
| `npm trust` 报 403 | 该命令不接受 bypass GAT；改用网页 Settings → Trusted Publisher，或先 `npm login` 建立带 2FA 的会话 |
| 发布后发现忘了改版本 | npm 不允许覆盖同一个版本号；`npm version patch` 后重新 `npm publish`，必要时 `npm deprecate` 旧版本 |
| 误把 WAV 加回仓库 | 不要提交；当前实现全部合成，包内不应出现音频素材 |

---

## 7. 发布检查清单

- [ ] `node build.mjs --check` 通过
- [ ] `node test.mjs` 全绿
- [ ] `npm pack --dry-run` 文件列表正确（无 WAV、无 logs、有 LICENSE）
- [ ] `package.json` 已去掉 `private`，版本号正确
- [ ] `repository` / `homepage` / `bugs` 已填，且与 GitHub 仓库一致
- [ ] GitHub 仓库是 Public，有 `dsh-plugin` topic，Description 准确
- [ ] Trusted Publisher 已绑定（或 `NPM_TOKEN` 仍有效），`MARKET_TOKEN` 已配置
- [ ] 首次发布后等待 `0.0.0-stage` 被真实版本替换，再对外宣传
- [ ] 手动 Run workflow 后 `release` 全绿；npm 上能看到该版本
- [ ] 仓库满 1 天后重跑 workflow，`catalog` 给出市场 PR 链接
- [ ] 合并后用干净 profile 安装验证；catalog PR 只新增一条自己的条目
- [ ] Release / tag 与 npm 版本一致（由 CI 创建，不需要手工补）

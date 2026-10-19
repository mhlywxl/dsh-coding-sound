# 发布指南（GitHub → npm → 插件市场）

面向本仓库维护者。所有命令都在仓库根目录执行（Windows PowerShell）：

```powershell
cd D:\dev\harness\dsh-coding-sound
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

```powershell
node build.mjs --check   # client.js 必须与 src/ 一致
node test.mjs            # 33 项离线测试
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

```powershell
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

### 1.4 打 tag / Release（可选，但推荐）

```powershell
git tag v0.1.0
git push origin v0.1.0
```

在 GitHub 上基于 `v0.1.0` 建 Release，正文写：

```markdown
Initial release.

- Token-driven generative background music (4 presets, per-session voices)
- Separate completion and attention chimes (6 synthesized options)
- Notification volume plus current/other session music volumes
- Settings card under Settings → Sound
```

> 市场条目只需要仓库；Release 不是必需项，但用户和 CI 都会更容易核对版本。

---

## 2. 发布到 npm

### 2.1 登录

```powershell
npm login
npm whoami
```

需要 2FA 的账号按提示走。发布前确认 registry：

```powershell
npm config get registry     # 应为 https://registry.npmjs.org/
```

### 2.2 发布

```powershell
npm publish
```

未 scoped 的包默认就是 public，不需要 `--access public`。
发布成功后核对：

```powershell
npm view dsh-coding-sound version
npm view dsh-coding-sound dist.tarball
```

### 2.3 用一个干净 profile 验证“从 npm 安装”

不要动现在能用的 desktop profile（它是指向本地目录的 link）。另建一个临时 profile：

```powershell
dsh plugin --profile sound-check add dsh-coding-sound
```

启动该 profile，确认：设置里出现「声音」、试听有声音、控制台无 `[coding-sound]` 报错。
所有 6 个通知音效都应发声——包内没有 WAV，四个命名选项现在是合成音型。

### 2.4 包名被占用怎么办

如果发布前发现 `dsh-coding-sound` 被别人注册：

1. 改用 `@mhlywxl/dsh-coding-sound`（或别的名字）；
2. 同步改 `package.json.name`、`cordis.patch.yml` 里的 `name:`、`build.mjs` 的 `PACKAGE` 常量；
3. `node build.mjs && node test.mjs` 后重新提交；
4. 用户安装命令和 catalog 条目里的 `name` 都要换成新包名。

---

## 3. 提交到插件市场（Awesome DSH Plugin）

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
  en: Token-driven generative background music while the model streams, plus separate completion and attention chimes with per-session volumes in a settings card.
  zh: 模型输出时演奏生成式背景音乐，完成与等待操作各有独立提示音；设置卡片里可调通知音量与当前/其他会话音量。
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

建议至少一张「设置 → 声音」卡片、一张桌面/深色主题的对照图。截图可以由你在 DSH 里截好后放进
`assets/` 并提交；**不要**把 `assets/` 加进 `package.json.files`，它只用于市场展示。

---

## 4. 版本迭代流程

```powershell
# 1) 改代码
node build.mjs
node test.mjs

# 2) 升版本（会改 package.json 并打 tag）
npm version patch     # 或 minor / major

# 3) 推送代码与 tag
git push
git push --tags

# 4) 发布
npm publish

# 5) GitHub Release 填 npm version 输出里的新 tag
```

兼容性建议：若以后新增对官方 `@deepseek-ai/*` 包的 import，把它们写进 `peerDependencies`，
并且预发布分支要显式写，例如：

```json
"peerDependencies": {
  "@deepseek-ai/dsh-client-ui-settings": ">=0.0.1-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.3.0-0"
}
```

只写 `>=0.1.7-rc.2 <0.3` 这类范围会静默排除所有预发布版本，用户会遇到 `ERESOLVE`。

---

## 5. 可选：让仓库自己跑测试

仓库已带 `.github/workflows/test.yml`（无依赖，直接 `node test.mjs`）。
push 后在 GitHub 的 Actions 页看结果即可；本地网络不通不影响它。

---

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| `npm publish` 报 403 / 需要 OTP | 重新 `npm login`，按提示输入一次性验证码；确认 `registry` 指向 npmjs |
| 市场里搜不到 | ① 目录 PR 还没合并；② 仓库不满 1 天；③ 缺 `dsh-plugin` topic；④ 只在 GitHub、没有 npm 版本（Discover 索引优先展示有 npm 版本的条目） |
| 市场安装后没有声音 | 打开浏览器控制台看 `[coding-sound]`；确认浏览器允许音频、页面有过一次点击（自动播放策略）；确认通知音量 > 0、对应选项不是「关闭」 |
| 设置页没有「声音」 | 插件未启用或 Host 未重启；检查 `Settings → Plugins` 里 `dsh-coding-sound` 是否 enabled |
| `dsh plugin add` 失败 | 确认包已发布且 `npm view dsh-coding-sound version` 有值；旧版本缓存可清 pnpm store 后重试 |
| 发布后发现忘了改版本 | npm 不允许覆盖同一个版本号；`npm version patch` 后重新 `npm publish`，必要时 `npm deprecate` 旧版本 |
| 误把 WAV 加回仓库 | 不要提交；当前实现全部合成，包内不应出现音频素材 |

---

## 7. 发布检查清单

- [ ] `node build.mjs --check` 通过
- [ ] `node test.mjs` 全绿
- [ ] `npm pack --dry-run` 文件列表正确（无 WAV、无 logs、有 LICENSE）
- [ ] `package.json` 已去掉 `private`，版本号正确
- [ ] `repository` / `homepage` / `bugs` 已填
- [ ] GitHub 仓库有 `dsh-plugin` topic，Description 准确
- [ ] 仓库创建满 1 天后再提 catalog PR
- [ ] npm 已发布，并用干净 profile 安装验证
- [ ] catalog PR 只新增 `data/plugins/mhlywxl__dsh-coding-sound.yml`
- [ ] Release / tag 与 npm 版本一致

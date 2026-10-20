# 项目记忆 / Project memory

> 给后续开发者和 Agent 使用的项目内记忆。npm 包不包含此文件（不在 `package.json` 的 `files` 里）。
> 最后更新：2026-10-20

## 身份与提交约定（强约束）

- 本仓库所有 commit 的 author / committer 必须是：
  - name: `mhlywxl`
  - email: `990560853@qq.com`
- 只使用**仓库本地**配置，禁止修改全局 git 配置，也不要依赖机器默认身份：

  ```powershell
  git config --local user.name mhlywxl
  git config --local user.email 990560853@qq.com
  ```

- 本机全局配置保持不动，也不要用它提交（仓库公开，不要在文件里记录个人/工作邮箱）。
- 2026-10-20 已用 `git filter-branch` 重写历史：6 个提交全部改为上述身份，`refs/original` 与 reflog 已清理。
- 提交前可检查：

  ```powershell
  git config --local --get user.name
  git config --local --get user.email
  git log -1 --format='%an <%ae> | %cn <%ce>'
  ```

## 项目

- 名称：`dsh-coding-sound`（DeepSeek Harness 插件）
- 路径：`D:\dev\harness\dsh-coding-sound`
- 功能：生成式背景音乐 + 完成/等待通知音效 + 阶段声音设置 + 声音设置卡片
- 版本：`0.1.0`；MIT；无第三方音频素材（全部 Web Audio 合成）
- 安装：`dsh plugin --profile desktop add dsh-coding-sound`；本地开发用 `link:`
- 构建 / 测试：`node build.mjs`、`node test.mjs`（33 项）
- 发布步骤：见 [PUBLISH.md](PUBLISH.md)

## 发布流水线（CI）

- `.github/workflows/test.yml`：任意 push / PR 跑 `node test.mjs` + `node build.mjs --check`。
- `.github/workflows/release.yml`：push `main` 或手动 Run workflow，四个幂等 job：
  `verify`（构建一致性 + 33 项测试 + `npm pack --dry-run`）→ `publish`（版本已在 registry 则跳过，
  `--provenance --access public`）→ `release`（建 `v<version>` tag 与 Release）→
  `catalog`（fork `awesome-dsh-plugin/awesome-dsh-plugin`，写 `data/plugins/<owner>__<repo>.yml`，开 PR）。
- 需要的仓库 Secret：`NPM_TOKEN`（npm granular/automation token）、`MARKET_TOKEN`（classic PAT，
  `public_repo`）。`GITHUB_TOKEN` 自动提供。仓库必须 Public；`package.json.repository` 必须与
  `github.repository` 一致，否则 `publish` 前置检查直接失败。
- 仓库创建不满 1 天时 `catalog` 不失败、只推迟（市场 CI 硬要求），Summary 里给重跑时间；
  仓库变量 `FORCE_CATALOG_PR=true` 可强制。条目已收录 / 已有 open PR 时同样跳过。
- 版本迭代：`npm version patch --no-git-tag-version` → 提交 → push。不在本地 `npm publish`、
  不在本地打 `v*` tag（CI 会建）。
- 手动步骤清单在**工作区根目录** `D:\dev\harness\GITHUB-SETUP.md`（有意不进仓库、不进 npm 包）。

## 关键决策

- **通知音效全部合成**：`assets/`、Host 音频路由、4 个 WAV 素材均已删除（TODO 决策 D4 完成）。
- **设置保存在浏览器**（`localStorage` 键 `dsh:coding-sound:v1`），不是 Host `Config`；`SettingsStore` 已预留 Host 默认值基线。
- **阶段声音**：
  - 思考 / 回答按字数密度（默认 2 / 4 字一拍）+ 音高（低/标准/高）+ 独立开关；
  - 工具执行按“当前会话空闲 1.2 s 后”的工作脉冲（慢 1.4 s / 标准 0.9 s / 快 0.55 s / 关闭）；
  - 被关闭阶段的文字仍算活动，工作脉冲不会补进来。
- **非当前会话**用环境脉冲（0.7–1.1 s），因为浏览器只能看到当前会话的 DOM，拿不到其它会话的逐 token 信号。
- **设置导航图标**：宿主按 section id 硬编码图标，未知 id 用齿轮；插件在 label 内放扬声器图标，并用 `button:has(> span [data-coding-sound-nav]) > svg` 隐藏兜底齿轮。
- **测试台**：`test.mjs` 用 Node 内置 `node:test`，无依赖；覆盖预设参数、设置归一化、去重、会话边沿、阶段相位、Host 无路由、构建产物的离线装配与渲染。

## 上线待办

- 刷新桌面页面，确认导航扬声器图标与三行阶段试听。
- 建 GitHub 仓库（Public）、补 `repository` / `homepage` / `bugs`、加 `dsh-plugin` topic。
- 配 `NPM_TOKEN` 与 `MARKET_TOKEN` 两个 Secret，push `main` 触发 `release.yml`。
- 仓库满 1 天后重跑 workflow 自动提市场 PR；合并后市场可见。
- 可选：市场截图 `screenshots.json`（1–8 张图），以及 npm trusted publishing（可删掉 `NPM_TOKEN`）。

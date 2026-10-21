# dsh-coding-sound

**中文（默认）** · [English](#english)

DeepSeek Harness（DSH）声音插件：**用声音盯住 Agent**。模型输出时演奏**生成式背景音乐**，完成、审批/等待、思考与工具执行各有可配置的**提示音**——不盯着屏幕，也能凭声音知道它是在思考、还在干活、还是卡在等你。

**关键词**：DeepSeek Harness 声音插件 · 背景音乐 · 提示音 · 完成提醒 · 审批提醒 · 通知音效 · 声音反馈 · 专注 · 注意力 · 效率 · AI 助手声音提醒
`background music` · `notification sound` · `completion chime` · `approval alert` · `focus` · `attention` · `productivity` · `dsh sound plugin`

## 快速开始

### 先选运行方式

| 方式 | 适用场景 | 插件安装位置 |
| --- | --- | --- |
| Web（`dsh web`，浏览器打开） | 在浏览器里使用、远程机器 | `web` profile |
| 桌面端 DSH Desktop（`dsh-app://`） | 日常使用，推荐 | `desktop` profile，由桌面端管理 |

- 支持 DSH 0.2.0 / 0.2.1，当前针对 0.2.1-rc.2 构建。
- 没有原生依赖、没有安装脚本，`client.js` 已预构建，macOS / Windows / Linux 行为一致。
- 运行时不联网：所有声音由 Web Audio 实时合成，包内没有音频素材。

### Web：在线安装

```sh
dsh plugin --profile web add dsh-coding-sound
dsh --profile web
```

`dsh --profile web` 会打印带 token 的地址；如果服务已经在运行，安装后重启它，再硬刷新页面。

### Web：离线安装

在联网机器打包，或从 GitHub Release 下载 `.tgz`，拷到目标机器：

```sh
# 联网机器
npm pack dsh-coding-sound

# 目标机器：.tgz 绝对路径
dsh plugin --profile web add /absolute/path/dsh-coding-sound-<version>.tgz

# 或者解压后安装目录
dsh plugin --profile web add /absolute/path/dsh-coding-sound
dsh --profile web
```

- 只有源码 ZIP 时，先解压；发布包已经包含 `lib/client.js`，通常不需要再构建。目录根下必须能直接看到 `package.json`。
- 目标机器不需要访问 npm，也不需要访问 GitHub。

### Desktop：在线安装

1. 打开 DSH Desktop，侧边栏 **插件市场** 搜索 `dsh-coding-sound` 并安装；或进入 **插件 → 添加插件 → 安装第三方插件**，填入包名。
2. 打开 **设置 → 插件**，启用 `dsh-coding-sound`。
3. **完全退出并重开 DSH Desktop**，新的客户端 bundle 才会生效。

> 桌面端的 `desktop` profile 由 Electron 应用独占管理。不要在终端执行 `dsh plugin --profile desktop add ...`，该命令会被拒绝；桌面端请用插件市场 / 添加插件界面。

### Desktop：离线安装

1. 在联网机器执行 `npm pack dsh-coding-sound`，或从 Release 下载 `.tgz`，拷到目标机器。
2. DSH Desktop → **插件 → 添加插件 → 安装第三方插件**：
   - 优先填 `.tgz` 的**绝对路径**（安装器识别为「压缩包」）；
   - 如果当前版本只接受目录，先解压 `.tgz`，再填解压后的目录（根下要有 `package.json`）。
3. 在 **设置 → 插件** 启用，完全退出并重开 DSH Desktop。
4. 离线机器不需要网络；插件运行时也不联网。

### 启用与验证

- **设置 → 插件** 中确认 `dsh-coding-sound` 已启用；桌面端完整重启，Web 端重启 `dsh web` 并刷新。
- 打开 **设置 → 声音与提醒**，应能看到音乐预设、通知音效和音量选项。
- 点任一音效的试听按钮；再发一条消息，确认完成/等待提示音会响。
- 没有声音时：先检查系统音量、插件里的音乐/通知音量是否为 0；Safari 首次播放需要先点一下页面（浏览器自动播放策略）。

## 为什么装它

- **不用一直盯着屏幕**：音乐跟着模型正在输出的文字走，停下来那一刻你听得到；思考、回答、工具执行三个阶段的声音可以分别调。
- **减少「AI 在等你」**：审批与提问会响一次独立的「等待操作」提示音，切到别的窗口也不会漏掉。
- **保持节奏感**：音符由正在输出的文字驱动，快慢就是它的工作节奏——它还在动，你就听得到。
- **不打扰**：全部用 Web Audio 在浏览器里合成，包内没有任何音频素材；音乐、通知音量、每个阶段的频率与音高都能单独关闭或调整。

> Generative background music and notification chimes for DeepSeek Harness: hear whether the agent is thinking, still working, or waiting for you, without watching the screen. Every sound is synthesized in the browser with Web Audio — the package ships no audio assets.

设置页新增一页「声音与提醒」，卡片与参考桌面版的声音设置同构：

```
🔊 声音与提醒                                  [已自定义]  ⌃
   背景音乐与完成/等待提示音
─────────────────────────────────────────────────────────
生成式背景音乐   [数字        ⌄]  ▶
通知音量         ────────────●  100%
生成完成         [合成音效    ⌄]  ▶
等待操作         [合成音效    ⌄]  ▶
当前会话音量     ────────────●  100%
其他会话音量     ──────────●──   80%

🔊 阶段声音
   思考 / 回答 / 工具执行，可分别关闭、调频率与音高
─────────────────────────────────────────────────────────
思考        [●]   [2 字/拍 ⌄]   [标准 ⌄]   ▶
回答正文    [●]   [4 字/拍 ⌄]   [标准 ⌄]   ▶
工具执行    [●]   [0.9 秒 ⌄]    [标准 ⌄]   ▶
```

左侧设置导航的「声音与提醒」使用扬声器图标：宿主对未知 section id 只提供齿轮兜底，插件在 section 的 label 里带自己的图标，并用一条只命中本行的样式隐藏兜底齿轮（宿主若改结构，最坏退回齿轮 + 扬声器两个图标，不影响功能）。

## 行为

| 场景 | 行为 |
|---|---|
| 某个会话开始输出 | 该会话的音乐淡入（0.25 s）；按当前阶段的密度取拍（回答默认每 4 字、思考默认每 2 字），且两拍间隔 = max(100 ms, 60 + 30 × 密度) ms——密度同时决定「几字一拍」和最快出音速度，所以试听听得到的快慢就是实际运行的速度，C 大调五声音阶随机取音，15% 概率低八度，±5% 随机 detune |
| 输出中 | 节拍跟随真实字符增量，不是固定循环；整段挂载/重渲染/换会话不会被误当打字 |
| 思考（reasoning） | **有**：思考段和回答正文一样逐 token 出音符；可在「阶段声音 → 思考」里改密度（1/2/3/4/6/8 字一拍）、音高（低/标准/高）或关闭 |
| 工具执行 | **有**：工具行本身不出音符；当前会话空闲约 1.2 s 后进入「工作脉冲」，频率可选 0.1 / 0.15 / 0.2 / 0.3 / 0.4 / 0.6 / 0.9 / 1.2 / 1.6 / 2.0 s 一拍（最快与思考密度 1 的 100 ms 相同），音高可选低/标准/高，或关闭。相邻两拍的间隔在设定值上下随机浮动（三角分布，约 ±35%；另有约 15% 概率拉长到 1.6–2.4 倍），听感更像打字机而不是节拍器；行内「随机」开关可以关闭浮动、回到固定节拍。音量与文字拍一致。等待审批时暂停并响「等待操作」 |
| 某个会话进入等待操作 | **只**停这个会话的音乐（0.25 s 淡出），并响「等待操作」；其他会话照常 |
| 一轮结束 | 当前会话 320 ms 防抖后响「生成完成」；子代理会话不响 |
| 切会话 | 当前会话按「当前会话音量」、其他会话按「其他会话音量」，0.25 s 交叉过渡 |
| 其他会话在后台工作 | 以「其他会话音量」播放缓慢的环境脉冲（约 0.7–1.1 s 一拍）；切到该会话后改为逐字节拍 |
| 窗口在后台 | 继续发声；回到前台恢复，不补放积压音符 |

- **阶段声音**独立于主卡片：思考、回答、工具执行各有一个开关，关闭某一阶段后该阶段不出声；被关闭阶段里的文字仍然算作“有活动”，不会让工作脉冲趁机补进来。
- **每行都有试听**：思考/回答的 ▶ 用当前密度与音高播一小段上行音，音与音的间隔就是实际运行时该密度的出音间隔；工具执行的 ▶ 按当前脉冲频率与音高播 2–3 下，开启「随机」时使用同样的随机间隔。试听和实际运行一样，都是满音量（与文字拍相同）。即使背景音乐预设是「关闭」，试听也使用默认预设发声。
- **工作脉冲**只补“没有文字的空窗”：一旦有字符到达就回到逐字节拍，且脉冲不会和文字拍叠加。
- **音乐与通知音完全隔离**：「通知音量」只作用于两个提示音，音乐音量由预设自身的主增益 × 会话音量决定。
- **去重**：「等待操作」按 `turn + prompt` 身份去重（上限 512），断线重连/重放不会重复响；打开页面时已经存在的等待状态不会补响。
- **音频挂起时不排队**：页面/系统把 `AudioContext` 挂起时不再排新音符，恢复后从当前节奏继续。否则挂起期间的所有音符会共用同一个时间戳，恢复瞬间同时发声——听感上就是一声爆音或「沙沙/嗡嗡」的杂音。
- **多窗口**：每个浏览器标签各自发声（未做跨窗口互斥）。

## 默认值

| 项 | 默认 |
|---|---|
| 生成式背景音乐 | 数字（`digital`） |
| 通知音量 | 100% |
| 生成完成 | 合成音效（`synth`） |
| 等待操作 | 合成音效（`synth`） |
| 当前会话音量 | 100% |
| 其他会话音量 | 80% |
| 思考声音 | 开，每 2 字一拍，音高「标准」 |
| 回答声音 | 开，每 4 字一拍，音高「标准」 |
| 工具执行 | 开，脉冲频率 0.9 s（十档：0.1 / 0.15 / 0.2 / 0.3 / 0.4 / 0.6 / 0.9 / 1.2 / 1.6 / 2.0 s），间隔随机浮动（可关闭），音高「标准」 |
| 卡片展开状态 | 展开（持久化） |

设置按**浏览器**保存（`localStorage`），刷新页面、重启 DSH 后仍在；换一个浏览器是另一套设置。
所有值在读取时都会夹紧/校验，损坏或被手改的存储不会让页面报错。

## 音乐预设

| 预设 | 波形 | attack | decay | sustain | release | 低通 | 混响 decay | wet | 主增益 |
|---|---|---|---|---|---|---|---|---|---|
| 空灵 | sine | .1 | .4 | .4 | .8 | 3000 | .8 | .35 | .07 |
| 经典 | triangle | .01 | .2 | .2 | .3 | 2000 | .3 | .2 | .08 |
| 数字 | square | .005 | .1 | .1 | .1 | 5000 | .05 | .05 | .06 |
| 复古 | sawtooth | .02 | .3 | .3 | .4 | 1500 | .35 | .25 | .08 |

信号链：`每会话 gain → 共享低通(Q=1) → 主增益 → 输出`，低通同时旁路 `卷积混响 → wet → 主增益`。
一个页面只有**一个** `AudioContext`（浏览器同时只允许少量），切换预设就地重建链路并重新挂接所有会话声部。

## 通知音效

6 个选项：关闭 / 合成音效 / 正面通知 / 正确提示 / 界面启动 / 界面返回。**全部由 Web Audio 实时合成，包内不含任何第三方音频素材。**

每个音是正弦主音 + 4 倍频 shimmer（12% 电平，衰减到 0.6× 时长）：

| 选项 | 音型 |
|---|---|
| 合成音效 | 完成：1318.5 → 1568 → 2093 Hz；等待：1760 → 1318.5 Hz |
| 正面通知 | 上行二音 1318.5 → 1760 Hz |
| 正确提示 | 确认二音 1046.5 → 1568 Hz |
| 界面启动 | 上行琶音 523.25 → 659.25 → 783.99 → 1046.5 Hz |
| 界面返回 | 下行二音 783.99 → 523.25 Hz |

- 最终增益 = `通知音量 / 100 × 选项电平`；四个命名选项沿用原素材的响度比例（正面 .62 / 正确 .85 / 启动 1 / 返回 .70），切换时不会忽大忽小。
- 「合成音效」按场景区分完成/等待两种音型；四个命名选项对两个场景使用同一段音型（与原素材行为一致）。
- 音量为 0 时两个提示音都不播；浏览器不支持 Web Audio 时设置页给出提示，页面其余功能不受影响。

## 设置与存储

设置保存在浏览器 `localStorage`（键 `dsh:coding-sound:v1`），刷新、重启后仍在；不同浏览器各自独立。Safari 首次出声需要点一下页面，这是浏览器的自动播放策略，插件已处理恢复。

## 兼容性

- 与 `dsh-typewriter-blip`、`ui-beep` 等声音插件可以并存：不共享 DOM 节点，也不改写彼此的 DOM。
- 浏览器不支持 Web Audio 时，设置页会给出提示，页面其余功能不受影响。

## 素材与许可

插件不包含任何第三方音频素材：6 个通知音效全部由 Web Audio 实时合成。源代码以 MIT 许可发布，见 [LICENSE](LICENSE)。

---

## English

**中文简介**：用声音盯住 Agent——模型输出时演奏生成式背景音乐，完成、等待操作、思考与工具执行各有提示音。

Generative background music and notification chimes for DeepSeek Harness (DSH): hear whether the agent is thinking, still working, or waiting for you, without watching the screen.

- **Generative music while the model streams** — notes follow the real character stream, not a fixed loop. Four presets (Ethereal / Classic / Digital / Retro) and one voice per session, so two busy sessions never collide.
- **Separate chimes** — completion and waiting-for-input are distinct; six synthesized options, with a notification volume independent of the music.
- **Per-phase sounds** — thinking, answer and tool execution each have their own switch, a rate (characters per beat or pulse interval) and a pitch; the tool pulse can jitter like a typewriter.
- **Settings card** — Settings → Sound & alerts, with an audition button on every option and separate current/other session volumes.

### Quick start

**Pick where to run it:** Web (`dsh web`, browser, `web` profile) or DSH Desktop
(`dsh-app://`, `desktop` profile managed by the app). DSH 0.2.0 / 0.2.1 are
supported; this build targets 0.2.1-rc.2. The package ships a prebuilt
`client.js`, has no native modules or install scripts, and makes no runtime
network requests.

**Web: online install**

```sh
dsh plugin --profile web add dsh-coding-sound
dsh --profile web
```

**Web: offline install** — pack on a connected machine (`npm pack
dsh-coding-sound`) or download the `.tgz` from a Release, copy it over, then:

```sh
dsh plugin --profile web add /absolute/path/dsh-coding-sound-<version>.tgz
# or, after extracting:
dsh plugin --profile web add /absolute/path/dsh-coding-sound
dsh --profile web
```

For a source ZIP, extract it first; the package root must contain `package.json`
(release tarballs already include `lib/client.js`). The target machine needs
neither npm nor GitHub access.

**Desktop: online install**

1. DSH Desktop → **Plugin market** in the sidebar, search `dsh-coding-sound`,
   install it. Or **Plugins → Add plugin → Install a third-party plugin** and
   enter the package name.
2. **Settings → Plugins** → enable `dsh-coding-sound`.
3. **Quit and reopen DSH Desktop completely.**

> The `desktop` profile is owned by the Electron app. Do **not** run
> `dsh plugin --profile desktop add ...` in a terminal; it is rejected. Use the
> in-app plugin market / Add plugin UI.

**Desktop: offline install**

1. On a connected machine run `npm pack dsh-coding-sound`, or download the
   `.tgz` from a Release, and copy it to the target.
2. DSH Desktop → **Plugins → Add plugin → Install a third-party plugin**:
   enter the **absolute path to the `.tgz`** (recognised as a tarball); if that
   build only accepts directories, extract it and enter the folder (its root
   must contain `package.json`).
3. Enable it in **Settings → Plugins**, then quit and reopen DSH Desktop.
4. The offline machine needs no network access; the plugin makes no runtime
   requests.

**Enable and verify**

- **Settings → Plugins** shows `dsh-coding-sound` enabled. Restart Desktop
  completely, or restart `dsh web` and refresh for Web.
- **Settings → Sound & alerts** should show the music presets, chimes and volume
  controls. Audition an option, then send a message and confirm the completion
  chime plays.
- No sound: check the system volume and the plugin's music/notification volumes
  first. Safari needs one page click before its first sound (autoplay policy).

Defaults: Digital preset, notification volume 100%, "Synth" completion and waiting chimes, current session 100%, other sessions 80%, thinking every 2 characters, answer every 4, tool pulse 0.9 s with the random jitter on.

All sounds are synthesized in the browser with Web Audio — the package ships no audio files. Settings live in the browser's `localStorage` (`dsh:coding-sound:v1`), so each browser keeps its own. MIT.

---

<!-- author-tools:start -->

<!-- generated by scripts/sync-readmes.mjs from projects.json -->

## 同作者的其他插件 · More plugins by the same author

- **[DSH 分屏工作区](https://github.com/mhlywxl/dsh-split-workspace)**（`dsh-split-workspace`）— 把 DSH 会话区拆成任意数量的原生窗格：左右、上下、田字 2×2 与自动网格，每个窗格都是独立会话。
  <br />*[DSH split workspace](https://github.com/mhlywxl/dsh-split-workspace)* (`dsh-split-workspace`) — Split the DSH conversation area into unlimited native panes — side by side, stacked, 2×2 and an automatic grid — each a real session with its own composer and streaming.

## 支持作者 · Support the author

如果这个项目帮你省下了盯屏幕的时间，欢迎请作者喝杯咖啡 ☕，或者给作者「充充电」⚡。金额随意，心意最重要。

*If this project saved you some screen time, you can buy the author a coffee ☕ or top up the author's battery ⚡. Any amount is welcome — the thought counts.*

<p align="center">
  <img src="https://raw.githubusercontent.com/mhlywxl/dsh-coding-sound/main/sponsor/alipay.jpg" alt="支付宝收款码 / Alipay QR code" width="180" />
  <img src="https://raw.githubusercontent.com/mhlywxl/dsh-coding-sound/main/sponsor/wechat.png" alt="微信收款码 / WeChat Pay QR code" width="180" />
</p>
<p align="center"><sub>支付宝 · 微信支付 / Alipay · WeChat Pay</sub></p>

<!-- author-tools:end -->

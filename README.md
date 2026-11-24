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

- 只有源码 ZIP 时，先解压；发布包已经包含 `client.js`，通常不需要再构建。目录根下必须能直接看到 `package.json`。
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
- 打开 **设置 → 声音与提醒**，应能看到三组：**背景音乐**（预设 + 当前/其他会话音乐音量）、**通知提示音**（通知音量 + 完成/等待音效）、**阶段声音**（思考 / 回答正文 / 工具执行）。
- 拖动会话音乐音量滑杆时正在播放的音乐应立刻变小/变大；点任一音效的试听按钮；再发一条消息，确认完成/等待提示音会响。
- 没有声音时：先检查系统音量、插件里的音乐/通知音量是否为 0；背景音乐预设为「关闭」时阶段声音不会在运行中发声（试听仍可用）；Safari 首次播放需要先点一下页面（浏览器自动播放策略）。

## 为什么装它

- **不用一直盯着屏幕**：音乐跟着模型正在输出的文字走，停下来那一刻你听得到；思考、回答、工具执行三个阶段的声音可以分别调。
- **减少「AI 在等你」**：审批与提问会响一次独立的「等待操作」提示音，切到别的窗口也不会漏掉。
- **保持节奏感**：音符由正在输出的文字驱动，快慢就是它的工作节奏——它还在动，你就听得到。
- **听久不累耳**：默认预设换成正弦的「空灵」，音乐链路在预设低通后再过一级 2.5 kHz 的无谐振舒适低通；提示音整体降八度到 261–1046 Hz、泛音从 4 倍降到 2 倍并降低电平——避开人耳最敏感的 2–5 kHz，详见[听感依据](#听感依据)。
- **不打扰**：全部用 Web Audio 在浏览器里合成，包内没有任何音频素材；音乐、通知音量、每个阶段的频率与音高都能单独关闭或调整。

> Generative background music and notification chimes for DeepSeek Harness: hear whether the agent is thinking, still working, or waiting for you, without watching the screen. Every sound is synthesized in the browser with Web Audio — the package ships no audio assets.

设置页新增一页「声音与提醒」，按三类声音分组，音量控件紧挨着它作用的图层：

```
🔊 声音与提醒                                  [已自定义]  ⌃
   背景音乐、阶段声音与完成/等待提示音
─────────────────────────────────────────────────────────
背景音乐
  生成式背景音乐   [空灵        ⌄]  ▶
  当前会话音乐音量 ────────────●  100%
  其他会话音乐音量 ──────────●──   80%
通知提示音
  通知音量         ────────────●  100%  ▶
  生成完成         [合成音效    ⌄]  ▶
  等待操作         [合成音效    ⌄]  ▶

🔊 阶段声音
   背景音乐层的三个阶段：思考 / 回答 / 工具执行，可分别关闭、调频率与音高
─────────────────────────────────────────────────────────
思考        [●]   [2 字/拍 ⌄]   [标准 ⌄]   ▶
回答正文    [●]   [4 字/拍 ⌄]   [标准 ⌄]   ▶
工具执行    [●]   [0.9 秒 ⌄]    [标准 ⌄]   ▶
```

左侧设置导航的「声音与提醒」使用扬声器图标：宿主对未知 section id 只提供齿轮兜底，插件在 section 的 label 里带自己的图标，并用一条只命中本行的样式隐藏兜底齿轮（宿主若改结构，最坏退回齿轮 + 扬声器两个图标，不影响功能）。

## 行为

| 场景 | 行为 |
|---|---|
| 某个会话开始输出 | 该会话的音乐淡入（0.25 s）；按当前阶段的密度取拍（回答默认每 4 字、思考默认每 2 字），且两拍间隔 = max(100 ms, 60 + 30 × 密度) ms——密度同时决定「几字一拍」和最快出音速度，所以试听听起来的速度就是实际运行的速度，C 大调五声音阶随机取音，15% 概率低八度，±5% 随机 detune |
| 输出中 | 节拍跟随真实字符增量，不是固定循环；整段挂载/重渲染/换会话不会被误当打字 |
| 思考（reasoning） | **有**：思考段和回答正文一样逐 token 出音符；可在「阶段声音 → 思考」里改密度（1/2/3/4/6/8 字一拍）、音高（低/标准/高）或关闭 |
| 工具执行 | **有**：工具行本身不出音符；当前会话空闲约 1.2 s 后进入「工作脉冲」，频率可选 0.1 / 0.15 / 0.2 / 0.3 / 0.4 / 0.6 / 0.9 / 1.2 / 1.6 / 2.0 s 一拍（最快与思考密度 1 的 100 ms 相同），音高可选低/标准/高，或关闭。相邻两拍的间隔在设定值上下随机浮动（三角分布，约 ±35%；另有约 15% 概率拉长到 1.6–2.4 倍），听感更像打字机而不是节拍器；行内「随机」开关可以关闭浮动、回到固定节拍。音量与文字拍一致。等待审批时暂停并响「等待操作」 |
| 某个会话进入等待操作 | **只**停这个会话的音乐（0.25 s 淡出），并响「等待操作」；其他会话照常 |
| 一轮结束 | 当前会话 320 ms 防抖后响「生成完成」；子代理会话不响 |
| 切会话 | 当前会话按「当前会话音乐音量」、其他会话按「其他会话音乐音量」，0.25 s 交叉过渡 |
| 其他会话在后台工作 | 以「其他会话音乐音量」播放缓慢的环境脉冲（约 0.7–1.1 s 一拍）；切到该会话后改为逐字节拍 |
| 窗口在后台 | 继续发声；回到前台恢复，不补放积压音符 |

- **阶段声音**是独立的第三组设置（单独一张卡，随整节一起展开/折叠）：思考、回答、工具执行各有一个开关，关闭某一阶段后该阶段不出声；被关闭阶段里的文字仍然算作“有活动”，不会让工作脉冲趁机补进来。三组设置各存各的键（`thinkingSound/Density/Pitch`、`answer…`、`tool…`），改一组不会动到另外两组。
- **每个音效和通知音量都有试听**：思考/回答的 ▶ 用当前密度与音高播一小段上行音，音与音的间隔就是实际运行时该密度的出音间隔；工具执行的 ▶ 按当前脉冲频率与音高播 2–3 下，开启「随机」时使用同样的随机间隔。通知音量滑杆旁也有 ▶（两段提示音都关闭时用合成音效演示音量）。试听按「当前会话音乐音量」缩放（试听链路本身是背景层的 2 倍，便于听清）；即使背景音乐预设是「关闭」，试听也使用默认预设发声。
- **工作脉冲**只补“没有文字的空窗”：一旦有字符到达就回到逐字节拍，且脉冲不会和文字拍叠加。
- **音量实时生效**：每个音符都经过「会话 gain」再进入共享链路，所以拖动「当前/其他会话音乐音量」立即改变正在播放的音乐；等待审批时的淡出、暂停与结束淡出也走同一个 gain。通知音量在每次响铃时读取，调整后下一次提示音即生效。
- **音乐与通知音完全隔离**：「通知音量」只作用于两个提示音，音乐音量由预设自身的主增益 × 会话音乐音量决定；两者共用同一个 `AudioContext`，但信号链互不相交。卡片右上角的状态徽标也会把阶段开关算进音乐层：预设开着但三个阶段全关时，音乐层不再计数（提示音也关闭时显示「全部关闭」）。
- **去重**：「等待操作」按 `turn + prompt` 身份去重（上限 512），断线重连/重放不会重复响；打开页面时已经存在的等待状态不会补响。
- **音频挂起时不排队**：页面/系统把 `AudioContext` 挂起时不再排新音符，恢复后从当前节奏继续。否则挂起期间的所有音符会共用同一个时间戳，恢复瞬间同时发声——听感上就是一声爆音或「沙沙/嗡嗡」的杂音。
- **多窗口**：每个浏览器标签各自发声（未做跨窗口互斥）。

## 默认值

| 项 | 默认 |
|---|---|
| 生成式背景音乐 | 空灵（`ethereal`，正弦、慢 attack）；已保存过偏好的浏览器保留原选择 |
| 通知音量 | 100% |
| 生成完成 | 合成音效（`synth`） |
| 等待操作 | 合成音效（`synth`） |
| 当前会话音乐音量 | 100% |
| 其他会话音乐音量 | 80% |
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

信号链：`每会话 gain → 预设低通(Q=0.5) → 舒适低通(2.5 kHz, Q=0.5) → 主增益 → 输出`；混响支路是 `预设低通 → 卷积混响 → wet → 舒适低通`，湿声同样不会把高频带回来。
一个页面只有**一个** `AudioContext`（浏览器同时只允许少量），切换预设就地重建链路并重新挂接所有会话声部。

预设参数本身仍与参考实现逐项一致；舒适低通和 Q 值是在预设之后新加的一层，见[听感依据](#听感依据)。

## 通知音效

6 个选项：关闭 / 合成音效 / 正面通知 / 正确提示 / 界面启动 / 界面返回。**全部由 Web Audio 实时合成，包内不含任何第三方音频素材。**

每个音是正弦主音 + 2 倍频 shimmer（6% 电平，衰减到 0.6× 时长），attack 8 ms。表里的频率是参考音型；播放时会整体**降八度**（×0.5），并乘 0.8 的输出电平：

| 选项 | 参考音型（实际播放） |
|---|---|
| 合成音效 | 完成：1318.5 → 1568 → 2093 Hz（实际 659.25 → 784 → 1046.5 Hz）；等待：1760 → 1318.5 Hz（实际 880 → 659.25 Hz） |
| 正面通知 | 上行二音 1318.5 → 1760 Hz（实际 659.25 → 880 Hz） |
| 正确提示 | 确认二音 1046.5 → 1568 Hz（实际 523.25 → 784 Hz） |
| 界面启动 | 上行琶音 523.25 → 659.25 → 783.99 → 1046.5 Hz（实际 261.63 → 329.63 → 392 → 523.25 Hz） |
| 界面返回 | 下行二音 783.99 → 523.25 Hz（实际 392 → 261.63 Hz） |

- 最终增益 = `通知音量 / 100 × 选项电平 × 0.8`；四个命名选项沿用原素材的响度比例（正面 .62 / 正确 .85 / 启动 1 / 返回 .70），切换时不会忽大忽小。
- 「合成音效」按场景区分完成/等待两种音型；四个命名选项对两个场景使用同一段音型（与原素材行为一致）。
- 音量为 0 时两个提示音都不播；浏览器不支持 Web Audio 时设置页给出提示，页面其余功能不受影响。

## 听感依据

长时间听的声音，疲劳感主要来自**能量分布**，而不是单纯的音量。等响曲线（ISO 226 / Fletcher–Munson）显示，人耳在 **2–5 kHz** 最敏感（外耳道共振），同样的声压在这一段听起来最响；混音实践里 **2–6 kHz** 也常被标为「harsh / 刺耳」区。另有纯音舒适听阈研究（Pollack, 1952）指出：舒适听音曲线的形状与中等响度的等响曲线一致——**中频允许的强度最低**，低频可以更高。

据此，这个版本做了四处调整：

1. **默认预设换成「空灵」**（正弦、慢 attack）。方波（`数字`）的奇次谐波最丰富，也最容易听累；`数字` 仍保留，供喜欢它的人主动选择。
2. **音乐链路加一级 2.5 kHz 舒适低通（Q=0.5）**，预设低通 Q 从 1 降到 0.5：保留 C4–D5（261–587 Hz）的前几个谐波，把 3 kHz 以上滚降，同时避免截止频率处出现新的共振峰。混响湿声也走这一级。
3. **提示音整体降八度**：基频从 523–2093 Hz 移到 261–1046 Hz，离开最敏感的 2–5 kHz；shimmer 从 4 倍频 12% 降到 2 倍频 6%，attack 从 2 ms 放缓到 8 ms，输出再乘 0.8。
4. **音量链路修正**：以前音符绕过了「会话 gain」直接进共享低通，所以音量滑杆和暂停/结束淡出都没有作用；现在每个音符都经过会话 gain，音量改动实时可听。

参考：

- [ISO 226 等响曲线 / Equal-loudness contour](https://en.wikipedia.org/wiki/Equal-loudness_contour)
- [HyperPhysics: Equal Loudness Curves](https://hyperphysics.phy-astr.gsu.edu/hbase/Sound/eqloud.html)
- [Pollack, *Comfortable Listening Levels for Pure Tones in Quiet and Noise*, JASA 24(2), 1952](https://pubs.aip.org/asa/jasa/article-abstract/24/2/158/722392/Comfortable-Listening-Levels-for-Pure-Tones-in)
- [Sound perception: timbre, loudness, and pitch（人耳对 1–6 kHz 中频最敏感）](https://www.sciencedirect.com/science/chapter/monograph/abs/pii/B9780128243473000194)

## 设置与存储

设置保存在浏览器 `localStorage`（键 `dsh:coding-sound:v1`），刷新、重启后仍在；不同浏览器各自独立。Safari 首次出声需要点一下页面，这是浏览器的自动播放策略，插件已处理恢复。

## 兼容性

- 与 `dsh-typewriter-blip`、`ui-beep` 等声音插件可以并存：不共享 DOM 节点，也不改写彼此的 DOM。
- 浏览器不支持 Web Audio 时，设置页会给出提示，页面其余功能不受影响。

## 素材与许可

插件不包含任何第三方音频素材：6 个通知音效全部由 Web Audio 实时合成。源代码以 MIT 许可发布，见 [LICENSE](LICENSE)。

## 工程结构

包布局遵循 DSH bundle 约定：Host 入口 `index.js` 与客户端产物 `client.js` 都在包根，客户端源码在 `src/client/`，构建脚本在 `scripts/`。

| 路径 | 内容 |
| --- | --- |
| `index.js` | Host 入口：导出 `apply()`；功能全部在页面里 |
| `client.js` | 客户端**构建产物**（顶部 GENERATED 标记，不要手改） |
| `src/client/` | 客户端源码：13 个按职责命名的模块，共享一个 module-loader 闭包 |
| `scripts/build-client.mjs` | 组装 `client.js`：`npm run build`、`npm run dev`（watch）、`npm run build:check` |
| `cordis.patch.yml` | Loader patch（`coding-sound` 行） |
| `locale/en.json`、`locale/zh.json` | `meta.title` / `meta.description` / `meta.detail` |
| `docs/DETAIL.md`、`docs/DETAIL.zh.md`、`docs/preview.svg` | 插件详情页（英/中 + 单张特性图） |
| `icon.svg`、`LICENSE`、`README.md`、`CHANGELOG.md` | 包根图标、许可与文档（`sponsor/` 只在仓库里，README 用 GitHub 绝对 URL 引用，不进 npm 包） |

客户端源码的构建顺序由 `scripts/build-client.mjs` 的 `MODULES` 清单决定；`entry.js` 必须第一、`apply.js` 必须最后，其余按依赖排列：

| 模块 | 内容 |
| --- | --- |
| `entry.js` | module-loader 入口、React require、hooks、`h` |
| `constants.js` | 包/section id、设置作用域、导航顺序、试听锁窗口、面板 id |
| `styles.js` | 全部 `dcs-*` CSS 与 `ensureStyles` |
| `locale.js` | `zh` / `en` 设置分区词典 |
| `icons.js` | 扬声器、播放与折角图标 |
| `presets.js` | 四套生成式音乐预设表 |
| `settings.js` | 持久化设置文档、归一化与 `SettingsStore` |
| `chimes.js` | 合成的完成/等待提示音 |
| `engine.js` | `AudioBus` + `MusicEngine`（一个 `AudioContext`，每个会话一个声部） |
| `observer.js` | 对话记录观察器，把已绘制文本转换成字符增量 |
| `sessions.js` | 会话状态边沿 → 声部、淡入淡出与提示音 |
| `section.js` | 设置 → 声音与提醒 的 React 分区 |
| `apply.js` | 插件主体（`apply()`）、导出（`inject`、`apply`、离线 `__test` 缝） |

- npm 包只发布运行所需的文件：`index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`、`LICENSE`、`CHANGELOG.md`、`docs/DETAIL.md`、`docs/DETAIL.zh.md`、`docs/preview.svg`；`src/`、`scripts/` 与 `test.mjs` 只存在于仓库。
- `npm run build` 重新生成 `client.js`；`npm run dev` 监听 `src/client/`；`npm run build:check` 只报告源码与产物是否一致；`npm test` 先跑 `build:check` 再跑离线测试；`npm run check` 再加上产物语法校验（`node --check client.js`）。
- 为什么不用打包器：DSH 客户端每个包只加载一个 `<plugin>/client.js`，这些模块共享同一个 module-loader 闭包，按 `MODULES` 顺序拼接即可；发布包因此保持零运行时依赖、无构建依赖。
- 新增或重命名客户端模块时同步修改 `MODULES`；构建脚本会拒绝清单遗漏、指向不存在的文件、重复项、首尾顺序错误，以及跨模块重名的顶层函数。
- 本地开发不需要额外的安装步骤，只需 Node ≥ 18：`npm run build` / `npm run dev` / `npm test` / `npm run check`；把本地 checkout 装进 web profile 用 `dsh plugin --profile web add /absolute/path/dsh-coding-sound`；用 `npm pack --dry-run` 查看发布包内容。
- 客户端改动由 DSH 热替换到已打开的页面（刷新页面即可）；Host 改动需要重启 DSH 才生效。

---

## English

**中文简介**：用声音盯住 Agent——模型输出时演奏生成式背景音乐，完成、等待操作、思考与工具执行各有提示音。

Generative background music and notification chimes for DeepSeek Harness (DSH): hear whether the agent is thinking, still working, or waiting for you, without watching the screen.

- **Generative music while the model streams** — notes follow the real character stream, not a fixed loop. Four presets (Ethereal / Classic / Digital / Retro) and one voice per session, so two busy sessions never collide.
- **Separate chimes** — completion and waiting-for-input are distinct; six synthesized options, with a notification volume independent of the music.
- **Per-phase sounds** — thinking, answer and tool execution each have their own switch, a rate (characters per beat or pulse interval) and a pitch, stored under separate keys; the tool pulse can jitter like a typewriter.
- **Easy on the ears** — the default preset is the sine "Ethereal" one, the music chain adds a non-resonant 2.5 kHz comfort lowpass after the preset filter, and every chime plays an octave lower (261–1046 Hz) with an octave shimmer at 6% and an 8 ms attack, keeping the fundamentals below the ear's 2–5 kHz sensitivity peak.
- **Settings card** — Settings → Sound & alerts, grouped into background music, notifications and phase sounds, with an audition button on every option and separate current/other session volumes. Volume changes, preset changes and phase settings are applied to the running audio immediately.

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
(release tarballs already include `client.js`). The target machine needs
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
- **Settings → Sound & alerts** should show three groups: background music
  (preset plus current/other session **music** volumes), notifications
  (notification volume and the two chimes) and phase sounds (thinking / answer /
  tool execution). Drag a music volume while a turn is streaming: the level
  changes immediately. Audition an option, then send a message and confirm the
  completion chime plays.
- No sound: check the system volume and the plugin's music/notification volumes
  first. Phase sounds need a music preset (preview still works when it is off);
  Safari needs one page click before its first sound (autoplay policy).

Defaults: Ethereal preset, notification volume 100%, "Synth" completion and waiting chimes, current session music volume 100%, other sessions 80%, thinking every 2 characters, answer every 4, tool pulse 0.9 s with the random jitter on. All sounds are synthesized in the browser with Web Audio — the package ships no audio files. Settings live in the browser's `localStorage` (`dsh:coding-sound:v1`), so each browser keeps its own. MIT.

### Source layout and build

The package follows the DSH bundle convention: the Host entry (`index.js`) and
the client artifact (`client.js`) live at the package root, the client sources
under `src/client/`, and the build script under `scripts/`.

| Path | Responsibility |
| --- | --- |
| `index.js` | Host entry: exports `apply()`; the feature lives entirely in the page |
| `client.js` | Client **generated artifact** (GENERATED banner; do not edit) |
| `src/client/` | Client sources: 13 responsibility-named modules sharing one module-loader closure |
| `scripts/build-client.mjs` | Assembles `client.js`: `npm run build`, `npm run dev` (watch), `npm run build:check` |
| `cordis.patch.yml` | Loader patch for the `coding-sound` row |
| `locale/en.json`, `locale/zh.json` | `meta.title` / `meta.description` / `meta.detail` |
| `docs/DETAIL.md`, `docs/DETAIL.zh.md`, `docs/preview.svg` | Plugin detail page (English/Chinese plus one feature image) |
| `icon.svg`, `LICENSE`, `README.md`, `CHANGELOG.md` | Package-root icon, license and docs (`sponsor/` lives only in the repository; the README links it through absolute GitHub URLs, so it is not in the npm package) |

`scripts/build-client.mjs` owns the load order through its `MODULES` list;
`entry.js` must be first and `apply.js` last, and the rest follow their
dependencies:

| Module | Responsibility |
| --- | --- |
| `entry.js` | module-loader entry, React require, hooks, `h` |
| `constants.js` | package/section ids, settings scope, nav order, audition lock windows, panel id |
| `styles.js` | all `dcs-*` CSS and `ensureStyles` |
| `locale.js` | the `zh` / `en` settings-section dictionaries |
| `icons.js` | speaker, play and chevron glyphs |
| `presets.js` | the four generative-music preset tables |
| `settings.js` | persisted settings document, normalization, `SettingsStore` |
| `chimes.js` | the synthesized completion/attention chimes |
| `engine.js` | `AudioBus` + `MusicEngine` (one `AudioContext`, one voice per session) |
| `observer.js` | chat-transcript observer that turns painted text into character deltas |
| `sessions.js` | session-status edges → voices, fades and chimes |
| `section.js` | the Settings → Sound & alerts React section |
| `apply.js` | plugin body (`apply()`), exports (`inject`, `apply`, offline `__test` seam) |

- The npm package ships only the runtime files: `index.js`, `client.js`,
  `cordis.patch.yml`, `locale/*.json`, `icon.svg`, `README.md`, `LICENSE`,
  `CHANGELOG.md`, `docs/DETAIL.md`, `docs/DETAIL.zh.md` and `docs/preview.svg`;
  `src/`, `scripts/` and `test.mjs` stay in the repository.
- `npm run build` regenerates `client.js`; `npm run dev` watches `src/client/`;
  `npm run build:check` reports whether source and artifact agree; `npm test`
  runs `build:check` first and then the offline tests; `npm run check` adds a
  `node --check client.js` syntax pass.
- No bundler: the DSH client loads exactly one `<plugin>/client.js`, the
  modules share one module-loader closure, and ordered concatenation keeps the
  published package dependency-free.
- Adding or renaming a client module means updating `MODULES`; the build script
  rejects an unlisted or missing file, a duplicated entry, a wrong load order,
  or a top-level function name duplicated across modules.
- Nothing to install beyond Node ≥ 18: `npm run build` / `npm run dev` /
  `npm test` / `npm run check`. Install a local checkout into the web profile
  with `dsh plugin --profile web add /absolute/path/dsh-coding-sound`; inspect
  what would be published with `npm pack --dry-run`.
- Client changes are hot-swapped into the open page by DSH (refresh the page);
  Host changes need a DSH restart.

---

<!-- author-tools:start -->

<!-- generated by scripts/sync-readmes.mjs from projects.json -->

## 同作者的其他插件 · More plugins by the same author

- **[DSH 分屏工作区](https://github.com/mhlywxl/dsh-split-workspace)**（`dsh-split-workspace`）— 把 DSH 会话区拆成任意数量的原生窗格：左右、上下、田字 2×2 与自动网格，每个窗格都是独立会话。
  <br />*[DSH split workspace](https://github.com/mhlywxl/dsh-split-workspace)* (`dsh-split-workspace`) — Split the DSH conversation area into unlimited native panes — side by side, stacked, 2×2 and an automatic grid — each a real session with its own composer and streaming.
- **[DSH 自动思考档位](https://github.com/mhlywxl/dsh-think-effort)**（`dsh-think-effort`）— 为 DeepSeek 等推理模型补上思考档位：模型选择器里的 Auto 落到声明默认档，会话标题与压缩等廉价调用自动用低档。
  <br />*[DSH think effort](https://github.com/mhlywxl/dsh-think-effort)* (`dsh-think-effort`) — Declarative thinking depths for DeepSeek in DSH: Auto resolves to the declared default, and cheap host-owned calls drop to Low.

## 支持作者 · Support the author

如果这个项目帮你省下了盯屏幕的时间，欢迎请作者喝杯咖啡 ☕，或者给作者「充充电」⚡。金额随意，心意最重要。

*If this project saved you some screen time, you can buy the author a coffee ☕ or top up the author's battery ⚡. Any amount is welcome — the thought counts.*

<p align="center">
  <img src="https://raw.githubusercontent.com/mhlywxl/dsh-coding-sound/main/sponsor/alipay.jpg" alt="支付宝收款码 / Alipay QR code" width="180" />
  <img src="https://raw.githubusercontent.com/mhlywxl/dsh-coding-sound/main/sponsor/wechat.png" alt="微信收款码 / WeChat Pay QR code" width="180" />
</p>
<p align="center"><sub>支付宝 · 微信支付 / Alipay · WeChat Pay</sub></p>

<!-- author-tools:end -->

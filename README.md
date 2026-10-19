# dsh-coding-sound

DeepSeek Harness（DSH）声音插件：模型输出时演奏**生成式背景音乐**，一轮结束与「等待你操作」各有一声可单独配置的**通知音效**，音量可调，每项可试听。

> Generative background music while the model streams, plus separate completion and attention chimes — all synthesized with Web Audio, no bundled audio assets.

设置页新增一页「声音」，卡片与参考桌面版的声音设置同构：

```
♫  声音                                        [已自定义]  ⌃
   背景音乐与通知音效
─────────────────────────────────────────────────────────
生成式背景音乐   [空灵        ⌄]  ▶
通知音量         ──────●──────  70%
生成完成         [合成音效    ⌄]  ▶
等待操作         [合成音效    ⌄]  ▶
当前会话音量     ────────●────  100%
其他会话音量     ──●──────────   35%
```

## 行为

| 场景 | 行为 |
|---|---|
| 某个会话开始输出 | 该会话的音乐淡入（0.25 s）；每 4 个字一拍，两拍至少间隔 100 ms，C 大调五声音阶随机取音，15% 概率低八度，±5% 随机 detune |
| 输出中 | 节拍跟随真实字符增量，不是固定循环；整段挂载/重渲染/换会话不会被误当打字 |
| 思考（reasoning） | **当前会话不发声音符**：观察器只统计助手正文，reasoning 段被排除；非当前会话的环境脉冲照常 |
| 工具执行 | **当前会话不发声音符**：工具行不是正文；若本轮有正文（如“我先看一下…”）则照常发声。等待审批时该会话音乐暂停并响「等待操作」 |
| 某个会话进入等待操作 | **只**停这个会话的音乐（0.25 s 淡出），并响「等待操作」；其他会话照常 |
| 一轮结束 | 当前会话 320 ms 防抖后响「生成完成」；子代理会话不响 |
| 切会话 | 当前会话按「当前会话音量」、其他会话按「其他会话音量」，0.25 s 交叉过渡 |
| 其他会话在后台工作 | 以「其他会话音量」播放缓慢的环境脉冲（约 0.7–1.1 s 一拍）；切到该会话后改为逐字节拍 |
| 窗口在后台 | 继续发声；回到前台恢复，不补放积压音符 |

- **音乐与通知音完全隔离**：「通知音量」只作用于两个提示音，音乐音量由预设自身的主增益 × 会话音量决定。
- **去重**：「等待操作」按 `turn + prompt` 身份去重（上限 512），断线重连/重放不会重复响；打开页面时已经存在的等待状态不会补响。
- **多窗口**：每个浏览器标签各自发声（未做跨窗口互斥）。

## 默认值

| 项 | 默认 |
|---|---|
| 生成式背景音乐 | 空灵（`ethereal`） |
| 通知音量 | 70% |
| 生成完成 | 合成音效（`synth`） |
| 等待操作 | 合成音效（`synth`） |
| 当前会话音量 | 100% |
| 其他会话音量 | 35% |
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

## 安装与开发

```powershell
# 用 Harness 的插件安装动作装入 desktop profile（推荐；Plugin Manager 的“安装 bundle”）
# 目标填这个目录的绝对路径：D:\dev\harness\dsh-coding-sound
# 也可以从插件市场/命令行以 link: 安装：
dsh plugin --profile desktop add link:D:\dev\harness\dsh-coding-sound

# 构建浏览器包（src/*.js → client.js）
node build.mjs          # 或 npm run build
node build.mjs --check  # 仅检查产物是否最新
node test.mjs           # 27 项离线测试，含把生成后的 client.js 在假运行时里跑一遍
```

Host 半改动（`index.js`）需要重启 DSH 才能生效；只改 `src/` 时重新 `node build.mjs` 并**刷新页面**（Client 产物按启动时的模块图加载，刷新才会取到新文件）。

## 离线安装 / 另一台电脑 / macOS

插件没有原生依赖、没有安装脚本，`client.js` 已预构建；Host 半只是一个空的 Loader 行，全部功能都在浏览器里（Web Audio + React）。因此：

- **macOS 可用**：代码里没有 Windows 专属路径或原生模块，DSH 的 Web/Electron 页面在 macOS 上跑的是同一套 JS。未在 macOS 实机验证过，但不存在平台相关分支。
- **运行时不需要网络**：没有远程素材、没有 fetch、没有第三方依赖。
- **离线安装步骤**（目标机不需要联网）：

  1. 在源机打包（`npm pack` 不需要联网，只打包发布文件）：

     ```powershell
     cd D:\dev\harness\dsh-coding-sound
     npm pack
     # 得到 dsh-coding-sound-0.1.0.tgz
     ```

     也可以直接拷贝整个目录（排除 `.git/` 和 `node_modules/`）。

  2. 把 tgz（或目录）拷到目标机，例如 `/Users/you/Downloads/dsh-coding-sound-0.1.0.tgz`。

  3. 在目标机安装（`dsh` 不在 PATH 时，用 DSH app 内自带的 `runtime/cli/bin/dsh`）：

     ```bash
     dsh plugin --profile desktop add /Users/you/Downloads/dsh-coding-sound-0.1.0.tgz
     # 目录方式：dsh plugin --profile desktop add link:/Users/you/dsh-coding-sound
     ```

     目标机完全离线、pnpm 仍尝试访问 registry 时，在命令末尾加 `--offline`。

  4. **启用 bundle**：`dsh plugin add` 只把包装进 profile，不会自动加载。到
     **设置 → 插件** 里启用 `dsh-coding-sound`（等价于把 `"dsh-coding-sound"`
     加进 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 数组）。

  5. 完全退出并重启 DSH，打开 **设置 → 声音**。

  也可以在目标机的 **Plugin Manager** 里直接安装这个目录或 tgz——它会同时完成第 3、4 步。

- 设置保存在浏览器 `localStorage`（键 `dsh:coding-sound:v1`），新电脑从默认值开始：空灵 / 合成音效 / 70% / 当前 100% / 其他 35%。不需要迁移配置文件。
- 如果目标机用 Safari 打开 Web GUI，首次需要点一下页面（用户手势）才能出声，这是浏览器自动播放策略，插件已经处理恢复。

## 发布

发布到 GitHub、npm 与社区插件市场（Awesome DSH Plugin）的完整步骤见 [PUBLISH.md](PUBLISH.md)。

## 结构

```
dsh-coding-sound/
├─ package.json          # dsh.bundle.patch + dsh.client{platform:web}
├─ cordis.patch.yml      # 插入 id: coding-sound 一行
├─ index.js              # Host：只占一个 Loader 行，无路由
├─ client.js             # 构建产物（不要手改）
├─ src/
│  ├─ presets.js         # 4 组预设参数、音阶、节流常量
│  ├─ settings.js        # 解析/归一化/localStorage/徽章/去重/音量与选项电平
│  ├─ engine.js          # AudioBus + 多会话音乐引擎（共享链、混响脉冲缓存）
│  ├─ chimes.js          # 6 个通知音效的合成实现
│  ├─ observer.js        # DOM 观察 → 字符增量（挂载/重渲染/换会话防护）
│  ├─ sessions.js        # sessionStatus 边沿纯函数 + 每会话声音生命周期
│  └─ client.js          # 槽位注册 + 设置卡片 + 运行时装配
├─ locale/{zh,en}.json   # 插件标题/描述
├─ icon.svg
├─ build.mjs             # src/*.js → client.js 的拼装脚本
├─ test.mjs              # 离线测试台（node:test）
├─ LICENSE               # MIT
└─ PUBLISH.md            # 发布到 GitHub / npm / 插件市场的步骤
```

## 验收状态

| # | 验收项 | 状态 |
|---|---|---|
| A1 | 开始输出 → 音乐；结束/中断 → 0.3 s 内淡出 | 已实现（离线边沿测试）；听感需人工 |
| A2 | 音乐密度跟随输出速度（每 4 字一拍、≥100 ms） | 已实现；常量与节流有单测 |
| A3 | 5 档预设与参考版同参 | 参数逐字段单测；听感需人工 |
| A4 | 完成音 / 等待音分开、可替换 | 已实现；边沿与去重有单测 |
| A5 | 6 个选项、可试听、可替换 | 已实现（全部合成，无素材依赖）；试听需人工 |
| A6 | 通知音量只影响提示音 | 已实现（两条独立 gain 路径） |
| A7 | 当前/其他会话音量两档、切会话过渡 | 已实现；音量映射有单测 |
| A8 | 等待操作只停该会话 | 已实现；边沿测试覆盖 |
| A9 | 卡片与参考版同构 | 已实现（6 行、三态徽章、折叠）；并排截图需人工 |
| A10 | 后台出声 | 依赖 Web Audio 音频时钟；需人工 |
| A11 | 刷新/重启后设置仍在 | localStorage；需人工 |
| A12 | 子代理/工具不触发完成音；重连不重复 | 子代理与去重有单测；重连需人工 |
| A13 | 4 个素材与参考同源 | 已按 D4 替换为合成实现，包内不再携带 WAV |
| A14 | 与 typewriter-blip / ui-beep 并存 | 不共享 DOM/节点，设计上可并存；冲突提示未做 |
| A15 | 离线测试 + 无类型错误 | `node test.mjs` 27/27；无 TS 构建 |
| A16 | 各种全关组合静音且不报错 | 徽章/静音映射有单测；需人工听 |

## 与参考实现的差异 / 已知限制

1. **设置保存在浏览器而不是 Host Config**。参考设计里的 `Config`（全 `.volatile()`）没有落地：本地以目录形式链接安装的包无法解析 Host 侧 `@deepseek-ai/schemastery` 依赖，而浏览器本地的设置本来就是权威层。`SettingsStore` 已支持 Host 默认值作为基线（`setHostDefaults`），以后加回 `Config` 只需把它接进 `configForms`。
2. **非当前会话是环境脉冲**。浏览器只能看到当前会话的 DOM，拿不到其他会话的逐 token 信号，所以后台会话以约 0.7–1.1 s 一拍的脉冲保持「仍在工作」的听感；切到该会话后立刻恢复逐字节拍。
3. **未做插件冲突提示**（检测 typewriter-blip / ui-beep 并建议禁用）。本插件与它们共用页面里各自独立的 `AudioContext`，不共享节点、不互相改写 DOM，所以可以并存；提示文案留待后续。
4. **未做「恢复默认」按钮**，与参考版保持一致。
5. 音乐引擎在插件卸载时停声并关闭 `AudioContext`；声音只在用户手势后启动（浏览器自动播放策略）。
6. **原 WAV 已按决策 D4 替换为合成实现**：4 个命名选项改为同风格的合成音型，`assets/` 与 Host 音频路由已删除，npm 包不再携带第三方音频素材。

## 素材与许可

插件不包含任何第三方音频素材：6 个通知音效全部由 Web Audio 实时合成。源代码以 MIT 许可发布，见 [LICENSE](LICENSE)。

音乐参数（音阶、包络、预设表、合成音频率、节流）逐字段取自参考桌面版 `main-v2` 分支的 `generative-music.ts` / `sound.ts`，以保证听感一致。

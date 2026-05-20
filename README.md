# TH06 Web

[中文](#中文) | [English](#english)

## 中文

《东方红魔乡》Web 复刻项目。项目目标是在浏览器中尽量基于原作数据和源码还原 TH06 的关卡、弹幕、Boss 行为、UI、BGM 和音效。

### 状态

- Stage 1-6 已接入原作 ECL / STD / ANM / MSG 数据。
- 运行时直接解析内嵌原作数据，不使用手写近似关卡脚本。
- 图像、BGM、音效均来自运行时所需资源子集。
- 支持纯静态部署，可直接打开 `index.html`。

### 操作

- 方向键：移动
- `Shift`：低速移动 / 显示判定点
- `Z` / `Enter`：确认 / 射击
- `X`：Bomb / 返回
- `Esc`：暂停 / 返回

### 本地运行

直接打开：

```sh
index.html
```

本地开发检查：

```sh
npm run check
npm test
node scripts/audit-th06-stages.mjs
npx playwright test -c playwright.config.mjs --reporter=line
npm run prepare-pages
```

### 目录

- `index.html`：入口文件
- `src/vanilla/`：游戏运行时、TH06 数据解析、核心逻辑
- `src/styles.css`：页面样式
- `assets/th06-img/`：运行时图像资源
- `assets/audio/`：BGM
- `assets/sfx/`：音效
- `reference/`：本地参考资料，不提交到远程
- `tests/`、`scripts/`：本地测试和审计工具，不作为 Pages 运行依赖
- `dist/`：发布产物，不提交

### 本地参考资料

`reference/` 不提交到远程仓库。需要继续做高还原度开发或运行完整 source audit 的开发者，应在本地准备这些资料：

- `reference/th06-original/`：从合法持有的 TH06 原版资源中解包出的文件。当前生成脚本会读取 `ecldata*.ecl`、`stage*.std`、`*.anm`、`msg*.dat` 等资源，重新生成 `src/vanilla/th06-data.js` 和 `src/vanilla/th06-effects-data.js`。
- `reference/th06-master/`：[GensokyoClub/th06](https://github.com/GensokyoClub/th06) 逆向工程项目的本地 checkout，用于源码级常量、状态机、碰撞、计分、Bomb、资源表和帧时序审计。
- `reference/ECL/`：可读的 ECL `.decl` 反编译脚本，用于核对关卡、Boss phase、符卡、敌人 subroutine 与 timeline。
- `reference/DSTD/`：可读的 STD `.dstd` 反编译脚本，用于核对舞台背景对象和相机/透视行为。

没有 `reference/` 时，浏览器运行不受影响；部分 source audit 会跳过或降级为只检查已内嵌运行时数据。准备好本地参考资料后，可运行 `npm run generate-data` 重建内嵌原作数据，再运行 `npm test` 和 `node scripts/audit-th06-stages.mjs` 做一致性检查。

### Changelog

#### 2026-05-20

- 将运行时 BGM 从 MP3 替换为 Ogg/Opus，降低首次缓存和发布包体积。
- 优化桌面键盘低延迟路径：拆分输入消费/绘制延迟统计，并跳过高刷新率下未推进逻辑的重复绘制。

#### 2026-05-17

- 实装主线 Easy / Normal / Hard / Lunatic 四难度选择，默认光标按原作停在 Normal。
- 将 ECL 难度分支从固定 Lunatic 改为按当前难度解释，保留 Lunatic 原有行为。
- 还原 Stage 5 符卡难度差分：Easy / Normal 与 Hard / Lunatic 使用对应原作 spell id。
- 保留 Easy 第五面结束后不进入第六面的原作流程。
- 补充本地四难度 ECL 审计和浏览器菜单 / 流程回归验证。

#### 2026-05-15

- 允许移动端点击跳过对话。
- 修复移动端触控移动问题，并修正帧节奏相关问题。
- 改进移动端菜单触控体验，并优化 PWA 图标表现。
- 新增移动端 PWA 支持，并加入安全的性能优化项。

#### 2026-05-14

- 修复 TH06 ECL 生成（spawn）相关行为，并优化 autoplay 性能。
- 合并 PR #1（`AgentMystia/codex-th06-fidelity-autoplay`），集中引入还原度与 autoplay 相关改进。
- 持续提升 TH06 还原度与 autoplay 体验。

#### 2026-05-13

- 更新 AGENTS.md，明确原作优先级、只允许已批准现代化、参考资料边界和上线校验流程。
- 复刻原作风格的关卡 Intro、Boss 符卡宣言、Boss 血条和符卡击破奖励/爆破反馈。
- 修复 ReimuA / ReimuB / MarisaA / MarisaB 自机 Bomb 的原作参数、宣言音效、伤害/消弹节奏与主要视觉表现。
- 修复 MarisaA 绿色副弹命中后停留减速导致的异常帧伤。
- 替换 Stage 3-6 BGM 为 THWiki 对应 MP3。
- 收紧敌弹原作行为：出弹状态、出弹期间碰撞、初速度、整数 RNG。
- 增加浏览器测试钩子和 Stage 6 咲夜贴图回归检查。
- 修复 Stage 6 咲夜中 Boss spritesheet 选择问题。
- 接入 Stage 3-6 运行时资源。

#### 2026-05-11

- 发布 Stage 2。
- 修复 Stage 2 背景和琪露诺最终符卡相关问题。
- 区分 Stage 2 道中 Boss 大妖精与正式 Boss 琪露诺。

#### 2026-05-08

- 发布 Stage 1。
- 接入基础 TH06 系统、Stage 1 敌人、弹幕、Boss、资源掉落和 HUD。

### TODO

- 建立更严格的 headless golden state 对比。
- 继续校准 Stage 3-6 的 Boss 行为、符卡演出和背景透视。
- 完善 Boss 符卡击破特效、转场和最终结算。
- 完善 Stage Clear 结算画面。
- 扩展更多自机 Shot Type 与 Bomb 行为。
- 完善 GitHub Pages 自动发布流程。

### Known Issues

- 尚无原版 replay / golden frame 逐帧对比，不能证明完全像素级一致。
- Stage 3-6 已可运行，但符卡节奏、背景、特效仍可能存在细节偏差。
- Canvas 渲染与原作 DirectX 在混合、取整、采样上可能存在差异。
- BGM 仍是主要运行时资源；当前使用 Ogg/Opus 以降低加载体积。

### 版权

本项目为非商业粉丝复刻与技术研究项目。东方 Project 及《东方红魔乡》相关角色、音乐、图像资源版权归原作者及相关权利方所有。

---

## English

A web remake of *Touhou 6: Embodiment of Scarlet Devil*. The goal is to reproduce TH06 stages, bullet patterns, boss behavior, UI, BGM, and sound effects in the browser, using original data and source references whenever possible.

### Status

- Stages 1-6 use original ECL / STD / ANM / MSG data.
- Runtime parses embedded original data directly instead of using hand-written approximate stage scripts.
- Images, BGM, and sound effects are limited to the assets required at runtime.
- Static deployment is supported. `index.html` can be opened directly.

### Controls

- Arrow keys: Move
- `Shift`: Focus / show hitbox
- `Z` / `Enter`: Confirm / shoot
- `X`: Bomb / back
- `Esc`: Pause / back

### Local Run

Open directly:

```sh
index.html
```

Local validation:

```sh
npm run check
npm test
node scripts/audit-th06-stages.mjs
npx playwright test -c playwright.config.mjs --reporter=line
npm run prepare-pages
```

### Structure

- `index.html`: entry point
- `src/vanilla/`: runtime, TH06 data parsing, core logic
- `src/styles.css`: page styles
- `assets/th06-img/`: runtime image assets
- `assets/audio/`: BGM
- `assets/sfx/`: sound effects
- `reference/`: local reference corpus, not pushed to remote
- `tests/`, `scripts/`: local tests and audit tools, not required by Pages runtime
- `dist/`: build output, not committed

### Local Reference Corpus

`reference/` is not committed to the remote repository. Developers who want to continue high-fidelity work or run the full source audit should prepare these files locally:

- `reference/th06-original/`: files unpacked from a legally owned TH06 release. The current generators read resources such as `ecldata*.ecl`, `stage*.std`, `*.anm`, and `msg*.dat`, then rebuild `src/vanilla/th06-data.js` and `src/vanilla/th06-effects-data.js`.
- `reference/th06-master/`: a local checkout of the [GensokyoClub/th06](https://github.com/GensokyoClub/th06) reverse-engineering project, used for source-level audits of constants, state machines, collision, scoring, bombs, resource tables, and frame timing.
- `reference/ECL/`: readable decompiled ECL `.decl` scripts for checking stages, boss phases, spellcards, enemy subroutines, and timelines.
- `reference/DSTD/`: readable decompiled STD `.dstd` scripts for checking stage background objects and camera/projection behavior.

The browser runtime does not need `reference/`. Without it, some source audits skip or fall back to checks against the embedded runtime data only. After preparing local references, run `npm run generate-data` to rebuild embedded original data, then run `npm test` and `node scripts/audit-th06-stages.mjs` for consistency checks.

### Changelog

#### 2026-05-20

- Replaced runtime BGM MP3 files with Ogg/Opus files to reduce first-load caching and release size.
- Improved the desktop keyboard low-latency path with split input update/draw metrics and skipped duplicate high-refresh draws without simulation steps.

#### 2026-05-17

- Implemented the main Easy / Normal / Hard / Lunatic difficulty selection, with Normal selected by default like the original.
- Changed ECL difficulty branching from fixed Lunatic to the active difficulty while preserving existing Lunatic behavior.
- Restored Stage 5 spell difficulty variants so Easy / Normal and Hard / Lunatic use the corresponding original spell IDs.
- Preserved the original Easy-route rule that stops after Stage 5 instead of entering Stage 6.
- Added local four-difficulty ECL audit coverage and browser regression checks for menu / route flow.

#### 2026-05-15

- Allowed tapping on mobile to skip dialogue.
- Fixed mobile touch movement and frame pacing issues.
- Improved mobile menu touch interaction and updated PWA icon behavior.
- Added mobile PWA support with safe performance optimizations.

#### 2026-05-14

- Fixed TH06 ECL spawn behavior and improved autoplay performance.
- Merged PR #1 (`AgentMystia/codex-th06-fidelity-autoplay`) with consolidated fidelity and autoplay improvements.
- Continued improving TH06 fidelity and autoplay behavior.

#### 2026-05-13

- Updated AGENTS.md to define original-first authority, approved modernizations, reference corpus boundaries, and release validation.
- Recreated original-style stage intro, boss spell declaration, boss life bar, and spell capture/break feedback.
- Fixed ReimuA / ReimuB / MarisaA / MarisaB bomb source parameters, declaration sound, damage/cancel cadence, and primary visuals.
- Fixed MarisaA green missiles lingering and slowing on hit, which caused excessive frame damage.
- Replaced Stage 3-6 BGM with the matching THWiki MP3 files.
- Tightened original enemy bullet behavior: spawn state, collision timing, burst speed, integer RNG.
- Added browser test hook and Stage 6 Sakuya spritesheet regression test.
- Fixed Stage 6 Sakuya midboss spritesheet selection.
- Restored Stage 3-6 runtime assets.

#### 2026-05-11

- Published Stage 2.
- Fixed Stage 2 background and Cirno final spell behavior.
- Distinguished Stage 2 midboss Daiyousei from boss Cirno.

#### 2026-05-08

- Published Stage 1.
- Added the base TH06 system, Stage 1 enemies, bullets, boss, drops, and HUD.

### TODO

- Add stricter headless golden state comparison.
- Continue tuning Stage 3-6 boss behavior, spell effects, and background perspective.
- Improve boss spell defeat effects, transitions, and final result screen.
- Complete Stage Clear result flow.
- Expand more shot types and bomb behavior.
- Improve GitHub Pages automation.

### Known Issues

- No original replay / golden frame comparison yet, so pixel-perfect parity is not proven.
- Stages 3-6 run, but spell timing, backgrounds, and effects may still differ in details.
- Canvas rendering may differ from the original DirectX renderer in blending, rounding, and sampling.
- BGM is still the largest runtime asset class; it now uses Ogg/Opus to reduce load size.

### Copyright

This is a non-commercial fan remake and technical study project. Touhou Project, *Embodiment of Scarlet Devil*, and related characters, music, and image assets belong to their respective rights holders.

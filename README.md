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

### Changelog

#### 2026-05-13

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
- BGM 使用完整 MP3 后，发布包体积增大。

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

### Changelog

#### 2026-05-13

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
- Full MP3 BGM increases the published bundle size.

### Copyright

This is a non-commercial fan remake and technical study project. Touhou Project, *Embodiment of Scarlet Devil*, and related characters, music, and image assets belong to their respective rights holders.

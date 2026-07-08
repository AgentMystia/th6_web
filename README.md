# TH07 Web — Perfect Cherry Blossom

[中文](#中文) | [English](#english)

## 中文

《东方妖々梦 ～ Perfect Cherry Blossom》(TH07) 的 TypeScript 浏览器复刻。
目标是尽量基于**原作数据**还原游戏：运行时直接解析内嵌的原作
ECL / STD / ANM / MSG / SHT 二进制数据来驱动关卡、弹幕、Boss、自机、
背景与 UI，而不是手写近似脚本。逆向自 `Th07.exe` 的常量均带地址出处注释。

本仓库此前是 TH06 Web 复刻（保留在 `legacy-vanilla` 分支及 `src/vanilla/`
遗留目录中）；当前主线开发为 TH07 TypeScript 版。

### 状态

- **Stage 1 完整可玩**（Easy–Lunatic）：道中敌阵、中 Boss 琪露诺客串、
  对话（带立绘）、Boss 蕾蒂·霍瓦特洛克全符卡（含 Lunatic 差分）。
- 标题画面 → 难度选择 → 机体/符卡类型选择（灵梦/魔理沙/咲夜 × A/B），
  全部使用原作 `title01.anm` 菜单脚本与美术。
- 自机数据直接读取原作 `.sht`：移动速度、判定、擦弹、火力表、
  Deathbomb 窗口（灵梦 15 / 魔理沙 8 / 咲夜 6 帧）、60 帧射击周期。
- 樱点系统：Cherry / CherryMax / Cherry+，50000 触发**森罗结界**
  （540 帧，被弹/炸弹中断与自然结束的结算行为已实现并有单元测试）。
- 3D 舞台背景：STD 相机/雾关键帧驱动的透视贴图地面与层叠树木，
  Boss 战期间相机按原数据无缝循环。
- HUD 使用原作 `front.png` / `ascii.png` 精灵：暗红织纹边框、
  东方妖々夢 Logo、数字字体、残机/Bomb 星星、Cherry+ 底部计数。
- BGM 使用 `thbgm.fmt` 的采样级循环点无缝循环；音效为原作 WAV。

### 操作

- 方向键：移动
- `Shift`：低速（显示判定点）
- `Z`：确认 / 射击
- `X`：Bomb / 返回
- `Esc`：暂停

### 本地运行

```sh
npm install
npm run build      # 打包 dist/th07.js（esbuild IIFE）
# 然后直接打开 index.html，或：
npm run dev        # 监听构建 + 本地静态服务
```

校验：

```sh
npm run check      # tsc --noEmit（strict）
npm test           # 单元测试（樱点/结界、数据一致性）
node scripts/dev-shot.mjs /tmp/s.png 800 "difficulty=3"   # 无头截图冒烟
```

### 目录

见 [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)。
开发/协作规范（含格式事实与验证流程）见 [AGENTS.md](AGENTS.md)。

### 本地参考资料（不提交）

`reference/` 被 git 忽略，浏览器运行不依赖它。继续做高还原度开发需要在
本地准备：从合法持有的 TH07 原版解包的 `reference/th07-original/`
（用 [thtk](https://github.com/thpatch/thtk) 的 `thdat -x7` 解包
`Th07.dat`），以及可读反汇编 `reference/ECL7|DSTD7|MSG7`
（`thecl -d` / `thstd -d` / `thmsg -d`）。备齐后可用
`npm run generate-data` 重建内嵌数据，`npm run generate-bgm` 切分 BGM。

### 已知差距 / TODO

- 尚无逐帧 replay 对比，不能证明帧级一致。
- 集中注册的近似项见 AGENTS.md §7（聚焦 Option 轨道速率、Bomb 演出、
  部分 HUD 摆位等）。
- Stage 2+ 未实装。
- TH06 遗留文件（`src/vanilla/` 等）待清理，完整保留于
  `legacy-vanilla` 分支。

### 版权

本项目为非商业粉丝复刻与技术研究项目。东方 Project 及《东方妖々梦》
相关角色、音乐、图像资源版权归上海爱丽丝幻乐团 (ZUN) 及相关权利方所有。
仓库仅包含运行所需的资源子集；原版游戏文件不随仓库分发。

---

## English

A TypeScript browser reimplementation of *Touhou Youyoumu ~ Perfect Cherry
Blossom* (TH07). The engine is **data-driven**: it embeds and directly
executes the original ECL / STD / ANM / MSG / SHT binaries for stage
scripts, danmaku, bosses, the player, backgrounds, and UI — no hand-written
approximate stage scripts. Constants reverse-engineered from `Th07.exe`
carry address-provenance comments.

This repository previously hosted a TH06 web remake (preserved on the
`legacy-vanilla` branch and in the legacy `src/vanilla/` directory); active
development is the TH07 TypeScript app.

### Status

- **Stage 1 fully playable** (Easy–Lunatic): stage waves, Cirno midboss
  cameo, portrait dialogue, and Letty Whiterock with her full spell set
  including Lunatic variants.
- Title → difficulty → character/shot-type select (Reimu/Marisa/Sakuya ×
  A/B), built from the original `title01.anm` menu scripts and art.
- Player data read straight from the original `.sht` files: movement
  speeds, hitbox/graze radii, power-bracketed fire tables, deathbomb
  windows (Reimu 15 / Marisa 8 / Sakuya 6 frames), 60-frame shot cycle.
- Cherry system: Cherry / CherryMax / Cherry+, with the **Supernatural
  Border** triggering at 50,000 (540 frames; break-by-hit, break-by-bomb,
  and natural-expiry outcomes implemented and unit-tested).
- 3D stage background: perspective-mapped ground and sprite-stacked trees
  driven by the STD camera/fog keyframes, with the data's seamless
  boss-fight camera loop.
- HUD from the original `front.png` / `ascii.png` sprites: the maroon
  woven frame, 東方妖々夢 logo panel, digit font, life/bomb stars, and the
  bottom-edge Cherry+ readout.
- BGM loops gaplessly using sample-exact loop points from `thbgm.fmt`;
  sound effects are the original WAVs.

### Controls

- Arrow keys: move
- `Shift`: focus (shows hitbox)
- `Z`: confirm / shoot
- `X`: bomb / back
- `Esc`: pause

### Run locally

```sh
npm install
npm run build      # bundle dist/th07.js (esbuild IIFE)
# then open index.html directly, or:
npm run dev        # watch build + local static server
```

Validation:

```sh
npm run check      # tsc --noEmit (strict)
npm test           # unit tests (cherry/border, data consistency)
node scripts/dev-shot.mjs /tmp/s.png 800 "difficulty=3"   # headless smoke
```

### Layout

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md). Engineering
rules — including the file-format facts and the verification workflow —
live in [AGENTS.md](AGENTS.md).

### Local reference corpus (never committed)

`reference/` is git-ignored and the browser runtime never reads it. To
continue high-fidelity work, prepare locally: `reference/th07-original/`
unpacked from a legally owned TH07 copy (`thdat -x7 Th07.dat` using
[thtk](https://github.com/thpatch/thtk)), plus readable disassemblies in
`reference/ECL7|DSTD7|MSG7` (`thecl -d` / `thstd -d` / `thmsg -d`). With
those in place, `npm run generate-data` rebuilds the embedded data bundle
and `npm run generate-bgm` re-slices the BGM.

### Known gaps / TODO

- No frame-by-frame replay comparison yet, so frame-level parity is not
  proven.
- The registry of known approximations lives in AGENTS.md §7 (focused
  option orbit rate, bomb presentation, some HUD placements).
- Stages 2+ are not implemented.
- Legacy TH06 files (`src/vanilla/` etc.) are pending removal; they remain
  intact on the `legacy-vanilla` branch.

### Copyright

This is a non-commercial fan reimplementation and technical-study project.
Touhou Project and *Perfect Cherry Blossom* — including all characters,
music, and artwork — are the property of Team Shanghai Alice (ZUN) and
their respective rights holders. The repository ships only the runtime
asset subset; original game files are not distributed.

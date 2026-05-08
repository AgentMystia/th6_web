(function () {
  const TAU = Math.PI * 2;

  const SFX_BUFFER_IDX_VOLUME = [
    [0, -1500, 0], [0, -2000, 0], [1, -1200, 5], [1, -1400, 5],
    [2, -1000, 100], [3, -500, 100], [4, -500, 100], [5, -1700, 50],
    [6, -1700, 50], [7, -1700, 50], [8, -1000, 100], [9, -1000, 100],
    [10, -1900, 10], [11, -1200, 10], [12, -900, 100], [5, -1500, 50],
    [13, -900, 50], [14, -900, 50], [15, -600, 100], [16, -400, 100],
    [17, -1100, 0], [18, -900, 0], [5, -1800, 20], [6, -1800, 20],
    [7, -1800, 20], [19, -300, 50], [20, -600, 50], [21, -800, 50],
    [22, -100, 140], [23, -500, 100], [24, -1000, 20], [25, -1000, 90]
  ];

  const STAGE1_META = {
    stageNumber: 1,
    title: {
      primary: 'STAGE 1',
      japanese: '夢幻夜行絵巻',
      english: 'Mystic Flier'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 7600,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: 'Rumia',
    spells: [
      'Moon Sign "Moonlight Ray"',
      'Night Sign "Night Bird"',
      'Darkness Sign "Demarcation"'
    ],
    music: ['stage1', 'boss1'],
    musicLabels: ['A Soul as Red as a Ground Cherry', 'Apparitions Stalk the Night'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦'
  };

  const DIFFICULTY_INFO = {
    easy: { rank: 16, minRank: 12, maxRank: 20 },
    normal: { rank: 16, minRank: 10, maxRank: 32 },
    hard: { rank: 16, minRank: 10, maxRank: 32 },
    lunatic: { rank: 16, minRank: 10, maxRank: 32 },
    extra: { rank: 16, minRank: 14, maxRank: 18 }
  };

  const POWER_UP_THRESHOLDS = [8, 16, 32, 48, 64, 80, 96, 128, 999, 1, 0];
  const POWER_ITEM_SCORE = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700,
    800, 900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
    11000, 12000, 51200
  ];
  const SPELLCARD_SCORE = [
    200000, 200000, 200000, 200000, 200000, 200000, 200000, 250000, 250000, 250000, 250000, 250000, 250000,
    250000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000,
    300000, 300000, 300000, 300000, 300000, 300000, 400000, 400000, 400000, 400000, 400000, 400000, 400000,
    400000, 500000, 500000, 500000, 500000, 500000, 500000, 600000, 600000, 600000, 600000, 600000, 700000,
    700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000
  ];
  const POINT_SCORE_TABLE = {
    easy: { top: 100000, bottom: 60000, multiplier: 100 },
    normal: { top: 100000, bottom: 60000, multiplier: 100 },
    hard: { top: 150000, bottom: 100000, multiplier: 180 },
    lunatic: { top: 200000, bottom: 150000, multiplier: 270 },
    extra: { top: 300000, bottom: 200000, multiplier: 400 }
  };

  const EFFECT_COLORS_WITH_TEXTURE = [
    0xff000000, 0xff303030, 0xff606060, 0xff500000, 0xff900000, 0xffff2020, 0xff400040,
    0xff800080, 0xffff30ff, 0xff000050, 0xff000090, 0xff2020ff, 0xff203060, 0xff304090,
    0xff3080ff, 0xff005000, 0xff009000, 0xff20ff20, 0xff206000, 0xff409010, 0xff80ff20,
    0xff505000, 0xff909000, 0xffffff20, 0xff603000, 0xff904010, 0xfff08020, 0xffffffff
  ];

  const PLAYER_SYSTEM = {
    hitboxHalf: { x: 1.25, y: 1.25, z: 5 },
    grazePadding: 20,
    itemGrabHalf: { x: 12, y: 12, z: 5 },
    movementArea: { x: 8, y: 16, width: 368, height: 416 },
    speeds: {
      reimu: { normal: 4, focus: 2 },
      marisa: { normal: 5, focus: 2.5 }
    }
  };

  const BULLET_TYPE_NAMES = [
    'pellet', 'ringBall', 'rice', 'ball', 'kunai',
    'shard', 'bigBall', 'fireball', 'dagger', 'bubble'
  ];

  function bulletGrazeSize(spriteType, height) {
    if (height <= 8) return { x: 4, y: 4 };
    if (height <= 16) {
      if (spriteType === 2 || spriteType === 5) return { x: 4, y: 4 };
      if (spriteType === 4) return { x: 5, y: 5 };
      return { x: 6, y: 6 };
    }
    if (height <= 32) {
      if (spriteType === 7) return { x: 11, y: 11 };
      if (spriteType === 8) return { x: 9, y: 9 };
      return { x: 16, y: 16 };
    }
    return { x: 32, y: 32 };
  }

  const DIALOGUE_ZH_CN = new Map(Object.entries({
    '久々のお仕事だわ。': '久违的工作啊。',
    '気持ちいいわね': '真舒服呢',
    '毎回、昼間に出発して悪霊が少ない': '每次都在白天出发，恶灵比较少',
    'から、夜に出てみたんだけど...': '所以这次试着晚上出来了...',
    'どこに行っていいかわからないわ': '可是完全不知道该往哪里走呢',
    '暗くて': '黑漆漆的',
    'でも...': '不过...',
    '夜の境内裏はロマンティックね': '夜晚的神社后院很浪漫呢',
    '（←のんき）': '（←悠闲）',
    'そうなのよね～': '是这样呢～',
    'お化けも出るし、たまんないわ': '还会有妖怪出现，真受不了啊',
    'って、': '话说，',
    'あんた誰？': '你是谁？',
    '宵闇の妖怪': '宵暗的妖怪',
    'ルーミア': '露米娅',
    'さっき会ったじゃない': '刚才不是见过了吗',
    'あんた、もしかして鳥目？': '你该不会是夜盲吧？',
    '人は暗いところでは物が': '人类在黑暗的地方',
    '良く見えないのよ': '看不清东西啊',
    'あら？夜しか活動しない人も': '哎呀？我好像也见过',
    '見たことある気がするわ': '只在夜里活动的人呢',
    'それは取って食べたりしても': '那种可以抓来吃掉',
    'いいのよ': '也没关系哦',
    'そーなのかー': '是这样吗～',
    'で、邪魔なんですけど': '所以说，你很碍事',
    '目の前が取って食べれる人類？': '眼前这个是可以抓来吃的人类？',
    '良薬は口に苦し': '你知道“良药苦口”',
    'って言葉知ってる？': '这句话吗？',
    '良薬っていっても': '虽说是良药',
    '飲んでみなけりゃわかんないけどね': '不喝下去也不会知道呢'
  }));

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function truncDiv(n, d) {
    return Math.trunc(n / d);
  }

  function rankInfo(difficulty = 'lunatic') {
    const info = DIFFICULTY_INFO[difficulty];
    if (!info) throw new Error(`Unknown TH06 difficulty: ${difficulty}`);
    return info;
  }

  function adjustRankState(rank, subRank, amount, difficulty = 'lunatic') {
    const info = rankInfo(difficulty);
    let nextRank = rank | 0;
    let nextSubRank = (subRank | 0) + (amount | 0);
    while (nextSubRank >= 100) {
      nextRank++;
      nextSubRank -= 100;
    }
    while (nextSubRank < 0) {
      nextRank--;
      nextSubRank += 100;
    }
    nextRank = clamp(nextRank, info.minRank, info.maxRank);
    return { rank: nextRank, subRank: nextSubRank };
  }

  function powerThresholdIndex(power) {
    let idx = 0;
    while (power >= POWER_UP_THRESHOLDS[idx]) idx++;
    return idx;
  }

  function collectPowerItem(power, powerItemCountForScore, amount) {
    let nextPower = clamp(power | 0, 0, 128);
    let nextPowerScoreCount = clamp(powerItemCountForScore | 0, 0, 30);
    if (nextPower >= 128) {
      nextPowerScoreCount = clamp(nextPowerScoreCount + amount, 0, 30);
      return {
        power: 128,
        powerItemCountForScore: nextPowerScoreCount,
        score: POWER_ITEM_SCORE[nextPowerScoreCount],
        powerUp: false,
        fullPower: false
      };
    }
    const beforeIdx = powerThresholdIndex(nextPower);
    nextPowerScoreCount = 0;
    nextPower = clamp(nextPower + amount, 0, 128);
    const fullPower = nextPower >= 128;
    const afterIdx = powerThresholdIndex(nextPower);
    return {
      power: nextPower,
      powerItemCountForScore: nextPowerScoreCount,
      score: 10,
      powerUp: afterIdx !== beforeIdx,
      fullPower
    };
  }

  function pointItemScore(y, difficulty = 'lunatic') {
    const table = POINT_SCORE_TABLE[difficulty];
    if (!table) throw new Error(`Unknown TH06 point item score difficulty: ${difficulty}`);
    const yy = Math.trunc(y);
    return yy < 128 ? table.top : table.bottom - ((yy - 128) * table.multiplier);
  }

  function pointBulletScore(graze, bombActive = false) {
    return bombActive ? 100 : Math.trunc(graze / 3) * 10 + 500;
  }

  function missPowerDrops(livesRemaining) {
    if ((livesRemaining | 0) > 0) return ['bigPower', 'power', 'power', 'power', 'power', 'power'];
    return ['fullPower', 'fullPower', 'fullPower', 'fullPower', 'fullPower'];
  }

  function spellcardBonus(spellId, secondsRemaining) {
    const base = SPELLCARD_SCORE[((spellId | 0) % SPELLCARD_SCORE.length + SPELLCARD_SCORE.length) % SPELLCARD_SCORE.length];
    return base + Math.trunc(base * Math.max(0, secondsRemaining | 0) / 10);
  }

  function shootIntervalForRank(baseInterval, rank) {
    const base = baseInterval | 0;
    const low = truncDiv(base, 5);
    const high = truncDiv(-base, 5);
    return Math.max(0, base + truncDiv((rank | 0) * (high - low), 32) + low);
  }

  function effectColorCss(color) {
    const value = color >>> 0;
    const a = ((value >>> 24) & 0xff) / 255;
    const r = (value >>> 16) & 0xff;
    const g = (value >>> 8) & 0xff;
    const b = value & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  function effectColorById(id) {
    return EFFECT_COLORS_WITH_TEXTURE[((id % EFFECT_COLORS_WITH_TEXTURE.length) + EFFECT_COLORS_WITH_TEXTURE.length) % EFFECT_COLORS_WITH_TEXTURE.length];
  }

  function localizeDialogueText(text) {
    if (!text) return text || '';
    const trimmed = text.trim();
    const translated = DIALOGUE_ZH_CN.get(trimmed);
    return translated || text;
  }

  function steerVelocity(x, y, vx, vy, speed, target, divisor) {
    const dx = target.x - x;
    const dy = target.y - y;
    let len = Math.hypot(dx, dy) / Math.max(0.0001, speed / divisor);
    if (len < 1) len = 1;
    const sx = dx / len + vx;
    const sy = dy / len + vy;
    let nextSpeed = Math.hypot(sx, sy);
    if (nextSpeed <= 0.0001) return { vx, vy, speed };
    nextSpeed = clamp(nextSpeed, 1, 10);
    return {
      vx: sx * nextSpeed / Math.hypot(sx, sy),
      vy: sy * nextSpeed / Math.hypot(sx, sy),
      speed: nextSpeed
    };
  }

  function updateHomingBullet(bullet, target) {
    bullet.homingFrame = bullet.homingFrame || 0;
    bullet.speed = bullet.speed || Math.hypot(bullet.vx, bullet.vy) || 1;
    if (target && target.x > -100 && bullet.homingFrame < 40) {
      const next = steerVelocity(bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.speed, target, 4);
      bullet.vx = next.vx;
      bullet.vy = next.vy;
      bullet.speed = next.speed;
    } else if (bullet.speed < 10) {
      const len = Math.hypot(bullet.vx, bullet.vy) || 1;
      bullet.speed = Math.min(10, bullet.speed + 0.33333333);
      bullet.vx = bullet.vx * bullet.speed / len;
      bullet.vy = bullet.vy * bullet.speed / len;
    }
    bullet.homingFrame++;
    return bullet;
  }

  function chooseHomingTarget(enemies) {
    let target = { x: -999, y: -999 };
    for (const enemy of enemies || []) {
      if (!enemy || enemy.dead || enemy.hp <= 0) continue;
      if (enemy.ecl && enemy.ecl.canTakeDamage === false) continue;
      if (target.y < enemy.y) target = { x: enemy.x, y: enemy.y };
    }
    return target;
  }

  function playerShotDamageForEnemy(damage, bombActive = false) {
    const base = Math.trunc(damage);
    if (!bombActive) return base;
    return base ? Math.max(1, Math.trunc(base / 3)) : 0;
  }

  function capEnemyFrameDamage(totalDamage) {
    return Math.max(0, Math.min(70, Math.trunc(totalDamage)));
  }

  function spellcardDamageForEnemy(cappedDamage, hitWithBombRegion = false, usedBomb = false) {
    const damage = Math.trunc(cappedDamage);
    if (damage <= 0) return 0;
    if (!hitWithBombRegion) return damage > 7 ? Math.trunc(damage / 7) : 1;
    if (usedBomb) return damage > 3 ? Math.trunc(damage / 3) : 1;
    return 0;
  }

  function createReimuABomb(player, rng) {
    if (typeof rng !== 'function') throw new Error('ReimuA Dream Seal requires the original game RNG stream');
    return {
      type: 'reimuA',
      label: 'Dream Seal',
      frame: 0,
      duration: 300,
      invuln: 360,
      initialized: false,
      rng,
      projectiles: Array.from({ length: 8 }, () => ({
        state: 0,
        stateFrame: 0,
        age: 0,
        charge: 0,
        x: player.x,
        y: player.y,
        vx: 0,
        vy: 0,
        speed: 4
      }))
    };
  }

  function createReimuBBomb(player) {
    return {
      type: 'reimuB',
      label: 'Evil Sealing Circle',
      frame: 0,
      duration: 140,
      invuln: 200,
      initialized: false,
      beams: [
        { x: player.x, y: 224, w: 62, h: 448 },
        { x: 192, y: player.y, w: 384, h: 62 },
        { x: player.x, y: 224, w: 62, h: 448 },
        { x: 192, y: player.y, w: 384, h: 62 }
      ]
    };
  }

  function createMarisaABomb(player) {
    return {
      type: 'marisaA',
      label: 'Stardust Reverie',
      frame: 0,
      duration: 250,
      invuln: 300,
      initialized: false,
      stars: Array.from({ length: 8 }, (_, i) => {
        const angle = i * TAU / 8;
        return {
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * 2,
          vy: Math.sin(angle) * 2,
          angle
        };
      })
    };
  }

  function createMarisaBBomb(player) {
    return {
      type: 'marisaB',
      label: 'Master Spark',
      frame: 0,
      duration: 300,
      invuln: 360,
      initialized: false,
      x: 192,
      y: player.y / 2,
      w: 384,
      h: player.y
    };
  }

  function updateReimuABomb(bomb, ctx) {
    const frame = bomb.frame;
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.('Dream Seal');
      ctx.onParticles?.(12, ctx.player.x, ctx.player.y, 1, 0xff40ffff);
      ctx.onCancelBox?.(ctx.player.x, ctx.player.y, 256, 256);
    }

    if (frame >= 60 && frame < 180 && frame % 16 === 0) {
      const idx = Math.trunc((frame - 60) / 16);
      if (idx > 0 && idx < bomb.projectiles.length) {
        const p = bomb.projectiles[idx];
        const angle = bomb.rng() * TAU - Math.PI;
        p.state = 1;
        p.stateFrame = 0;
        p.age = 0;
        p.charge = 0;
        p.speed = 4;
        p.x = ctx.player.x;
        p.y = ctx.player.y;
        p.vx = Math.cos(angle) * p.speed;
        p.vy = Math.sin(angle) * p.speed;
        ctx.onSound?.(13);
      }
    }

    for (const p of bomb.projectiles) {
      if (!p.state) continue;
      if (p.state === 1) {
        const target = ctx.lastEnemyHit && ctx.lastEnemyHit.x > -100 ? ctx.lastEnemyHit : ctx.player;
        const next = steerVelocity(p.x, p.y, p.vx, p.vy, p.speed, target, 8);
        p.vx = next.vx;
        p.vy = next.vy;
        p.speed = next.speed;
        const landed = ctx.onDamageBox?.(p.x, p.y, 48, 48, 8, 'bomb') || 0;
        p.charge += landed;
        ctx.onCancelBox?.(p.x, p.y, 48, 48);
        if (p.charge >= 100 || frame >= bomb.duration - 30) {
          ctx.onParticles?.(6, p.x, p.y, 8, 0xffffffff);
          ctx.onParticles?.(12, p.x, p.y, 1, 0xff40ffff);
          ctx.onDamageBox?.(p.x, p.y, 256, 256, 200, 'bombExplosion');
          ctx.onCancelBox?.(p.x, p.y, 256, 256);
          p.state = 2;
          p.stateFrame = 2;
          ctx.onSound?.(15);
          ctx.onShake?.(16, 8);
        }
      } else if (p.state === 2) {
        p.stateFrame++;
        if (p.stateFrame >= 30) p.state = 0;
      }
      if (p.state) {
        p.age++;
        p.x += p.vx;
        p.y += p.vy;
      }
    }

    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function updateReimuBBomb(bomb, ctx) {
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.(bomb.label);
      ctx.onSound?.(6);
      ctx.onShake?.(60, 2);
    }
    if (bomb.frame === 60) ctx.onShake?.(80, 20);
    if (bomb.frame > 0 && bomb.frame % 2 !== 0) {
      for (let i = 0; i < bomb.beams.length; i++) {
        const beam = bomb.beams[i];
        const frame = ctx.onBombFrame?.('reimuB', i, bomb.frame);
        const x = beam.x + (frame?.posOffsetX || 0);
        const y = beam.y + (frame?.posOffsetY || 0);
        ctx.onDamageBox?.(x, y, beam.w, beam.h, 8, 'bombReimuB');
        ctx.onCancelBox?.(x, y, beam.w, beam.h);
      }
    }
    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function updateMarisaABomb(bomb, ctx) {
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.(bomb.label);
      ctx.onSound?.(6);
      ctx.onShake?.(120, 4);
    } else {
      for (const star of bomb.stars) {
        star.x += star.vx;
        star.y += star.vy;
        if (bomb.frame % 3 !== 0) {
          ctx.onDamageBox?.(star.x, star.y, 128, 128, 8, 'bombMarisaA');
          ctx.onCancelBox?.(star.x, star.y, 128, 128);
        }
      }
    }
    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function updateMarisaBBomb(bomb, ctx) {
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.(bomb.label);
      ctx.onSound?.(19);
    } else {
      if (bomb.frame === 60) ctx.onShake?.(60, 1);
      else if (bomb.frame === 120) ctx.onShake?.(200, 24);
      if (bomb.frame % 4 !== 0) {
        bomb.y = ctx.player.y / 2;
        bomb.h = ctx.player.y;
        ctx.onDamageBox?.(192, bomb.y, 384, bomb.h, 12, 'bombMarisaB');
        ctx.onCancelBox?.(192, bomb.y, 384, bomb.h);
      }
    }
    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function stage1SpellName(index) {
    const name = STAGE1_META.spells[index];
    if (!name) throw new Error(`Unknown Stage 1 spell index: ${index}`);
    return name;
  }

  globalThis.TH06Logic = {
    DIALOGUE_ZH_CN,
    DIFFICULTY_INFO,
    POWER_UP_THRESHOLDS,
    POWER_ITEM_SCORE,
    SPELLCARD_SCORE,
    PLAYER_SYSTEM,
    BULLET_TYPE_NAMES,
    SFX_BUFFER_IDX_VOLUME,
    STAGE1_META,
    bulletGrazeSize,
    adjustRankState,
    collectPowerItem,
    effectColorById,
    effectColorCss,
    pointBulletScore,
    pointItemScore,
    spellcardBonus,
    createReimuABomb,
    createReimuBBomb,
    createMarisaABomb,
    createMarisaBBomb,
    localizeDialogueText,
    missPowerDrops,
    stage1SpellName,
    updateHomingBullet,
    chooseHomingTarget,
    playerShotDamageForEnemy,
    capEnemyFrameDamage,
    spellcardDamageForEnemy,
    shootIntervalForRank,
    updateReimuABomb,
    updateReimuBBomb,
    updateMarisaABomb,
    updateMarisaBBomb
  };
})();

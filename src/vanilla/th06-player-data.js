(() => {
  'use strict';

  const global = typeof window !== 'undefined' ? window : globalThis;
  const SHOOT = 0;
  const B0 = 0;
  const B2 = 2;
  const LASER = 3;
  const PLAYER_BULLET = 64;
  const REIMU_B_ORB = 66;
  const MARISA_A_ORB_1 = 65;
  const MARISA_A_ORB_2 = 66;
  const MARISA_A_ORB_3 = 67;
  const MARISA_A_ORB_4 = 68;
  const MARISA_B_LASER_1 = 69;
  const MARISA_B_LASER_2 = 70;
  const MARISA_B_LASER_3 = 71;

  function pb([wait, frame, ox, oy, sx, sy, deg, speed, damage, source, bulletType, script, sound = -1]) {
    const angle = deg * Math.PI / 180;
    return { wait, frame, ox, oy, sx, sy, angle, speed, damage, source, bulletType, script, sound };
  }

  function makePowerTable(rows) {
    return rows.map(([max, bullets]) => ({ max, bullets: bullets.map(pb) }));
  }

  const REIMU_B_POWER = makePowerTable([
    [8, [[5, 0, 0, 0, 12, 12, -90, 12, 48, 0, B0, PLAYER_BULLET, SHOOT]]],
    [16, [
      [5, 0, 0, 0, 12, 12, -90, 12, 48, 0, B0, PLAYER_BULLET, SHOOT],
      [15, 0, 0, -16, 12, 40, -90, 22, 12, 1, B0, REIMU_B_ORB],
      [15, 0, 0, -16, 12, 40, -90, 22, 12, 2, B0, REIMU_B_ORB]
    ]],
    [32, [
      [5, 0, -4, 0, 12, 12, -91, 12, 32, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 4, 0, 12, 12, -89, 12, 32, 0, B0, PLAYER_BULLET],
      [10, 0, 0, -16, 12, 40, -90, 22, 12, 1, B0, REIMU_B_ORB],
      [10, 0, 0, -16, 12, 40, -90, 22, 12, 2, B0, REIMU_B_ORB]
    ]],
    [48, [
      [5, 0, -4, 0, 12, 12, -91, 12, 30, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 4, 0, 12, 12, -89, 12, 30, 0, B0, PLAYER_BULLET],
      [8, 0, 0, -16, 12, 40, -90, 22, 12, 1, B0, REIMU_B_ORB],
      [8, 0, 0, -16, 12, 40, -90, 22, 12, 2, B0, REIMU_B_ORB]
    ]],
    [64, [
      [5, 0, 0, 0, 12, 12, -97, 12, 20, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 28, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -83, 12, 20, 0, B0, PLAYER_BULLET],
      [8, 0, 0, -16, 12, 40, -90, 22, 12, 1, B0, REIMU_B_ORB],
      [8, 0, 0, -16, 12, 40, -90, 22, 12, 2, B0, REIMU_B_ORB]
    ]],
    [80, [
      [5, 0, 0, 0, 12, 12, -97, 12, 16, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 27, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -83, 12, 16, 0, B0, PLAYER_BULLET],
      [5, 0, 8, -16, 12, 40, -90, 22, 12, 1, B0, REIMU_B_ORB],
      [5, 0, 8, -16, 12, 40, -90, 22, 12, 2, B0, REIMU_B_ORB],
      [8, 0, -8, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB],
      [8, 0, -8, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB]
    ]],
    [96, [
      [5, 0, 0, 0, 12, 12, -98, 12, 16, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 22, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -82, 12, 16, 0, B0, PLAYER_BULLET],
      [3, 0, 8, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB, SHOOT],
      [3, 0, 8, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB],
      [5, 0, -8, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB],
      [5, 0, -8, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB]
    ]],
    [127, [
      [5, 0, 0, 0, 12, 12, -106, 12, 9, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -98, 12, 17, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -90, 12, 20, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -82, 12, 17, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -74, 12, 9, 0, B0, PLAYER_BULLET],
      [3, 0, 12, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB, SHOOT],
      [3, 0, 12, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB],
      [5, 0, -12, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB],
      [5, 0, -12, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB],
      [10, 0, 0, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB],
      [10, 0, 0, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB]
    ]],
    [999, [
      [5, 0, 0, 0, 12, 12, -106, 12, 9, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -98, 12, 17, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -90, 12, 20, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -82, 12, 17, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -74, 12, 9, 0, B0, PLAYER_BULLET],
      [3, 0, 12, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB, SHOOT],
      [3, 0, 12, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB],
      [3, 0, -12, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB],
      [3, 0, -12, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB],
      [5, 0, 0, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB],
      [5, 0, 0, -16, 12, 40, -90, 22, 10, 2, B0, REIMU_B_ORB]
    ]]
  ]);

  const MARISA_A_POWER = makePowerTable([
    [8, [[5, 0, 0, -8, 12, 24, -90, 12, 48, 0, B0, PLAYER_BULLET, SHOOT]]],
    [16, [
      [5, 0, 0, -8, 12, 24, -90, 12, 36, 0, B0, PLAYER_BULLET, SHOOT],
      [30, 0, 0, 0, 12, 12, -90, 3, 18, 1, B2, MARISA_A_ORB_1],
      [30, 0, 0, 0, 12, 12, -90, 3, 18, 2, B2, MARISA_A_ORB_1]
    ]],
    [32, [
      [5, 0, 0, -8, 12, 24, -90, 12, 32, 0, B0, PLAYER_BULLET, SHOOT],
      [30, 0, 0, 0, 12, 12, -95, 3, 16, 1, B2, MARISA_A_ORB_1],
      [30, 0, 0, 0, 12, 12, -85, 3, 16, 2, B2, MARISA_A_ORB_1],
      [30, 15, 0, 0, 12, 12, -85, 3, 10, 1, B2, MARISA_A_ORB_1],
      [30, 15, 0, 0, 12, 12, -95, 3, 10, 2, B2, MARISA_A_ORB_1]
    ]],
    [48, [
      [5, 0, 0, -8, 12, 24, -90, 12, 32, 0, B0, PLAYER_BULLET, SHOOT],
      [15, 0, 0, 0, 12, 12, -95, 3, 15, 1, B2, MARISA_A_ORB_1],
      [15, 0, 0, 0, 12, 12, -85, 3, 15, 2, B2, MARISA_A_ORB_1],
      [15, 15, 0, 0, 12, 12, -85, 3, 10, 1, B2, MARISA_A_ORB_1],
      [15, 15, 0, 0, 12, 12, -95, 3, 10, 2, B2, MARISA_A_ORB_1]
    ]],
    [64, [
      [5, 0, 0, -8, 12, 24, -90, 12, 32, 0, B0, PLAYER_BULLET, SHOOT],
      [15, 0, 0, 0, 12, 12, -95, 3, 16, 1, B2, MARISA_A_ORB_2],
      [15, 0, 0, 0, 12, 12, -85, 3, 16, 2, B2, MARISA_A_ORB_2],
      [15, 20, 0, 0, 12, 12, -85, 3, 11, 1, B2, MARISA_A_ORB_2],
      [15, 20, 0, 0, 12, 12, -95, 3, 11, 2, B2, MARISA_A_ORB_2]
    ]],
    [80, [
      [5, 0, -8, -8, 12, 24, -90, 12, 16, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 8, -8, 12, 24, -90, 12, 16, 0, B0, PLAYER_BULLET],
      [10, 0, 0, 0, 12, 12, -95, 3, 16, 1, B2, MARISA_A_ORB_2],
      [10, 0, 0, 0, 12, 12, -85, 3, 16, 2, B2, MARISA_A_ORB_2],
      [15, 5, 0, 0, 12, 12, -85, 3, 10, 1, B2, MARISA_A_ORB_2],
      [15, 5, 0, 0, 12, 12, -95, 3, 10, 2, B2, MARISA_A_ORB_2]
    ]],
    [96, [
      [5, 0, -8, -8, 12, 24, -90, 12, 13, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 8, -8, 12, 24, -90, 12, 13, 0, B0, PLAYER_BULLET],
      [10, 0, 0, 0, 12, 12, -98, 3, 16, 1, B2, MARISA_A_ORB_3],
      [10, 0, 0, 0, 12, 12, -82, 3, 16, 2, B2, MARISA_A_ORB_3],
      [10, 5, 0, 0, 12, 12, -82, 3, 10, 1, B2, MARISA_A_ORB_3],
      [10, 5, 0, 0, 12, 12, -98, 3, 10, 2, B2, MARISA_A_ORB_3]
    ]],
    [127, [
      [5, 0, 0, 0, 12, 12, -94, 12, 8, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 12, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -86, 12, 8, 0, B0, PLAYER_BULLET],
      [10, 0, 0, 0, 12, 12, -98, 3, 15, 1, B2, MARISA_A_ORB_3],
      [10, 0, 0, 0, 12, 12, -82, 3, 15, 2, B2, MARISA_A_ORB_3],
      [10, 5, 0, 0, 12, 12, -82, 3, 10, 1, B2, MARISA_A_ORB_3],
      [10, 5, 0, 0, 12, 12, -98, 3, 10, 2, B2, MARISA_A_ORB_3],
      [15, 0, 0, 0, 12, 12, -78, 3, 9, 1, B2, MARISA_A_ORB_3],
      [15, 0, 0, 0, 12, 12, -102, 3, 9, 2, B2, MARISA_A_ORB_3]
    ]],
    [999, [
      [5, 0, 0, 0, 12, 12, -94, 12, 8, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 12, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -86, 12, 8, 0, B0, PLAYER_BULLET],
      [10, 0, 0, 0, 12, 12, -98, 3, 14, 1, B2, MARISA_A_ORB_4],
      [10, 0, 0, 0, 12, 12, -82, 3, 14, 2, B2, MARISA_A_ORB_4],
      [10, 5, 0, 0, 12, 12, -82, 3, 10, 1, B2, MARISA_A_ORB_4],
      [10, 5, 0, 0, 12, 12, -98, 3, 10, 2, B2, MARISA_A_ORB_4],
      [10, 0, 0, 0, 12, 12, -75, 3, 10, 1, B2, MARISA_A_ORB_4],
      [10, 0, 0, 0, 12, 12, -105, 3, 10, 2, B2, MARISA_A_ORB_4]
    ]]
  ]);

  const MARISA_B_POWER = makePowerTable([
    [8, [[5, 0, 0, -8, 12, 24, -90, 12, 48, 0, B0, PLAYER_BULLET, SHOOT]]],
    [16, [
      [5, 0, 0, -8, 12, 24, -90, 12, 32, 0, B0, PLAYER_BULLET, SHOOT],
      [120, 0, 0, 0, 10, 480, -90, 3, 3, 1, LASER, MARISA_B_LASER_1],
      [120, 1, 0, 0, 10, 480, -90, 3, 3, 2, LASER, MARISA_B_LASER_1]
    ]],
    [32, [
      [5, 0, 0, -8, 12, 24, -90, 12, 32, 0, B0, PLAYER_BULLET, SHOOT],
      [170, 0, 0, 0, 10, 480, -90, 3, 3, 1, LASER, MARISA_B_LASER_1],
      [170, 1, 0, 0, 10, 480, -90, 3, 3, 2, LASER, MARISA_B_LASER_1]
    ]],
    [48, [
      [5, 0, -8, -8, 12, 24, -92, 12, 22, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 8, -8, 12, 24, -88, 12, 22, 0, B0, PLAYER_BULLET],
      [200, 0, 0, 0, 10, 480, -90, 3, 3, 1, LASER, MARISA_B_LASER_1],
      [200, 1, 0, 0, 10, 480, -90, 3, 3, 2, LASER, MARISA_B_LASER_1]
    ]],
    [64, [
      [5, 0, -8, -8, 12, 24, -92, 12, 22, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 8, -8, 12, 24, -88, 12, 22, 0, B0, PLAYER_BULLET],
      [210, 0, 0, 0, 10, 480, -90, 3, 3, 1, LASER, MARISA_B_LASER_2],
      [210, 1, 0, 0, 10, 480, -90, 3, 3, 2, LASER, MARISA_B_LASER_2]
    ]],
    [80, [
      [5, 0, -8, -8, 12, 24, -92, 12, 20, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 8, -8, 12, 24, -88, 12, 20, 0, B0, PLAYER_BULLET],
      [230, 0, 0, 0, 15, 480, -90, 3, 4, 1, LASER, MARISA_B_LASER_2],
      [230, 1, 0, 0, 15, 480, -90, 3, 4, 2, LASER, MARISA_B_LASER_2]
    ]],
    [96, [
      [5, 0, 0, 0, 12, 12, -95, 12, 15, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 20, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -85, 12, 15, 0, B0, PLAYER_BULLET],
      [250, 0, 0, 0, 15, 480, -90, 3, 4, 1, LASER, MARISA_B_LASER_2],
      [250, 1, 0, 0, 15, 480, -90, 3, 4, 2, LASER, MARISA_B_LASER_2]
    ]],
    [127, [
      [5, 0, 0, 0, 12, 12, -95, 12, 15, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -90, 12, 20, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -85, 12, 15, 0, B0, PLAYER_BULLET],
      [270, 0, 0, 0, 20, 480, -90, 3, 5, 1, LASER, MARISA_B_LASER_3],
      [270, 1, 0, 0, 20, 480, -90, 3, 5, 2, LASER, MARISA_B_LASER_3]
    ]],
    [999, [
      [5, 0, 0, 0, 12, 12, -100, 12, 12, 0, B0, PLAYER_BULLET, SHOOT],
      [5, 0, 0, 0, 12, 12, -95, 12, 15, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -90, 12, 20, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -85, 12, 15, 0, B0, PLAYER_BULLET],
      [5, 0, 0, 0, 12, 12, -80, 12, 12, 0, B0, PLAYER_BULLET],
      [330, 0, 0, 0, 20, 480, -90, 3, 6, 1, LASER, MARISA_B_LASER_3],
      [330, 1, 0, 0, 20, 480, -90, 3, 6, 2, LASER, MARISA_B_LASER_3]
    ]]
  ]);

  global.TH06PlayerData = {
    BULLET_TYPE_NORMAL: B0,
    BULLET_TYPE_ACCEL: B2,
    BULLET_TYPE_LASER: LASER,
    powerTables: {
      reimuB: REIMU_B_POWER,
      marisaA: MARISA_A_POWER,
      marisaB: MARISA_B_POWER
    }
  };
})();

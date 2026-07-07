export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Matches the original engine's angle normalization: ±π stays put, everything
// else wraps into (-π, π].
export function normalizeAngle(v: number): number {
  const EPS = 1e-6;
  if (Math.abs(v - Math.PI) <= EPS) return Math.PI;
  if (Math.abs(v + Math.PI) <= EPS) return -Math.PI;
  while (v < -Math.PI) v += TAU;
  while (v > Math.PI) v -= TAU;
  return v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

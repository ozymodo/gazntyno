// Deterministic pseudo-random from a string seed, so an orb's spot and
// drift pattern stay put across reloads without persisting layout — same
// trick as HomeButton's letter scatter.
export function hashSeed(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function seeded(seed: number, salt: number) {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export type OrbPosition = { left: number; top: number };
export type OrbDrift = { driftX: number; driftY: number; duration: number; delay: number };

// Spreads orbs across a loose grid (by index/total) with per-orb jitter, so
// a handful of items don't cluster yet many items don't overlap.
export function gridPosition(seed: number, index: number, total: number): OrbPosition {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = 100 / cols;
  const cellH = 100 / rows;
  const jitterX = (seeded(seed, 5) - 0.5) * cellW * 0.7;
  const jitterY = (seeded(seed, 6) - 0.5) * cellH * 0.7;
  const left = Math.min(92, Math.max(8, cellW * (col + 0.5) + jitterX));
  const top = Math.min(88, Math.max(12, cellH * (row + 0.5) + jitterY));
  return { left, top };
}

export function driftParams(seed: number): OrbDrift {
  const driftX = 14 + seeded(seed, 7) * 16;
  const driftY = 10 + seeded(seed, 8) * 14;
  const duration = 7 + seeded(seed, 9) * 5;
  const delay = -seeded(seed, 10) * duration;
  return { driftX, driftY, duration, delay };
}

/**
 * How far an orb's center must stay from its container's edge on one axis -
 * half its own size (so its edge, not just its center, stays inside) plus
 * however far the drift animation swings it on that axis (so the drift's
 * peak offset doesn't push it past the edge either).
 */
export function edgeMargin(size: number, drift: number): number {
  return size / 2 + drift;
}

/**
 * A CSS `left`/`top` value that keeps an orb fully inside its container -
 * `gridPosition`'s percentage is container-size-agnostic, so on a narrow
 * (mobile) container a large orb positioned near the percentage clamp's
 * edge can still spill past the actual edge. `clamp()` re-clamps that same
 * percentage against real pixel margins at render time, in CSS, so it stays
 * correct across any viewport/resize with no measurement or JS involved -
 * the orb reads as gently turning back before it reaches the "wall" rather
 * than drifting off-screen.
 */
export function clampedAxis(percent: number, margin: number): string {
  return `clamp(${margin}px, ${percent}%, calc(100% - ${margin}px))`;
}

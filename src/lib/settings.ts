export type ColorPreset = {
  label: string;
  color: string;
};

export type ParticleDensity = "off" | "low" | "standard" | "high";
export type FontChoice = "sans" | "serif" | "mono";

export type Settings = {
  /** "r, g, b" (0-255 each) - matches the `data-accent`/`rgba(${accent}, a)` format already used across the scene.
   *  Colors only the TECHNATURE wordmark/logo and the home nav button. */
  accent: string;
  /** The ambient particle field's own color (its base tone and the brighter "lit up" version near the cursor). */
  nodeColor: string;
  /** The cursor's own color - its "digital molecule", the lines it draws to nearby particles, and its dust trail. */
  cursorColor: string;
  trailEffect: boolean;
  particleDensity: ParticleDensity;
  reducedMotion: boolean;
  font: FontChoice;
};

// Shared by all three color settings below - each just needs a swatch label
// and an "r, g, b" value.
export const COLOR_PRESETS: ColorPreset[] = [
  { label: "Forest", color: "140, 220, 150" },
  { label: "Ocean", color: "80, 170, 255" },
  { label: "Amber", color: "230, 175, 70" },
  { label: "Violet", color: "170, 130, 255" },
  { label: "Rose", color: "240, 110, 140" },
];

export const DEFAULT_SETTINGS: Settings = {
  accent: COLOR_PRESETS[0].color,
  nodeColor: "143, 255, 153",
  cursorColor: COLOR_PRESETS[0].color,
  trailEffect: true,
  particleDensity: "standard",
  reducedMotion: false,
  font: "sans",
};

const RGB_PATTERN = /^\d{1,3}, ?\d{1,3}, ?\d{1,3}$/;
function sanitizeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && RGB_PATTERN.test(v) ? v : fallback;
}

const STORAGE_KEY = "technature.settings";

// Same tiny external-store shape as blog.ts/media.ts: a module-level cache so
// every reader (React components via useSyncExternalStore, and imperative
// rAF loops via getSettingsSnapshot) shares one instance, kept in sync
// through localStorage rather than component state.
let cache: Settings = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();

function isParticleDensity(v: unknown): v is ParticleDensity {
  return v === "off" || v === "low" || v === "standard" || v === "high";
}

function isFontChoice(v: unknown): v is FontChoice {
  return v === "sans" || v === "serif" || v === "mono";
}

function sanitize(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const r = raw as Partial<Settings>;
  return {
    accent: sanitizeColor(r.accent, DEFAULT_SETTINGS.accent),
    nodeColor: sanitizeColor(r.nodeColor, DEFAULT_SETTINGS.nodeColor),
    cursorColor: sanitizeColor(r.cursorColor, DEFAULT_SETTINGS.cursorColor),
    trailEffect: typeof r.trailEffect === "boolean" ? r.trailEffect : DEFAULT_SETTINGS.trailEffect,
    particleDensity: isParticleDensity(r.particleDensity) ? r.particleDensity : DEFAULT_SETTINGS.particleDensity,
    reducedMotion: typeof r.reducedMotion === "boolean" ? r.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
    font: isFontChoice(r.font) ? r.font : DEFAULT_SETTINGS.font,
  };
}

function readFromStorage(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  cache = readFromStorage();
}

if (typeof window !== "undefined") {
  ensureHydrated();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cache = readFromStorage();
      emit();
    }
  });
}

export function subscribeSettings(listener: () => void) {
  return (listeners.add(listener), () => void listeners.delete(listener));
}

export function getSettingsSnapshot(): Settings {
  ensureHydrated();
  return cache;
}

export function getServerSettingsSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

export function updateSettings(partial: Partial<Settings>) {
  ensureHydrated();
  cache = sanitize({ ...cache, ...partial });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  emit();
}

export function resetSettings() {
  cache = DEFAULT_SETTINGS;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  emit();
}

export function hexToColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

export function colorToHex(color: string): string {
  const [r, g, b] = color.split(",").map((n) => Math.max(0, Math.min(255, parseInt(n.trim(), 10) || 0)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Parses "r, g, b" into 0-1 floats, for feeding a three.js Color. */
export function colorToUnitRgb(color: string): [number, number, number] {
  const [r, g, b] = color.split(",").map((n) => Math.max(0, Math.min(255, parseInt(n.trim(), 10) || 0)));
  return [r / 255, g / 255, b / 255];
}

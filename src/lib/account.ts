export type AccountStats = {
  posts: number;
  mediaAdded: number;
  mediaViewed: number;
  pagesVisited: number;
  minutesPlayed: number;
};

export type Account = {
  username: string;
  bio: string;
  xp: number;
  stats: AccountStats;
  /** Object URL for the stored profile picture blob, or null if none is set. Not persisted directly - derived from IndexedDB at load time. */
  pictureUrl: string | null;
};

export type LevelProgress = {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
};

const DEFAULT_STATS: AccountStats = {
  posts: 0,
  mediaAdded: 0,
  mediaViewed: 0,
  pagesVisited: 0,
  minutesPlayed: 0,
};

const DEFAULT_ACCOUNT: Account = {
  username: "",
  bio: "",
  xp: 0,
  stats: DEFAULT_STATS,
  pictureUrl: null,
};

const STORAGE_KEY = "technature.account";
// Cooldowns for awardXp's rate-limiting, kept separate from the persisted
// profile/xp record - losing these on reload just means a fresh grace period,
// not lost progress.
const cooldowns = new Map<string, number>();

// Same external-store shape as settings.ts/blog.ts.
let cache: Account = DEFAULT_ACCOUNT;
let hydrated = false;
const listeners = new Set<() => void>();

// Only the localStorage-persisted fields - pictureUrl is derived from
// IndexedDB separately and merged in by every caller below, so it's never
// clobbered by a profile/XP update or a cross-tab storage event.
type PersistedFields = Omit<Account, "pictureUrl">;

function sanitize(raw: unknown): PersistedFields {
  if (!raw || typeof raw !== "object") return DEFAULT_ACCOUNT;
  const r = raw as Partial<Account>;
  const stats = (r.stats && typeof r.stats === "object" ? r.stats : {}) as Partial<AccountStats>;
  return {
    username: typeof r.username === "string" ? r.username.slice(0, 40) : DEFAULT_ACCOUNT.username,
    bio: typeof r.bio === "string" ? r.bio.slice(0, 280) : DEFAULT_ACCOUNT.bio,
    xp: typeof r.xp === "number" && r.xp >= 0 ? r.xp : DEFAULT_ACCOUNT.xp,
    stats: {
      posts: typeof stats.posts === "number" ? stats.posts : DEFAULT_STATS.posts,
      mediaAdded: typeof stats.mediaAdded === "number" ? stats.mediaAdded : DEFAULT_STATS.mediaAdded,
      mediaViewed: typeof stats.mediaViewed === "number" ? stats.mediaViewed : DEFAULT_STATS.mediaViewed,
      pagesVisited: typeof stats.pagesVisited === "number" ? stats.pagesVisited : DEFAULT_STATS.pagesVisited,
      minutesPlayed: typeof stats.minutesPlayed === "number" ? stats.minutesPlayed : DEFAULT_STATS.minutesPlayed,
    },
  };
}

function readFromStorage(): PersistedFields {
  if (typeof window === "undefined") return DEFAULT_ACCOUNT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ACCOUNT;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_ACCOUNT;
  }
}

function persist() {
  if (typeof window !== "undefined") {
    const { username, bio, xp, stats } = cache;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, bio, xp, stats }));
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  cache = { ...readFromStorage(), pictureUrl: cache.pictureUrl };
}

if (typeof window !== "undefined") {
  ensureHydrated();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cache = { ...readFromStorage(), pictureUrl: cache.pictureUrl };
      emit();
    }
  });
}

export function subscribeAccount(listener: () => void) {
  return (listeners.add(listener), () => void listeners.delete(listener));
}

export function getAccountSnapshot(): Account {
  ensureHydrated();
  return cache;
}

export function getServerAccountSnapshot(): Account {
  return DEFAULT_ACCOUNT;
}

export function updateProfile(partial: { username?: string; bio?: string }) {
  ensureHydrated();
  cache = { ...sanitize({ ...cache, ...partial }), pictureUrl: cache.pictureUrl };
  persist();
  emit();
}

// A triangular curve - level L is first reached at 50*L*(L-1) total XP, so
// each level costs a little more than the last (100, 200, 300, ... more XP).
function xpToReachLevel(level: number) {
  return 50 * level * (level - 1);
}

export function levelProgress(xp: number): LevelProgress {
  const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
  const floorXp = xpToReachLevel(level);
  const xpForNextLevel = xpToReachLevel(level + 1) - floorXp;
  return { level, xp, xpIntoLevel: xp - floorXp, xpForNextLevel, progress: xpForNextLevel > 0 ? (xp - floorXp) / xpForNextLevel : 0 };
}

/**
 * Adds XP, rate-limited per `key` so the same action can't be spammed for
 * infinite XP (e.g. bouncing between two pages, or reopening one photo).
 * Returns whether it actually awarded anything, so callers can gate a stat
 * bump on real progress rather than every attempt.
 */
function awardXp(amount: number, key: string, cooldownMs: number, applyStats: (stats: AccountStats) => AccountStats) {
  ensureHydrated();
  const now = Date.now();
  const last = cooldowns.get(key);
  if (last !== undefined && now - last < cooldownMs) return false;
  cooldowns.set(key, now);
  cache = { ...cache, xp: cache.xp + amount, stats: applyStats(cache.stats) };
  persist();
  emit();
  return true;
}

export function awardNavigationXp() {
  awardXp(2, "nav", 20_000, (s) => ({ ...s, pagesVisited: s.pagesVisited + 1 }));
}

export function awardBlogPostXp() {
  awardXp(25, "post", 3_000, (s) => ({ ...s, posts: s.posts + 1 }));
}

export function awardMediaUploadXp() {
  awardXp(20, "media-upload", 3_000, (s) => ({ ...s, mediaAdded: s.mediaAdded + 1 }));
}

export function awardMediaViewXp(id: string) {
  awardXp(5, `media-view:${id}`, 60_000, (s) => ({ ...s, mediaViewed: s.mediaViewed + 1 }));
}

export function awardMicrobyteMinute() {
  awardXp(5, "microbyte-minute", 50_000, (s) => ({ ...s, minutesPlayed: s.minutesPlayed + 1 }));
}

// The profile picture is the one binary blob this module deals with, so it
// lives in IndexedDB (same reasoning as media.ts) instead of localStorage -
// everything else above is small enough to just be JSON.
const PICTURE_DB_NAME = "technature-account";
const PICTURE_STORE = "picture";
const PICTURE_DB_VERSION = 1;
const PICTURE_RECORD_ID = "me";

function openPictureDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PICTURE_DB_NAME, PICTURE_DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PICTURE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withPictureStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openPictureDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PICTURE_STORE, mode);
    const request = run(tx.objectStore(PICTURE_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let currentPictureUrl: string | null = null;

function setPictureUrl(url: string | null) {
  if (currentPictureUrl) URL.revokeObjectURL(currentPictureUrl);
  currentPictureUrl = url;
  cache = { ...cache, pictureUrl: url };
  emit();
}

async function loadPicture() {
  try {
    const record = await withPictureStore<{ id: string; blob: Blob } | undefined>("readonly", (store) =>
      store.get(PICTURE_RECORD_ID),
    );
    if (record) setPictureUrl(URL.createObjectURL(record.blob));
  } catch {
    // No stored picture yet, or IndexedDB unavailable - leave it null.
  }
}

if (typeof window !== "undefined" && "indexedDB" in window) {
  loadPicture();
}

export async function setProfilePicture(file: File): Promise<void> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  await withPictureStore("readwrite", (store) => store.put({ id: PICTURE_RECORD_ID, blob: file }));
  setPictureUrl(URL.createObjectURL(file));
}

export async function clearProfilePicture(): Promise<void> {
  await withPictureStore("readwrite", (store) => store.delete(PICTURE_RECORD_ID));
  setPictureUrl(null);
}

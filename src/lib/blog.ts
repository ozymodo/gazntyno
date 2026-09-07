export type BlogPost = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "zyme.blog.posts";
// The key this used before the project was renamed to zyme. Read as a
// fallback (never written) so locally cached posts carry over.
const LEGACY_STORAGE_KEY = "technature.blog.posts";

// Posts live in localStorage, mirrored through a tiny external-store cache so
// components read them with useSyncExternalStore instead of loading in an
// effect and calling setState — the snapshot getter needs a stable reference,
// which a plain localStorage read on every call can't give.
let cache: BlogPost[] | null = null;
const listeners = new Set<() => void>();

function sortPosts(posts: BlogPost[]) {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt);
}

function readFromStorage(): BlogPost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getCache(): BlogPost[] {
  if (cache === null) cache = sortPosts(readFromStorage());
  return cache;
}

function setCache(posts: BlogPost[]) {
  cache = sortPosts(posts);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      for (const listener of listeners) listener();
    }
  });
}

export function subscribePosts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPostsSnapshot(): BlogPost[] {
  return getCache();
}

const EMPTY: BlogPost[] = [];
export function getServerPostsSnapshot(): BlogPost[] {
  return EMPTY;
}

export function savePost(input: { id?: string; title: string; body: string }): BlogPost {
  const posts = getCache().slice();
  const now = Date.now();
  const title = input.title.trim() || "Untitled";
  const body = input.body;

  if (input.id) {
    const idx = posts.findIndex((p) => p.id === input.id);
    if (idx !== -1) {
      const updated = { ...posts[idx], title, body, updatedAt: now };
      posts[idx] = updated;
      setCache(posts);
      return updated;
    }
  }

  const post: BlogPost = {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    createdAt: now,
    updatedAt: now,
  };
  posts.push(post);
  setCache(posts);
  return post;
}

export function deletePost(id: string) {
  setCache(getCache().filter((p) => p.id !== id));
}

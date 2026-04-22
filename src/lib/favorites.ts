// Favorites store for /vaults and /markets list rows.
// Stored as a JSON array of string keys in localStorage — no extension
// permission needed because content scripts run on the page origin.
// Key format: `${kind}:${chainSlug}:${idLowercase}`.

export type FavoriteKind = 'market' | 'vault';
export type FavoriteKey = string;

const STORAGE_KEY = 'morpho-ext:favorites';

export function favoriteKey(
  kind: FavoriteKind,
  chainSlug: string,
  id: string,
): FavoriteKey {
  return `${kind}:${chainSlug}:${id.toLowerCase()}`;
}

// Parses a list-row href like `/base/market/0xabc.../slug` or
// `/ethereum/vault/0xabc.../slug` into a normalized favorite key.
export function parseHrefToKey(href: string): FavoriteKey | null {
  const m = href.match(/^\/([^/]+)\/(market|vault)\/(0x[a-fA-F0-9]+)(?:\/|$)/);
  if (!m) return null;
  return favoriteKey(m[2] as FavoriteKind, m[1], m[3]);
}

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Quota or private mode — silently ignore; favorites just won't persist.
  }
}

const listeners = new Set<() => void>();

export function onFavoritesChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const cb of listeners) cb();
}

export function isFavorite(key: FavoriteKey): boolean {
  return read().has(key);
}

export function getFavoritesCount(kind?: FavoriteKind): number {
  const set = read();
  if (!kind) return set.size;
  const prefix = `${kind}:`;
  let n = 0;
  for (const k of set) if (k.startsWith(prefix)) n += 1;
  return n;
}

// Returns the new state (true == now favorite).
export function toggleFavorite(key: FavoriteKey): boolean {
  const set = read();
  const wasOn = set.has(key);
  if (wasOn) set.delete(key);
  else set.add(key);
  write(set);
  notify();
  return !wasOn;
}

// Cross-tab sync: another tab on app.morpho.org wrote to localStorage.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) notify();
  });
}

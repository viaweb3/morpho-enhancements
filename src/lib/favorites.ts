// Favorites store for /vaults and /variable list rows.
//
// Storage: chrome.storage.local — shared across the content script
// (running on app.morpho.org) and the popup (running on the extension
// origin), unlike window.localStorage which is per-origin.
//
// API stays synchronous via an in-memory cache hydrated from
// chrome.storage on first load. Callers that must wait for the first
// load (e.g. before the initial DOM scan) can `await ready`.
//
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

export interface ParsedFavoriteKey {
  kind: FavoriteKind;
  chainSlug: string;
  id: string;
}

export function parseFavoriteKey(key: FavoriteKey): ParsedFavoriteKey | null {
  const m = key.match(/^(market|vault):([^:]+):(0x[a-fA-F0-9]+)$/);
  if (!m) return null;
  const expectedLength = m[1] === 'market' ? 66 : 42;
  if (m[3].length !== expectedLength) return null;
  return { kind: m[1] as FavoriteKind, chainSlug: m[2], id: m[3] };
}

// Parses a list-row href like `/base/variable/0xabc.../slug` or
// `/ethereum/vault/0xabc.../slug` into a normalized favorite key.
export function parseHrefToKey(href: string): FavoriteKey | null {
  const m = href.match(/^\/([^/]+)\/(variable|vault)\/(0x[a-fA-F0-9]+)(?:\/|$)/);
  if (!m) return null;
  const key = favoriteKey(m[2] === 'vault' ? 'vault' : 'market', m[1], m[3]);
  return parseFavoriteKey(key) ? key : null;
}

let cache: ReadonlySet<string> = new Set();

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
  return cache.has(key);
}

export function getFavoritesCount(kind?: FavoriteKind): number {
  if (!kind) return cache.size;
  const prefix = `${kind}:`;
  let n = 0;
  for (const k of cache) if (k.startsWith(prefix)) n += 1;
  return n;
}

export function getAllFavoriteKeys(kind?: FavoriteKind): FavoriteKey[] {
  if (!kind) return [...cache];
  const prefix = `${kind}:`;
  return [...cache].filter((k) => k.startsWith(prefix));
}

// Returns the new state (true == now favorite). Updates the in-memory
// cache synchronously and persists to chrome.storage in the background
// so the call site stays sync.
export function toggleFavorite(key: FavoriteKey): boolean {
  const wasOn = cache.has(key);
  const next = new Set(cache);
  if (wasOn) next.delete(key);
  else next.add(key);
  cache = next;
  notify();
  void persist(next);
  return !wasOn;
}

async function persist(set: ReadonlySet<string>): Promise<void> {
  if (!hasChromeStorage()) return;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: [...set] });
  } catch {
    // Quota or extension context invalidated — favorites just won't
    // persist this session.
  }
}

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

async function loadFromStorage(): Promise<Set<string>> {
  if (!hasChromeStorage()) return new Set();
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    return new Set(Array.isArray(raw) ? (raw as string[]) : []);
  } catch {
    return new Set();
  }
}

// One-time migration from legacy window.localStorage. Only meaningful
// in the content-script context (popup origin's localStorage is its
// own, separate from app.morpho.org's). After migrating, the legacy
// key is removed so the two stores can never drift.
async function migrateLegacyLocalStorage(): Promise<Set<string> | null> {
  if (typeof window === 'undefined') return null;
  if (!hasChromeStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const set = new Set<string>(arr as string[]);
    await chrome.storage.local.set({ [STORAGE_KEY]: [...set] });
    window.localStorage.removeItem(STORAGE_KEY);
    return set;
  } catch {
    return null;
  }
}

async function init(): Promise<void> {
  const stored = await loadFromStorage();
  if (stored.size === 0) {
    const migrated = await migrateLegacyLocalStorage();
    if (migrated) {
      cache = migrated;
      notify();
      return;
    }
  }
  cache = stored;
  notify();
}

export const ready: Promise<void> = init();

if (hasChromeStorage() && typeof chrome.storage.onChanged !== 'undefined') {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    const next = new Set<string>(
      Array.isArray(change.newValue) ? (change.newValue as string[]) : [],
    );
    cache = next;
    notify();
  });
}

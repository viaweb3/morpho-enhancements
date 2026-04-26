// Favorites injection for /markets and /vaults list pages.
//
// Strategy:
//   - Each row's first anchor href encodes {chain, kind, id}. Extract a
//     normalized key and stamp it on the <tr> so we can style it.
//   - Absolute-position a star button over the first <td>. Clicking
//     toggles favorite state; stopPropagation prevents the underlying
//     anchor from navigating.
//   - A single <style> rule hides non-favorite rows when the filter is on.
//   - The filter toggle is a floating chip at bottom-right; the state
//     lives on <html data-morpho-ext-fav-only="true|false"> so React
//     re-renders don't clobber it.

import {
  getFavoritesCount,
  isFavorite,
  onFavoritesChange,
  parseHrefToKey,
  ready as favoritesReady,
  toggleFavorite,
} from '@/lib/favorites';

type ListKind = 'markets' | 'vaults';

const STAR_ATTR = 'data-morpho-ext-fav-injected';
const ROW_KEY_ATTR = 'data-morpho-ext-fav-key';
const ROW_STATE_ATTR = 'data-morpho-ext-fav';
const FILTER_ATTR = 'data-morpho-ext-fav-only';
const TOGGLE_ID = 'morpho-ext-fav-toggle';
const STYLE_ID = 'morpho-ext-fav-style';

function ensureStyleInjected(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html[${FILTER_ATTR}="true"] tr[${ROW_STATE_ATTR}="off"] { display: none !important; }
    .morpho-ext-fav-btn {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.35;
      transition: opacity 0.15s ease, color 0.15s ease, transform 0.1s ease;
      pointer-events: auto;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .morpho-ext-fav-btn > svg { pointer-events: none; }
    tr.group:hover .morpho-ext-fav-btn { opacity: 1; }
    .morpho-ext-fav-btn[data-on="true"] { opacity: 1; color: #f5b63d; }
    .morpho-ext-fav-btn:hover { transform: translateY(-50%) scale(1.2); }
    .morpho-ext-fav-btn:focus-visible {
      outline: 2px solid #f5b63d;
      outline-offset: 2px;
      opacity: 1;
    }
    .morpho-ext-fav-chip {
      position: fixed;
      left: 20px;
      bottom: 20px;
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 9999px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: #ffffff;
      color: #111827;
      font: 500 13px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06);
      user-select: none;
      transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
    }
    .morpho-ext-fav-chip:hover { transform: translateY(-1px); }
    .morpho-ext-fav-chip[data-on="true"] {
      background: #f5b63d;
      color: #111827;
      border-color: #f5b63d;
    }
    .morpho-ext-fav-chip-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.08);
      color: inherit;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
    }
    .morpho-ext-fav-chip[data-on="true"] .morpho-ext-fav-chip-count {
      background: rgba(0, 0, 0, 0.18);
    }
    @media (prefers-color-scheme: dark) {
      .morpho-ext-fav-chip {
        background: #1f2937;
        color: #f9fafb;
        border-color: rgba(255, 255, 255, 0.12);
      }
      .morpho-ext-fav-chip[data-on="true"] {
        background: #f5b63d;
        color: #111827;
        border-color: #f5b63d;
      }
      .morpho-ext-fav-chip-count { background: rgba(255, 255, 255, 0.14); }
      .morpho-ext-fav-btn { color: #6b7280; }
    }
  `;
  document.head.appendChild(style);
}

function starSvg(on: boolean): string {
  const fill = on ? 'currentColor' : 'none';
  return `<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

function updateStarBtn(btn: HTMLButtonElement, on: boolean): void {
  btn.dataset.on = on ? 'true' : 'false';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = on ? 'Remove from favorites' : 'Add to favorites';
  btn.innerHTML = starSvg(on);
}

function injectRowStar(row: HTMLTableRowElement): void {
  if (row.hasAttribute(STAR_ATTR)) {
    // Row was already instrumented — just refresh on/off state in case
    // favorites changed externally.
    const key = row.getAttribute(ROW_KEY_ATTR);
    if (!key) return;
    const on = isFavorite(key);
    row.setAttribute(ROW_STATE_ATTR, on ? 'on' : 'off');
    const existingBtn = row.querySelector<HTMLButtonElement>('.morpho-ext-fav-btn');
    if (existingBtn) updateStarBtn(existingBtn, on);
    return;
  }

  const a = row.querySelector<HTMLAnchorElement>('a[href]');
  const href = a?.getAttribute('href') ?? '';
  const key = parseHrefToKey(href);
  if (!key) return;

  const firstTd = row.querySelector<HTMLTableCellElement>('td');
  if (!firstTd) return;

  // The td normally contains an <a> with a div laid out with pl-m (~16px).
  // Making it relative so the absolute-positioned star anchors correctly.
  // `isolate` forces a new stacking context so our z-index wins over any
  // positioned descendant Morpho adds inside the cell.
  firstTd.style.position = 'relative';
  firstTd.style.isolation = 'isolate';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'morpho-ext-fav-btn';
  updateStarBtn(btn, isFavorite(key));
  firstTd.appendChild(btn);

  row.setAttribute(STAR_ATTR, '1');
  row.setAttribute(ROW_KEY_ATTR, key);
  row.setAttribute(ROW_STATE_ATTR, isFavorite(key) ? 'on' : 'off');
}

// Document-level capture-phase delegation. Morpho/Next.js attaches click
// listeners to the row's <a> in bubble phase; by intercepting in capture
// phase on document we beat them to the punch regardless of how React
// re-renders the row.
const GLOBAL_HANDLER_FLAG = '__morphoFavHandlerInstalled';
function ensureGlobalClickHandler(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[GLOBAL_HANDLER_FLAG]) return;
  w[GLOBAL_HANDLER_FLAG] = true;

  const swallow = (ev: Event) => {
    const target = ev.target as Element | null;
    if (!target || !target.closest) return;
    if (target.closest('.morpho-ext-fav-btn, .morpho-ext-fav-chip')) {
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }
  };
  // Stop pointerdown/mousedown from reaching Morpho handlers that might
  // trigger drag-to-sort or focus-based navigation.
  document.addEventListener('pointerdown', swallow, { capture: true });
  document.addEventListener('mousedown', swallow, { capture: true });

  document.addEventListener(
    'click',
    (ev) => {
      const target = ev.target as Element | null;
      if (!target || !target.closest) return;
      const starBtn = target.closest<HTMLButtonElement>('.morpho-ext-fav-btn');
      if (starBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        const row = starBtn.closest<HTMLTableRowElement>('tr');
        const key = row?.getAttribute(ROW_KEY_ATTR);
        if (!row || !key) return;
        const nowOn = toggleFavorite(key);
        updateStarBtn(starBtn, nowOn);
        row.setAttribute(ROW_STATE_ATTR, nowOn ? 'on' : 'off');
        return;
      }
      const chip = target.closest<HTMLButtonElement>('.morpho-ext-fav-chip');
      if (chip) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        const current = document.documentElement.getAttribute(FILTER_ATTR) === 'true';
        const next = !current;
        document.documentElement.setAttribute(FILTER_ATTR, next ? 'true' : 'false');
        chip.dataset.on = next ? 'true' : 'false';
        const kind: ListKind = location.pathname.startsWith('/vaults') ? 'vaults' : 'markets';
        updateChipContent(chip, kind, next);
      }
    },
    { capture: true },
  );
}

function refreshAllRowStates(): void {
  document
    .querySelectorAll<HTMLTableRowElement>(`tr[${ROW_KEY_ATTR}]`)
    .forEach((row) => {
      const key = row.getAttribute(ROW_KEY_ATTR);
      if (!key) return;
      const on = isFavorite(key);
      row.setAttribute(ROW_STATE_ATTR, on ? 'on' : 'off');
      const btn = row.querySelector<HTMLButtonElement>('.morpho-ext-fav-btn');
      if (btn) updateStarBtn(btn, on);
    });
}

function scanRows(): number {
  const rows = document.querySelectorAll<HTMLTableRowElement>('tbody tr');
  let added = 0;
  rows.forEach((row) => {
    const before = row.hasAttribute(STAR_ATTR);
    injectRowStar(row);
    if (!before && row.hasAttribute(STAR_ATTR)) added += 1;
  });
  return added;
}

function updateChipContent(chip: HTMLButtonElement, kind: ListKind, on: boolean): void {
  const count = getFavoritesCount(kind === 'markets' ? 'market' : 'vault');
  const label = on ? 'Favorites only' : 'Favorites';
  const countBadge = count > 0 ? `<span class="morpho-ext-fav-chip-count">${count}</span>` : '';
  chip.setAttribute(
    'aria-label',
    on
      ? `Showing favorites only (${count}). Click to show all.`
      : `Show favorites only${count > 0 ? ` (${count} saved)` : ''}.`,
  );
  chip.innerHTML = `
    <span aria-hidden="true" style="display:inline-flex;align-items:center;">${starSvg(on)}</span>
    <span>${label}</span>
    ${countBadge}
  `;
}

function ensureFilterChip(kind: ListKind): void {
  let chip = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
  if (!chip) {
    chip = document.createElement('button');
    chip.id = TOGGLE_ID;
    chip.type = 'button';
    chip.className = 'morpho-ext-fav-chip';
    document.body.appendChild(chip);
  }
  const on = document.documentElement.getAttribute(FILTER_ATTR) === 'true';
  chip.dataset.on = on ? 'true' : 'false';
  updateChipContent(chip, kind, on);
}

let listObserver: MutationObserver | null = null;
let listUnsub: (() => void) | null = null;
let tickScheduled = false;

function scheduleScan(): void {
  if (tickScheduled) return;
  tickScheduled = true;
  const run = () => {
    tickScheduled = false;
    scanRows();
  };
  if ('requestIdleCallback' in window) {
    (window as unknown as {
      requestIdleCallback: (cb: () => void, o: { timeout: number }) => number;
    }).requestIdleCallback(run, { timeout: 500 });
  } else {
    setTimeout(run, 250);
  }
}

export function setupListIntegration(kind: ListKind): void {
  ensureStyleInjected();
  ensureGlobalClickHandler();
  ensureFilterChip(kind);
  scanRows();
  // chrome.storage hydration is async; if rows scanned before favorites
  // loaded, refresh on/off state once the cache catches up.
  void favoritesReady.then(() => {
    refreshAllRowStates();
    const chip = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
    if (chip) {
      const on = document.documentElement.getAttribute(FILTER_ATTR) === 'true';
      updateChipContent(chip, kind, on);
    }
  });

  listUnsub?.();
  listUnsub = onFavoritesChange(() => {
    refreshAllRowStates();
    const chip = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
    if (chip) {
      const on = document.documentElement.getAttribute(FILTER_ATTR) === 'true';
      updateChipContent(chip, kind, on);
    }
  });

  listObserver?.disconnect();
  listObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== 'childList') continue;
      if (m.addedNodes.length === 0) continue;
      const t = m.target as Element | null;
      if (!t || !t.closest) continue;
      if (t.closest('[data-morpho-ext-mount]')) continue;
      // Heuristic: only rescan when the mutation looks table-adjacent.
      if (
        t.closest('tbody') ||
        t.tagName === 'TABLE' ||
        Array.from(m.addedNodes).some(
          (n) =>
            (n as Element).tagName === 'TR' ||
            (n as Element).querySelector?.('tbody tr'),
        )
      ) {
        scheduleScan();
        return;
      }
    }
  });
  listObserver.observe(document.body, { childList: true, subtree: true });
}

export function teardownListIntegration(): void {
  listObserver?.disconnect();
  listObserver = null;
  listUnsub?.();
  listUnsub = null;
  document.getElementById(TOGGLE_ID)?.remove();
  // Don't leave the page filtering rows after navigation away.
  document.documentElement.removeAttribute(FILTER_ATTR);
}

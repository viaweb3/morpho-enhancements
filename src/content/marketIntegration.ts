// Market page integration: adds a "Lend" tab alongside the existing "Borrow"
// tab inside [data-testid="market-action-panel"], using Morpho's own utility
// classes (no Shadow DOM) so the injected form inherits all design tokens.
//
// State model:
//   panel.dataset.morphoExtTab = 'borrow' | 'lend'
// CSS rules below hide the correct children based on that attribute.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { MarketLendForm } from '@/ui/MarketLendForm';
import type { SupportedChainSlug } from '@/lib/chains';
import type { Hex } from 'viem';

const TAB_ATTR = 'data-morpho-ext-tab';
const LEND_HOST_CLASS = 'mx-lend-host';
const TABSTRIP_CLASS = 'mx-tabstrip';
const STYLE_ID = 'morpho-ext-market-style';

type Controller = {
  dispose: () => void;
  chainSlug: SupportedChainSlug;
  marketId: Hex;
};

let active: { panel: HTMLElement; controller: Controller } | null = null;

function detectDarkMode(): boolean {
  const html = document.documentElement;
  if (html.classList.contains('dark')) return true;
  if (html.getAttribute('data-theme') === 'dark') return true;
  if (html.classList.contains('light')) return false;
  if (html.getAttribute('data-theme') === 'light') return false;
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
    if (!m) continue;
    const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (alpha < 0.05) continue;
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyPanelTheme(panel: HTMLElement) {
  panel.setAttribute('data-morpho-ext-theme', detectDarkMode() ? 'dark' : 'light');
}

function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Scoped only to the market-action-panel. `display: none !important` on the
  // original form children when Lend tab is active; the Lend host is hidden
  // when Borrow tab is active.
  // We define our own --mx-* custom properties on the panel scope so both
  // light and dark themes render correctly. The theme is detected and set
  // as `data-morpho-ext-theme` on the panel (see applyTheme below).
  style.textContent = `
    [data-testid="market-action-panel"] {
      --mx-fg: rgba(25, 29, 32, 0.95);
      --mx-fg-muted: rgba(25, 29, 32, 0.6);
      --mx-fg-disabled: rgba(25, 29, 32, 0.45);
      --mx-surface: rgba(25, 29, 32, 0.04);
      --mx-surface-hover: rgba(25, 29, 32, 0.08);
      --mx-tab-active-bg: rgba(25, 29, 32, 0.08);
      --mx-tab-hover-bg: rgba(25, 29, 32, 0.05);
      --mx-disabled-bg: rgba(25, 29, 32, 0.08);
    }
    [data-testid="market-action-panel"][data-morpho-ext-theme="dark"] {
      --mx-fg: rgba(255, 255, 255, 0.95);
      --mx-fg-muted: rgba(255, 255, 255, 0.6);
      --mx-fg-disabled: rgba(255, 255, 255, 0.4);
      --mx-surface: rgba(255, 255, 255, 0.06);
      --mx-surface-hover: rgba(255, 255, 255, 0.1);
      --mx-tab-active-bg: rgba(255, 255, 255, 0.12);
      --mx-tab-hover-bg: rgba(255, 255, 255, 0.08);
      --mx-disabled-bg: rgba(255, 255, 255, 0.08);
    }
    [data-testid="market-action-panel"][${TAB_ATTR}="lend"] > :not(.${TABSTRIP_CLASS}):not(.${LEND_HOST_CLASS}) {
      display: none !important;
    }
    [data-testid="market-action-panel"][${TAB_ATTR}="borrow"] > .${LEND_HOST_CLASS} {
      display: none !important;
    }
    .${TABSTRIP_CLASS} {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .mx-tab {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--mx-fg);
      font-size: 14px;
      font-weight: 500;
      line-height: 1;
      height: 26px;
      padding: 0 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 120ms ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mx-tab:hover {
      background: var(--mx-tab-hover-bg);
    }
    .mx-tab[aria-selected="true"] {
      background: var(--mx-tab-active-bg);
    }
    .${LEND_HOST_CLASS} {
      display: contents;
    }
  `;
  document.head.appendChild(style);
}

function buildTabStrip(
  onSelect: (tab: 'borrow' | 'lend') => void,
  originalTabStrip: HTMLElement,
): HTMLElement {
  const strip = document.createElement('div');
  strip.className = `${TABSTRIP_CLASS} stack`;
  // Try to preserve the spacing Morpho used (copy outer layout classes minus visuals)
  // e.g. 'stack css-g5cbxe ep2wuxt0' — we don't need the emotion class for visuals
  // because we provide our own styling via .mx-tabstrip + .mx-tab.
  originalTabStrip
    .getAttribute('class')
    ?.split(/\s+/)
    .filter((c) => c === 'stack')
    .forEach((c) => strip.classList.add(c));

  const borrow = document.createElement('button');
  borrow.type = 'button';
  borrow.className = 'mx-tab';
  borrow.textContent = 'Borrow';
  borrow.setAttribute('aria-selected', 'true');
  borrow.onclick = () => onSelect('borrow');

  const lend = document.createElement('button');
  lend.type = 'button';
  lend.className = 'mx-tab';
  lend.textContent = 'Lend';
  lend.setAttribute('aria-selected', 'false');
  lend.onclick = () => onSelect('lend');

  strip.appendChild(borrow);
  strip.appendChild(lend);
  return strip;
}

function setTabState(panel: HTMLElement, tab: 'borrow' | 'lend') {
  panel.setAttribute(TAB_ATTR, tab);
  const strip = panel.querySelector(`.${TABSTRIP_CLASS}`);
  if (!strip) return;
  const [borrowBtn, lendBtn] = strip.querySelectorAll('.mx-tab');
  borrowBtn?.setAttribute('aria-selected', String(tab === 'borrow'));
  lendBtn?.setAttribute('aria-selected', String(tab === 'lend'));
}

export function setupMarketIntegration(
  panel: HTMLElement,
  chainSlug: SupportedChainSlug,
  marketId: Hex,
): Controller | null {
  // Already integrated? If the panel matches but market id differs, tear down first.
  if (active && active.panel === panel) {
    if (active.controller.marketId === marketId && active.controller.chainSlug === chainSlug) {
      return active.controller;
    }
    active.controller.dispose();
    active = null;
  }

  ensureStylesheet();

  // Original tab strip is the first child of the panel
  const originalTabStrip = panel.firstElementChild as HTMLElement | null;
  if (!originalTabStrip) return null;

  // Hide the original tab strip (only has one button) and insert ours
  originalTabStrip.style.display = 'none';

  const handleSelect = (tab: 'borrow' | 'lend') => setTabState(panel, tab);
  const newStrip = buildTabStrip(handleSelect, originalTabStrip);
  panel.insertBefore(newStrip, originalTabStrip);

  // Lend host — inserted as LAST child so it sits where the form would be
  const lendHost = document.createElement('div');
  lendHost.className = LEND_HOST_CLASS;
  lendHost.setAttribute('data-morpho-ext-lend-host', '');
  panel.appendChild(lendHost);

  // Mount React Lend form inside lendHost
  const root: Root = createRoot(lendHost);
  root.render(createElement(MarketLendForm, { chainSlug, marketId }));

  // Initialize with Borrow active + detected theme
  setTabState(panel, 'borrow');
  applyPanelTheme(panel);

  // Re-apply theme when Morpho toggles next-themes
  const themeObserver = new MutationObserver(() => applyPanelTheme(panel));
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onMql = () => applyPanelTheme(panel);
  mql?.addEventListener?.('change', onMql);

  const controller: Controller = {
    chainSlug,
    marketId,
    dispose: () => {
      themeObserver.disconnect();
      mql?.removeEventListener?.('change', onMql);
      try {
        root.unmount();
      } catch {
        /* ignore */
      }
      lendHost.remove();
      newStrip.remove();
      originalTabStrip.style.display = '';
      panel.removeAttribute(TAB_ATTR);
      panel.removeAttribute('data-morpho-ext-theme');
      if (active?.controller === controller) active = null;
    },
  };

  active = { panel, controller };
  return controller;
}

export function teardownMarketIntegration() {
  active?.controller.dispose();
  active = null;
}

export function isMarketIntegrationAttached(panel: HTMLElement): boolean {
  return active?.panel === panel && !!panel.querySelector(`.${TABSTRIP_CLASS}`);
}

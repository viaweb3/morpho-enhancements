import { createElement } from 'react';
import { watchRoute } from './router';
import { mountReact, type MountHandle } from './mount';
import {
  setupMarketIntegration,
  teardownMarketIntegration,
  isMarketIntegrationAttached,
} from './marketIntegration';
import {
  setupListIntegration,
  teardownListIntegration,
} from './listsIntegration';
import { DashboardSupplyCard } from '@/ui/DashboardSupplyCard';
import { SUPPORTED_SLUGS, chainIdFromSlug } from '@/lib/chains';
import type { RouteMatch } from '@/lib/url';

const DASHBOARD_MOUNT_ID = 'morpho-ext-dashboard-supply';

type DashboardAnchor = {
  parent: Element;
  position: 'afterbegin' | 'beforeend';
};

let dashboardMount: MountHandle | null = null;

function findMarketAnchor(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="market-action-panel"]');
}

function findDashboardAnchor(): DashboardAnchor | null {
  // The dashboard column contains [tabs, vaults-markets-stack]. We want our
  // Market Lending section to appear BEFORE Vaults and Markets, so we mount
  // at the start of the vaults-markets stack (the column's last child).
  const tab = document.querySelector('[data-testid="tab-positions"]');
  if (tab) {
    let cur: Element | null = tab;
    while (cur) {
      const cs = window.getComputedStyle(cur as HTMLElement);
      if (
        cs.display === 'flex' &&
        cs.flexDirection === 'column' &&
        (cur as HTMLElement).offsetWidth > 600
      ) {
        // Inside the outer flex-col column the LAST child is the container
        // holding [Vaults, separator, Markets]. Prepend to it so we render
        // above both native sections.
        const vaultsStack = cur.lastElementChild;
        if (
          vaultsStack &&
          vaultsStack !== cur.firstElementChild &&
          (vaultsStack as HTMLElement).offsetHeight > 0
        ) {
          return { parent: vaultsStack, position: 'afterbegin' };
        }
        return { parent: cur, position: 'beforeend' };
      }
      cur = cur.parentElement;
    }
  }
  const main = document.querySelector('main');
  if (!main) return null;
  return { parent: main.lastElementChild ?? main, position: 'beforeend' };
}

function reconcileMarket(route: Extract<RouteMatch, { kind: 'market' }>): boolean {
  const panel = findMarketAnchor();
  if (!panel) return false;
  if (isMarketIntegrationAttached(panel)) return true;
  const ctrl = setupMarketIntegration(panel, route.chainSlug, route.marketId);
  return !!ctrl;
}

function reconcileDashboard(route: Extract<RouteMatch, { kind: 'dashboard' }>): boolean {
  const anchor = findDashboardAnchor();
  if (!anchor) return false;
  if (dashboardMount?.isStillAttached()) return true;
  dashboardMount?.unmount();
  // The dashboard URL has no chain segment, and users can hold positions on
  // any Morpho-supported chain. Ask the indexer for every chain in one shot.
  const chainIds = SUPPORTED_SLUGS.map((s) => chainIdFromSlug(s));
  dashboardMount = mountReact({
    id: DASHBOARD_MOUNT_ID,
    anchor: anchor.parent,
    position: anchor.position,
    component: () =>
      createElement(DashboardSupplyCard, { address: route.address, chainIds }),
  });
  return true;
}

function unmountAll() {
  teardownMarketIntegration();
  teardownListIntegration();
  dashboardMount?.unmount();
  dashboardMount = null;
}

function retryUntil(attempt: () => boolean, maxTries: number, delayMs: number) {
  let tries = 0;
  const tick = () => {
    if (attempt()) return;
    if (++tries < maxTries) setTimeout(tick, delayMs);
  };
  tick();
}

watchRoute((route) => {
  if (route.kind === 'market') {
    teardownListIntegration();
    dashboardMount?.unmount();
    dashboardMount = null;
    retryUntil(() => reconcileMarket(route), 12, 400);
  } else if (route.kind === 'dashboard') {
    teardownMarketIntegration();
    teardownListIntegration();
    retryUntil(() => reconcileDashboard(route), 12, 400);
  } else if (route.kind === 'markets-list' || route.kind === 'vaults-list') {
    teardownMarketIntegration();
    dashboardMount?.unmount();
    dashboardMount = null;
    setupListIntegration(route.kind === 'markets-list' ? 'markets' : 'vaults');
  } else {
    unmountAll();
  }
});

// Morpho rehydrates the panel / dashboard on SPA navigation. We use a
// MutationObserver to catch these cases, but the page has a lot of DOM
// churn (number-flow animations, chart updates, etc.) so we MUST throttle
// the callback — otherwise we wake up thousands of times per minute and
// the page feels sluggish.
//
// Strategy: once our mount is confirmed attached, we skip the full check.
// We also coalesce mutations via a microtask and bail early if nothing
// relevant changed.
let tickScheduled = false;
function scheduleReconcileCheck() {
  if (tickScheduled) return;
  tickScheduled = true;
  // rAF + idle callback gives the browser a chance to batch; avoid blocking.
  const run = () => {
    tickScheduled = false;
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[1] === 'market') {
      const panel = findMarketAnchor();
      if (panel && !isMarketIntegrationAttached(panel)) {
        window.dispatchEvent(new Event('locationchange'));
      }
    } else if (parts[0] === 'dashboard') {
      if (!dashboardMount?.isStillAttached()) {
        window.dispatchEvent(new Event('locationchange'));
      }
    }
  };
  if ('requestIdleCallback' in window) {
    (window as unknown as {
      requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number;
    }).requestIdleCallback(run, { timeout: 500 });
  } else {
    setTimeout(run, 250);
  }
}

const observer = new MutationObserver((mutations) => {
  // Fast path: only schedule if a relevant node was added/removed. Style or
  // character-data mutations from animations are ignored.
  for (const m of mutations) {
    if (m.type !== 'childList') continue;
    if (m.addedNodes.length === 0 && m.removedNodes.length === 0) continue;
    // Ignore mutations INSIDE our own shadow DOM mount
    const t = m.target as Element;
    if (t && t.closest && t.closest('[data-morpho-ext-mount]')) continue;
    scheduleReconcileCheck();
    return;
  }
});
observer.observe(document.body, { childList: true, subtree: true });

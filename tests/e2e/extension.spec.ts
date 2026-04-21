import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = join(__dirname, '..', '..', 'dist');

const MARKET_URL =
  'https://app.morpho.org/ethereum/market/0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99/wbtc-usdt';
const DASHBOARD_URL =
  'https://app.morpho.org/dashboard/0x11111111652DeB43CF2ee68065E8296249428B61';

let ctx: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'morpho-ext-'));
  ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
});

test.afterAll(async () => {
  await ctx?.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

// Capture console errors/warnings from the page for diagnostics.
function captureConsole(page: Page): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return { errors, warnings };
}

async function readAppRootText(page: Page, mountId: string): Promise<string> {
  return page.evaluate((id) => {
    const host = document.querySelector<HTMLElement>(`[data-morpho-ext-mount="${id}"]`);
    if (!host) return '__NO_HOST__';
    const shadow = host.shadowRoot;
    if (!shadow) return '__NO_SHADOW__';
    const appRoot = shadow.querySelector<HTMLElement>('.mx-root');
    if (!appRoot) return '__NO_APP_ROOT__';
    return appRoot.textContent?.trim() ?? '';
  }, mountId);
}

test('lend tab appears next to borrow tab, switching reveals supply form', async () => {
  const page = await ctx.newPage();
  const cons = captureConsole(page);
  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });

  // Our tab strip replaces the original. Wait for "Lend" tab to appear.
  const lendTab = page
    .locator('[data-testid="market-action-panel"] .mx-tab', { hasText: 'Lend' });
  await expect(lendTab).toBeVisible({ timeout: 15_000 });

  const borrowTab = page
    .locator('[data-testid="market-action-panel"] .mx-tab', { hasText: 'Borrow' });
  await expect(borrowTab).toBeVisible({ timeout: 5_000 });

  // Initially Borrow is active → the original Supply Collateral input is visible
  await expect(
    page.locator('[data-testid="market-action-panel"] [data-testid="asset-input"]').first(),
  ).toBeVisible();

  // Screenshot with Borrow active (default)
  await page
    .locator('[data-testid="market-action-panel"]')
    .screenshot({ path: join(__dirname, 'market-borrow-tab.png') });

  // Click Lend → original form should hide, supply card should render
  await lendTab.click();
  await expect(lendTab).toHaveAttribute('aria-selected', 'true');
  await expect(borrowTab).toHaveAttribute('aria-selected', 'false');

  // Original collateral form is hidden (display:none via CSS)
  await expect(
    page.locator('[data-testid="market-action-panel"] [data-testid="asset-input"]').first(),
  ).toBeHidden({ timeout: 5_000 });

  // Our lend host renders with a "Supply <token>" label — wait for ERC20 metadata
  // RPC call to resolve and the loan symbol to appear.
  const lendHost = page.locator('[data-testid="market-action-panel"] .mx-lend-host');
  await expect(lendHost).toBeVisible();
  await expect(lendHost).toContainText(/Supply\s+USDT/i, { timeout: 15_000 });
  // Wait for at least one row of market details to populate (Supply APY not '—')
  await expect(lendHost).toContainText(/Supply APY/i);

  // Give the market data a few seconds to populate from the GraphQL API
  await page.waitForTimeout(3000);

  // Screenshot with Lend active
  await page
    .locator('[data-testid="market-action-panel"]')
    .screenshot({ path: join(__dirname, 'market-lend-tab.png') });

  // Click Borrow → switches back
  await borrowTab.click();
  await expect(borrowTab).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.locator('[data-testid="market-action-panel"] [data-testid="asset-input"]').first(),
  ).toBeVisible();

  if (cons.errors.length) {
    console.log('[page errors]', cons.errors.slice(0, 5));
  }
});

test('dashboard supply card mounts', async () => {
  const page = await ctx.newPage();
  const cons = captureConsole(page);
  // The dashboard page fetches a lot on load; wait for DOM instead of the
  // 'load' event which may never settle.
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('main', { timeout: 45_000 });

  const host = page.locator('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]');
  await expect(host).toBeAttached({ timeout: 15_000 });

  await expect
    .poll(async () => readAppRootText(page, 'morpho-ext-dashboard-supply'), {
      timeout: 20_000,
      intervals: [500, 1000, 2000],
    })
    .toMatch(/Market Lending/i);

  const text = await readAppRootText(page, 'morpho-ext-dashboard-supply');
  expect(text).toMatch(/Market Lending/i);

  // Verify Market Lending is positioned BEFORE the native Vaults section.
  // Both should share the same vaults-markets stack as siblings.
  const ordering = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      '[data-morpho-ext-mount="morpho-ext-dashboard-supply"]',
    );
    if (!host) return { mountIdx: -1, vaultsIdx: -1, parentHasBoth: false };
    const parent = host.parentElement!;
    const children = Array.from(parent.children);
    const mountIdx = children.indexOf(host);
    // Find the Vaults heading inside one of the sibling children
    let vaultsIdx = -1;
    for (let i = 0; i < children.length; i++) {
      const spans = children[i].querySelectorAll('span');
      for (const s of Array.from(spans)) {
        if ((s as HTMLElement).innerText?.trim() === 'Vaults') {
          vaultsIdx = i;
          break;
        }
      }
      if (vaultsIdx >= 0) break;
    }
    return { mountIdx, vaultsIdx, parentHasBoth: mountIdx >= 0 && vaultsIdx >= 0 };
  });
  expect(ordering.parentHasBoth).toBe(true);
  expect(ordering.mountIdx).toBeLessThan(ordering.vaultsIdx);

  await page.screenshot({
    path: join(__dirname, 'dashboard-with-card.png'),
    fullPage: true,
  });

  if (cons.errors.length) console.log('[page errors]', cons.errors.slice(0, 5));
});

test('dark mode — market lend panel text is legible', async () => {
  const page = await ctx.newPage();
  // Force next-themes to dark before page load by mimicking its localStorage.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
    } catch {
      /* ignore */
    }
    // Also toggle html.dark proactively — next-themes reads it.
    const ensureDark = () => document.documentElement.classList.add('dark');
    if (document.documentElement) ensureDark();
    document.addEventListener('DOMContentLoaded', ensureDark);
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });

  const lendTab = page
    .locator('[data-testid="market-action-panel"] .mx-tab', { hasText: 'Lend' });
  await expect(lendTab).toBeVisible({ timeout: 15_000 });
  await lendTab.click();

  // Verify the panel carries our dark-theme attribute
  const themeAttr = await page
    .locator('[data-testid="market-action-panel"]')
    .getAttribute('data-morpho-ext-theme');
  expect(themeAttr).toBe('dark');

  // Verify the injected text is actually readable — check computed color luminance.
  const rowLuma = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="market-action-panel"] .mx-lend-host span');
    // Find a row label (small text)
    for (const el of Array.from(rows)) {
      const text = (el as HTMLElement).innerText?.trim() || '';
      if (text === 'Loan asset' || text === 'Supply APY') {
        const c = getComputedStyle(el as HTMLElement).color;
        const m = c.match(/\d+/g);
        if (!m) return -1;
        const [r, g, b] = m.map(Number);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      }
    }
    return -1;
  });

  // On a near-black dark bg, readable text should have luma > 0.4.
  expect(rowLuma).toBeGreaterThan(0.4);

  await page
    .locator('[data-testid="market-action-panel"]')
    .screenshot({ path: join(__dirname, 'market-lend-dark.png') });
});

test('provider bridge announces providers from page', async () => {
  const page = await ctx.newPage();

  // Inject a mock EIP-1193 provider. The mock must respond to
  // `eip6963:requestProvider` events the bridge fires at startup. Since
  // addInitScript runs before any page script, this listener is set up
  // before the bridge's world:MAIN content script runs.
  await page.addInitScript(() => {
    const mock = {
      isMock: true,
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_accounts') return ['0xfA16e2A1A52A0202E4D4906B0917d01c7a3CFDD6'];
        if (method === 'eth_requestAccounts') return ['0xfA16e2A1A52A0202E4D4906B0917d01c7a3CFDD6'];
        if (method === 'eth_chainId') return '0x1';
        return null;
      },
      on: () => {},
      removeListener: () => {},
    };
    const detail = {
      info: { uuid: 'mock-uuid', name: 'Mock Wallet', icon: '', rdns: 'dev.mock' },
      provider: mock,
    };
    // Announce proactively AND in response to requests.
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
    });
    // Legacy fallback
    (window as unknown as { ethereum?: unknown }).ethereum = mock;
    // Also announce on load in case the bridge registers its listener after us
    setTimeout(
      () =>
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail })),
      0,
    );
  });

  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });

  // Ask the bridge to (re-)announce. It posts back on window.
  const providers = await page.evaluate(() => {
    return new Promise<unknown>((resolve) => {
      const results: unknown[] = [];
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.source === 'morpho-ext/page' && ev.data.type === 'providers') {
          results.push(ev.data.providers);
        }
      };
      window.addEventListener('message', onMsg);
      window.postMessage(
        { source: 'morpho-ext/cs', id: 9999, method: 'morpho-ext/listProviders' },
        '*',
      );
      // Give the bridge a moment to respond (it's synchronous from the
      // handler's perspective but messages travel through the message loop).
      setTimeout(() => {
        window.removeEventListener('message', onMsg);
        resolve(results[results.length - 1] ?? null);
      }, 2000);
    });
  });

  expect(Array.isArray(providers)).toBeTruthy();
  const json = JSON.stringify(providers);
  expect(json).toMatch(/mock-uuid|legacy:window\.ethereum/);
});

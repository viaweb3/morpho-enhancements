// Captures README screenshots. Masks sensitive values by intercepting the
// Morpho blue-api GraphQL response and serving a demo payload — so React
// renders from mocked state and there's nothing real to scrub.

import { test, chromium, type BrowserContext, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = join(__dirname, '..', '..', 'dist');
const OUT_DIR = join(__dirname, '..', '..', 'docs', 'screenshots');

const MARKET_URL =
  'https://app.morpho.org/ethereum/market/0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99/wbtc-usdt';
// A deterministic demo address — the actual value doesn't matter because
// the API response is mocked. Using 0xdead…beef makes it obvious in any
// leftover UI chrome that this is a demo screenshot.
const DEMO_ADDRESS = '0xdEaDbeefdeadBEefdEAdbeefDeadbEefDeAdBeEf';
const DASHBOARD_URL = `https://app.morpho.org/dashboard/${DEMO_ADDRESS}`;

let ctx: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  userDataDir = mkdtempSync(join(tmpdir(), 'morpho-shots-'));
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

// Intercept blue-api GraphQL and overwrite UserMarketPositions with a
// hand-crafted demo payload. Everything else passes through.
async function mockPositions(page: Page) {
  await page.route('**/graphql', async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('UserMarketPositions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            marketPositions: {
              items: [
                {
                  supplyShares: '1000000000000000000000',
                  supplyAssets: '1234560000',
                  supplyAssetsUsd: 1234.56,
                  borrowShares: '0',
                  borrowAssets: '0',
                  borrowAssetsUsd: 0,
                  collateral: '0',
                  collateralUsd: 0,
                  market: {
                    uniqueKey:
                      '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
                    lltv: '860000000000000000',
                    loanAsset: {
                      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                      symbol: 'USDC',
                      decimals: 6,
                    },
                    collateralAsset: {
                      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
                      symbol: 'WBTC',
                      decimals: 8,
                    },
                    state: { supplyApy: 0.0506, borrowApy: 0.0712 },
                    morphoBlue: { chain: { id: 1 } },
                  },
                },
                {
                  supplyShares: '500000000000000000000',
                  supplyAssets: '789120000000000000',
                  supplyAssetsUsd: 2468.91,
                  borrowShares: '0',
                  borrowAssets: '0',
                  borrowAssetsUsd: 0,
                  collateral: '0',
                  collateralUsd: 0,
                  market: {
                    uniqueKey:
                      '0xcafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
                    lltv: '945000000000000000',
                    loanAsset: {
                      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                      symbol: 'WETH',
                      decimals: 18,
                    },
                    collateralAsset: {
                      address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
                      symbol: 'wstETH',
                      decimals: 18,
                    },
                    state: { supplyApy: 0.0287, borrowApy: 0.0362 },
                    morphoBlue: { chain: { id: 1 } },
                  },
                },
              ],
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });
}

test('shot: market lend panel (light)', async () => {
  const page = await ctx.newPage();
  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });
  const lendTab = page.locator('[data-testid="market-action-panel"] .mx-tab', { hasText: 'Lend' });
  await lendTab.waitFor({ timeout: 15_000 });
  await lendTab.click();
  await page.waitForTimeout(4000);
  await page
    .locator('[data-testid="market-action-panel"]')
    .screenshot({ path: join(OUT_DIR, 'market-lend-light.png') });
});

test('shot: market lend panel (dark)', async () => {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ }
    const dark = () => document.documentElement.classList.add('dark');
    if (document.documentElement) dark();
    document.addEventListener('DOMContentLoaded', dark);
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });
  const lendTab = page.locator('[data-testid="market-action-panel"] .mx-tab', { hasText: 'Lend' });
  await lendTab.waitFor({ timeout: 15_000 });
  await lendTab.click();
  await page.waitForTimeout(4000);
  await page
    .locator('[data-testid="market-action-panel"]')
    .screenshot({ path: join(OUT_DIR, 'market-lend-dark.png') });
});

test('shot: dashboard market lending card (light)', async () => {
  const page = await ctx.newPage();
  await mockPositions(page);
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]', {
    timeout: 20_000,
  });
  await page.waitForFunction(() => {
    const host = document.querySelector('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]');
    const sr = (host as HTMLElement | null)?.shadowRoot;
    return !!(sr && /1,234\.56|USDC/.test(sr.textContent ?? ''));
  }, null, { timeout: 20_000 });
  await page.waitForTimeout(1500);

  const card = page.locator('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]');
  await card.screenshot({ path: join(OUT_DIR, 'dashboard-card-light.png') });
});

// ------------------------------------------------------------
// Chrome Web Store listing images (1280x800 exact, required size).
// Separate context at the exact viewport so the screenshot is the right
// dimension without any post-processing. Still mocks positions so no real
// data leaks into a public store listing.
// ------------------------------------------------------------

test.describe('store images (1280x800)', () => {
  let storeCtx: BrowserContext;
  let storeDir: string;

  test.beforeAll(async () => {
    storeDir = mkdtempSync(join(tmpdir(), 'morpho-shots-store-'));
    storeCtx = await chromium.launchPersistentContext(storeDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
  });

  test.afterAll(async () => {
    await storeCtx?.close();
    if (storeDir) rmSync(storeDir, { recursive: true, force: true });
  });

  test('store: market page with Lend tab active', async () => {
    const page = await storeCtx.newPage();
    await page.goto(MARKET_URL);
    await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });
    const lendTab = page.locator('[data-testid="market-action-panel"] .mx-tab', {
      hasText: 'Lend',
    });
    await lendTab.waitFor({ timeout: 15_000 });
    await lendTab.click();
    // Let panel populate (RPC reads for ERC20 meta + allowance)
    await page.waitForTimeout(4000);
    // Hide Morpho's intercom bubble so it doesn't dominate the corner.
    await page.addStyleTag({
      content: '#intercom-container,.intercom-launcher,[class*="intercom"]{display:none !important;}',
    });
    await page.screenshot({
      path: join(OUT_DIR, 'store-market-1280x800.png'),
      // viewport-only, not fullPage — store wants exact dimensions
    });
  });

  test('store: dashboard with Market Lending card', async () => {
    const page = await storeCtx.newPage();
    await mockPositions(page);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]', {
      timeout: 20_000,
    });
    await page.waitForFunction(() => {
      const host = document.querySelector(
        '[data-morpho-ext-mount="morpho-ext-dashboard-supply"]',
      );
      const sr = (host as HTMLElement | null)?.shadowRoot;
      return !!(sr && /1,234\.56|USDC/.test(sr.textContent ?? ''));
    }, null, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    // Hide the empty Positions/Activity tab strip — it's a sticky element
    // that would otherwise overlap the Market Lending heading when we
    // scroll our card into view.
    await page.addStyleTag({
      content: '[data-testid="tab-positions"],[data-testid="tab-activity"]{display:none !important;} main [class*="css-1xe81xy"],main [class*="e6ja7zi"]{display:none !important;}',
    });
    // Bring the Market Lending heading near the top with some breathing room
    // below Morpho's fixed top navbar.
    await page.evaluate(() => {
      const host = document.querySelector(
        '[data-morpho-ext-mount="morpho-ext-dashboard-supply"]',
      );
      (host as HTMLElement | null)?.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -90);
    });
    await page.addStyleTag({
      content: '#intercom-container,.intercom-launcher,[class*="intercom"]{display:none !important;}',
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(OUT_DIR, 'store-dashboard-1280x800.png'),
    });
  });

  test('store: dashboard with Market Lending card (dark)', async () => {
    const page = await storeCtx.newPage();
    await mockPositions(page);
    await page.addInitScript(() => {
      try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ }
      const dark = () => document.documentElement.classList.add('dark');
      if (document.documentElement) dark();
      document.addEventListener('DOMContentLoaded', dark);
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]', {
      timeout: 20_000,
    });
    await page.waitForFunction(() => {
      const host = document.querySelector(
        '[data-morpho-ext-mount="morpho-ext-dashboard-supply"]',
      );
      const sr = (host as HTMLElement | null)?.shadowRoot;
      return !!(sr && /1,234\.56|USDC/.test(sr.textContent ?? ''));
    }, null, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({
      content: '[data-testid="tab-positions"],[data-testid="tab-activity"]{display:none !important;} main [class*="css-1xe81xy"],main [class*="e6ja7zi"]{display:none !important;} #intercom-container,.intercom-launcher,[class*="intercom"]{display:none !important;}',
    });
    await page.evaluate(() => {
      const host = document.querySelector(
        '[data-morpho-ext-mount="morpho-ext-dashboard-supply"]',
      );
      (host as HTMLElement | null)?.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -90);
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(OUT_DIR, 'store-dashboard-dark-1280x800.png'),
    });
  });

  test('store: market page with Lend tab active (dark)', async () => {
    const page = await storeCtx.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ }
      const dark = () => document.documentElement.classList.add('dark');
      if (document.documentElement) dark();
      document.addEventListener('DOMContentLoaded', dark);
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(MARKET_URL);
    await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });
    const lendTab = page.locator('[data-testid="market-action-panel"] .mx-tab', {
      hasText: 'Lend',
    });
    await lendTab.waitFor({ timeout: 15_000 });
    await lendTab.click();
    await page.waitForTimeout(4000);
    await page.addStyleTag({
      content: '#intercom-container,.intercom-launcher,[class*="intercom"]{display:none !important;}',
    });
    await page.screenshot({
      path: join(OUT_DIR, 'store-market-dark-1280x800.png'),
    });
  });
});

test('shot: dashboard market lending card (dark)', async () => {
  const page = await ctx.newPage();
  await mockPositions(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ }
    const dark = () => document.documentElement.classList.add('dark');
    if (document.documentElement) dark();
    document.addEventListener('DOMContentLoaded', dark);
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]', {
    timeout: 20_000,
  });
  await page.waitForFunction(() => {
    const host = document.querySelector('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]');
    const sr = (host as HTMLElement | null)?.shadowRoot;
    return !!(sr && /1,234\.56|USDC/.test(sr.textContent ?? ''));
  }, null, { timeout: 20_000 });
  await page.waitForTimeout(1500);

  const card = page.locator('[data-morpho-ext-mount="morpho-ext-dashboard-supply"]');
  await card.screenshot({ path: join(OUT_DIR, 'dashboard-card-dark.png') });
});

// Captures README screenshots. Masks sensitive values by intercepting the
// Morpho API GraphQL response and serving a demo payload — so React
// renders from mocked state and there's nothing real to scrub.

import { test, chromium, type BrowserContext, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { getExtensionId, setExtensionStorage } from './extensionStorage';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = join(__dirname, '..', '..', 'dist');
const OUT_DIR = join(__dirname, '..', '..', 'docs', 'screenshots');

const MARKET_URL =
  'https://app.morpho.org/ethereum/variable/0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99/wbtc-usdt';
const MARKETS_LIST_URL = 'https://app.morpho.org/variable';
const VAULTS_LIST_URL = 'https://app.morpho.org/vaults';
// A deterministic demo address — the actual value doesn't matter because
// the API response is mocked. Using 0xdead…beef makes it obvious in any
// leftover UI chrome that this is a demo screenshot.
const DEMO_ADDRESS = '0xdEaDbeefdeadBEefdEAdbeefDeadbEefDeAdBeEf';
const DASHBOARD_URL = `https://app.morpho.org/portfolio/${DEMO_ADDRESS}`;

let ctx: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  userDataDir = mkdtempSync(join(tmpdir(), 'morpho-shots-'));
  ctx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
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

// Intercept Morpho API GraphQL and overwrite UserMarketPositions with a
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
                  state: {
                    supplyShares: '1000000000000000000000',
                    supplyAssets: '1234560000',
                    supplyAssetsUsd: 1234.56,
                    borrowShares: '0',
                    borrowAssets: '0',
                    borrowAssetsUsd: 0,
                    collateral: '0',
                    collateralUsd: 0,
                  },
                  market: {
                    marketId:
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
                  state: {
                    supplyShares: '500000000000000000000',
                    supplyAssets: '789120000000000000',
                    supplyAssetsUsd: 2468.91,
                    borrowShares: '0',
                    borrowAssets: '0',
                    borrowAssetsUsd: 0,
                    collateral: '0',
                    collateralUsd: 0,
                  },
                  market: {
                    marketId:
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
      executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
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

// ------------------------------------------------------------
// Favorites feature screenshots. We star a few rows in-browser, then
// capture both the "all rows with stars" and "favorites-only" views.
// ------------------------------------------------------------

// Seed extension storage with N pre-starred rows before the real screenshot:
// 1) goto once just to discover the first N row keys,
// 2) write them to chrome.storage.local in that page's browser context,
// 3) reload so the extension marks those rows "on" on first render.
// This avoids clicking stars in a loop, which tends to trigger Morpho's
// table to re-fetch and blank out during screenshots.
async function seedFavoritesFromList(
  page: Page,
  url: string,
  n: number,
): Promise<string[]> {
  await page.goto(url);
  await page.waitForSelector('tbody tr[data-morpho-ext-fav-key]', { timeout: 30_000 });
  const keys = await page
    .locator('tbody tr[data-morpho-ext-fav-key]')
    .evaluateAll((els, count) =>
      els
        .slice(0, count as number)
        .map((el) => el.getAttribute('data-morpho-ext-fav-key'))
        .filter((k): k is string => !!k),
    n);
  await setExtensionStorage(page.context(), 'morpho-ext:favorites', keys);
  // Morpho keeps optional third-party resources open long after its app DOM is
  // ready. Waiting for the full `load` event makes this deterministic screenshot
  // depend on those resources; the row assertion below is the real readiness gate.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('tbody tr[data-morpho-ext-fav="on"]', { timeout: 30_000 });
  // Let the rest of the table instrument + any number-flow animations settle.
  await page.waitForTimeout(800);
  return keys;
}

async function hideSiteChrome(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '#intercom-container,.intercom-launcher,[class*="intercom"]{display:none !important;}',
  });
}

test('shot: favorites on markets list (light)', async () => {
  const page = await ctx.newPage();
  await seedFavoritesFromList(page, MARKETS_LIST_URL, 3);
  await hideSiteChrome(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(OUT_DIR, 'favorites-markets-light.png'),
    fullPage: false,
  });
});

test('shot: favorites-only filter on markets list (light)', async () => {
  const page = await ctx.newPage();
  await seedFavoritesFromList(page, MARKETS_LIST_URL, 3);
  await page.locator('#morpho-ext-fav-toggle').click();
  await hideSiteChrome(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(OUT_DIR, 'favorites-markets-filtered-light.png'),
    fullPage: false,
  });
});

test('shot: favorites on vaults list (light)', async () => {
  const page = await ctx.newPage();
  await seedFavoritesFromList(page, VAULTS_LIST_URL, 3);
  await hideSiteChrome(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(OUT_DIR, 'favorites-vaults-light.png'),
    fullPage: false,
  });
});

test('shot: favorites on markets list (dark)', async () => {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ }
    const dark = () => document.documentElement.classList.add('dark');
    if (document.documentElement) dark();
    document.addEventListener('DOMContentLoaded', dark);
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await seedFavoritesFromList(page, MARKETS_LIST_URL, 3);
  await hideSiteChrome(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(OUT_DIR, 'favorites-markets-dark.png'),
    fullPage: false,
  });
});

test('shot: favorites close-up (light)', async () => {
  // Crop a tight shot highlighting the star + chip together.
  const page = await ctx.newPage();
  await seedFavoritesFromList(page, MARKETS_LIST_URL, 2);
  await hideSiteChrome(page);
  await page.waitForTimeout(400);
  // Take full screenshot, then crop programmatically — simpler than
  // computing element bounds across light/dark + viewport variants.
  await page.screenshot({
    path: join(OUT_DIR, 'favorites-closeup-light.png'),
    clip: { x: 0, y: 0, width: 720, height: 560 },
  });
});

// ------------------------------------------------------------
// Chrome Web Store 1280x800 versions — separate context, exact viewport.
// ------------------------------------------------------------
test.describe('store: favorites (1280x800)', () => {
  let favCtx: BrowserContext;
  let favDir: string;

  test.beforeAll(async () => {
    favDir = mkdtempSync(join(tmpdir(), 'morpho-shots-fav-'));
    favCtx = await chromium.launchPersistentContext(favDir, {
      executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
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
    await favCtx?.close();
    if (favDir) rmSync(favDir, { recursive: true, force: true });
  });

  test('store: favorites on markets list', async () => {
    const page = await favCtx.newPage();
    await seedFavoritesFromList(page, MARKETS_LIST_URL, 3);
    await hideSiteChrome(page);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(OUT_DIR, 'store-favorites-markets-1280x800.png'),
    });
  });

  test('store: favorites-only filter on markets list', async () => {
    const page = await favCtx.newPage();
    await seedFavoritesFromList(page, MARKETS_LIST_URL, 3);
    await page.locator('#morpho-ext-fav-toggle').click();
    await hideSiteChrome(page);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(OUT_DIR, 'store-favorites-markets-filtered-1280x800.png'),
    });
  });

  test('store: favorites on markets list (dark)', async () => {
    const page = await favCtx.newPage();
    await page.addInitScript(() => {
      try { localStorage.setItem('theme', 'dark'); } catch { /* ignore */ }
      const dark = () => document.documentElement.classList.add('dark');
      if (document.documentElement) dark();
      document.addEventListener('DOMContentLoaded', dark);
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await seedFavoritesFromList(page, MARKETS_LIST_URL, 3);
    await hideSiteChrome(page);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(OUT_DIR, 'store-favorites-markets-dark-1280x800.png'),
    });
  });
});

// --- Toolbar popup screenshots (v0.3.0+) ----------------------------------

async function discoverExtensionId(): Promise<string> {
  const id = await getExtensionId(ctx);
  if (!id) throw new Error('Could not discover extension id for popup screenshots');
  return id;
}

const POPUP_VIEWPORT = { width: 400, height: 580 };

test('shot: popup Prime tab (light)', async () => {
  const id = await discoverExtensionId();
  const page = await ctx.newPage();
  await page.setViewportSize(POPUP_VIEWPORT);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`chrome-extension://${id}/src/popup/index.html`);
  await page.waitForSelector('.p-row', { timeout: 30_000 });
  // Let token icons fetch + render before snapshotting.
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: join(OUT_DIR, 'popup-prime-light.png'),
    fullPage: false,
  });
  await page.close();
});

test('shot: popup Prime tab (dark)', async () => {
  const id = await discoverExtensionId();
  const page = await ctx.newPage();
  await page.setViewportSize(POPUP_VIEWPORT);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`chrome-extension://${id}/src/popup/index.html`);
  await page.waitForSelector('.p-row', { timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: join(OUT_DIR, 'popup-prime-dark.png'),
    fullPage: false,
  });
  await page.close();
});

test('shot: popup Favorites tab (light)', async () => {
  const id = await discoverExtensionId();
  // Seed a representative mix: V1 market, V1 vault, V2 vault.
  await setExtensionStorage(ctx, 'morpho-ext:favorites', [
    // V1 market: cbBTC/USDC on Mainnet
    'market:ethereum:0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64',
    // V1 market: WETH/USDC on Base
    'market:base:0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
    // V1 vault: Spark Blue Chip USDC Vault on Mainnet
    'vault:ethereum:0xfeac08ffa38d95ec5ed7c46c933c8891a44c5f26',
    // V2 vault: sky.money USDT Savings on Mainnet
    'vault:ethereum:0x23f5e9c35820f4bab695ac1f19c203cc3f8e1e11',
  ]);

  const page = await ctx.newPage();
  await page.setViewportSize(POPUP_VIEWPORT);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`chrome-extension://${id}/src/popup/index.html`);
  await page.locator('.p-tab', { hasText: 'Favorites' }).click();
  await page.waitForSelector('.p-row', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: join(OUT_DIR, 'popup-favorites-light.png'),
    fullPage: false,
  });
  await page.close();
});

test('shot: popup Favorites tab (dark)', async () => {
  const id = await discoverExtensionId();
  await setExtensionStorage(ctx, 'morpho-ext:favorites', [
    'market:ethereum:0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64',
    'market:base:0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
    'vault:ethereum:0xfeac08ffa38d95ec5ed7c46c933c8891a44c5f26',
    'vault:ethereum:0x23f5e9c35820f4bab695ac1f19c203cc3f8e1e11',
  ]);

  const page = await ctx.newPage();
  await page.setViewportSize(POPUP_VIEWPORT);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`chrome-extension://${id}/src/popup/index.html`);
  await page.locator('.p-tab', { hasText: 'Favorites' }).click();
  await page.waitForSelector('.p-row', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: join(OUT_DIR, 'popup-favorites-dark.png'),
    fullPage: false,
  });
  await page.close();
});

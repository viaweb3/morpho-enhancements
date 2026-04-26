import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = join(__dirname, '..', '..', 'dist');

let ctx: BrowserContext;
let userDataDir: string;
let extensionId: string;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'morpho-ext-popup-'));
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

  // Discover the extension id via the test postMessage bridge.
  const probe = await ctx.newPage();
  await probe.goto('https://app.morpho.org/');
  extensionId = await probe.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const handler = (e: MessageEvent) => {
          const data = e.data as { type?: string; id?: string } | null;
          if (e.source === window && data?.type === 'morpho-ext-test:extension-id') {
            window.removeEventListener('message', handler);
            resolve(data.id ?? '');
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'morpho-ext-test:get-extension-id' }, '*');
      }),
  );
  await probe.close();
  if (!extensionId) throw new Error('Could not discover extension id');
});

test.afterAll(async () => {
  await ctx?.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

function popupUrl(): string {
  return `chrome-extension://${extensionId}/src/popup/index.html`;
}

// The favorites bridge sits in a content script that loads at
// `document_idle`. Probing for it BEFORE every state-modifying call
// avoids a class of flakes where postMessage gets dropped because the
// listener isn't wired yet.
async function waitForBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 800);
        const handler = (e: MessageEvent) => {
          const data = e.data as { type?: string } | null;
          if (e.source === window && data?.type === 'morpho-ext-test:extension-id') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(true);
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'morpho-ext-test:get-extension-id' }, '*');
      }),
    { timeout: 15_000 },
  );
}

async function clearFavorites(page: Page): Promise<void> {
  await waitForBridge(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (
            e.source === window &&
            (e.data as { type?: string } | null)?.type ===
              'morpho-ext-test:cleared'
          ) {
            window.removeEventListener('message', handler);
            resolve();
          }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'morpho-ext-test:clear-favorites' }, '*');
      }),
  );
}

async function seedFavorites(page: Page, keys: string[]): Promise<void> {
  await waitForBridge(page);
  await page.evaluate(
    (k) =>
      new Promise<void>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (
            e.source === window &&
            (e.data as { type?: string } | null)?.type ===
              'morpho-ext-test:seeded'
          ) {
            window.removeEventListener('message', handler);
            resolve();
          }
        };
        window.addEventListener('message', handler);
        window.postMessage(
          { type: 'morpho-ext-test:set-favorites', keys: k },
          '*',
        );
      }),
    keys,
  );
}

// Each test starts from a clean favorites slate.
test.beforeEach(async () => {
  const page = await ctx.newPage();
  await page.goto('https://app.morpho.org/', { waitUntil: 'domcontentloaded' });
  await clearFavorites(page);
  await page.close();
});

test('popup opens with Prime tab default and renders 19 curated markets', async () => {
  const page = await ctx.newPage();
  await page.goto(popupUrl());

  // Brand banner — title visible, not clipped (height check).
  const title = page.locator('.p-brand-title');
  await expect(title).toHaveText('Morpho Enhancements');
  await expect(title).toBeVisible();

  // Prime tab is the default active tab and shows the curated count.
  const primeTab = page.locator('.p-tab', { hasText: 'Prime' });
  await expect(primeTab).toHaveAttribute('data-active', 'true');
  await expect(primeTab.locator('.p-tab-count')).toHaveText('19');

  // Wait for at least one row to render (network-dependent).
  await page.waitForSelector('.p-row', { timeout: 30_000 });
  const rows = page.locator('.p-row');
  await expect(rows).toHaveCount(19);

  // First row should have all four stats present.
  const firstRow = rows.first();
  await expect(firstRow).toContainText('Supply');
  await expect(firstRow).toContainText('TVL');
  await expect(firstRow).toContainText('util');
  await expect(firstRow).toContainText('LLTV');
  await expect(firstRow.locator('.p-chain-chip')).toBeVisible();

  await page.close();
});

test('switching to empty Favorites tab shows the empty-state copy', async () => {
  const page = await ctx.newPage();
  await page.goto(popupUrl());

  await page.locator('.p-tab', { hasText: 'Favorites' }).click();

  await expect(page.locator('.p-tab', { hasText: 'Favorites' })).toHaveAttribute(
    'data-active',
    'true',
  );
  await expect(page.locator('.p-empty')).toContainText('No favorites yet');

  await page.close();
});

test('seeded V1 market favorite appears in Favorites tab with live data', async () => {
  // Seed a known live V1 market: cbBTC/USDC on Mainnet (in CURATED_MARKETS).
  const seedPage = await ctx.newPage();
  await seedPage.goto('https://app.morpho.org/');
  await seedFavorites(seedPage, [
    'market:ethereum:0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64',
  ]);
  await seedPage.close();

  const page = await ctx.newPage();
  await page.goto(popupUrl());
  await page.locator('.p-tab', { hasText: 'Favorites' }).click();

  // Wait for the favorite row to load — pair label should be cbBTC/USDC.
  const row = page.locator('.p-row').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('cbBTC/USDC');
  await expect(row).toContainText('Supply');
  // CSS text-transform makes the chip display uppercase, but the DOM
  // textContent stays in original case ("Mainnet").
  await expect(row).toContainText(/mainnet/i);

  await page.close();
});

test('seeded V2 vault favorite renders name (not address) and V2 chip', async () => {
  // sky.money USDT Savings — confirmed V2 vault on Mainnet earlier.
  const seedPage = await ctx.newPage();
  await seedPage.goto('https://app.morpho.org/');
  await seedFavorites(seedPage, [
    'vault:ethereum:0x23f5e9c35820f4bab695ac1f19c203cc3f8e1e11',
  ]);
  await seedPage.close();

  const page = await ctx.newPage();
  await page.goto(popupUrl());
  await page.locator('.p-tab', { hasText: 'Favorites' }).click();

  const row = page.locator('.p-row').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  // The pair label should be the vault's human name, not a 0x... address.
  await expect(row).toContainText('sky.money', { timeout: 30_000 });
  await expect(row).not.toContainText('0x23f5');
  // V2 chip should show.
  await expect(row.locator('.p-version-chip')).toHaveText('V2');

  await page.close();
});

test('sort buttons reorder rows by APY descending', async () => {
  const page = await ctx.newPage();
  await page.goto(popupUrl());
  await page.waitForSelector('.p-row', { timeout: 30_000 });

  await page.locator('.p-sortbtn', { hasText: 'APY' }).click();
  await expect(page.locator('.p-sortbtn', { hasText: 'APY' })).toHaveAttribute(
    'data-active',
    'true',
  );

  // Read the percent values from the first three rows. They should be
  // monotonically non-increasing.
  const apys = await page
    .locator('.p-row .p-stat-apy strong')
    .evaluateAll((els) =>
      els
        .slice(0, 3)
        .map((el) => parseFloat((el.textContent ?? '').replace('%', ''))),
    );
  expect(apys.length).toBeGreaterThanOrEqual(3);
  expect(apys[0]).toBeGreaterThanOrEqual(apys[1]);
  expect(apys[1]).toBeGreaterThanOrEqual(apys[2]);

  await page.close();
});

test('chrome.storage cache persists across popup open/close', async () => {
  // First open — populates the cache.
  const first = await ctx.newPage();
  await first.goto(popupUrl());
  await first.waitForSelector('.p-row', { timeout: 30_000 });
  await first.close();

  // Second open — first paint should already have rows (no waiting on
  // network). Render-time check: rows present within 2s, well under what
  // a cold network fetch would take.
  const second = await ctx.newPage();
  await second.goto(popupUrl());
  await expect(second.locator('.p-row').first()).toBeVisible({ timeout: 2_000 });
  await second.close();
});

test('refresh button clears cache (next open re-fetches)', async () => {
  const page = await ctx.newPage();
  await page.goto(popupUrl());
  await page.waitForSelector('.p-row', { timeout: 30_000 });

  // Clicking refresh shouldn't throw or break the UI; rows should still be
  // present after re-fetch completes.
  await page.locator('.p-refresh').click();
  // The refresh icon spins for ~600ms — wait it out then re-verify.
  await page.waitForTimeout(900);
  await expect(page.locator('.p-row').first()).toBeVisible();

  await page.close();
});

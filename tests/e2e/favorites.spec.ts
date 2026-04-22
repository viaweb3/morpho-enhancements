import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = join(__dirname, '..', '..', 'dist');

const MARKETS_URL = 'https://app.morpho.org/markets';
const VAULTS_URL = 'https://app.morpho.org/vaults';

let ctx: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'morpho-ext-fav-'));
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

test.beforeEach(async () => {
  // Ensure favorites state from previous tests doesn't leak.
  const page = await ctx.newPage();
  await page.goto('https://app.morpho.org/');
  await page.evaluate(() => localStorage.removeItem('morpho-ext:favorites'));
  await page.close();
});

async function waitForStars(page: Page): Promise<number> {
  await page.waitForSelector('tbody tr[data-morpho-ext-fav-key]', { timeout: 30_000 });
  return page.locator('tbody tr[data-morpho-ext-fav-key]').count();
}

test('injects stars on /markets rows and filters to favorites', async () => {
  const page = await ctx.newPage();
  await page.goto(MARKETS_URL);

  const rowCount = await waitForStars(page);
  expect(rowCount).toBeGreaterThan(2);

  // Every row should have a button and be in "off" state initially.
  const firstRow = page.locator('tbody tr[data-morpho-ext-fav-key]').first();
  await expect(firstRow).toHaveAttribute('data-morpho-ext-fav', 'off');
  const firstStar = firstRow.locator('.morpho-ext-fav-btn');
  await expect(firstStar).toBeVisible();
  await expect(firstStar).toHaveAttribute('aria-pressed', 'false');

  // Click the star — row flips to "on".
  await firstStar.click();
  await expect(firstRow).toHaveAttribute('data-morpho-ext-fav', 'on');
  await expect(firstStar).toHaveAttribute('aria-pressed', 'true');

  const favKey = await firstRow.getAttribute('data-morpho-ext-fav-key');
  expect(favKey).toMatch(/^market:[a-z-]+:0x[a-f0-9]+$/);

  // Confirm persistence in localStorage.
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('morpho-ext:favorites') ?? '[]'),
  );
  expect(stored).toContain(favKey);

  // Toggle the filter chip — non-starred rows should become hidden.
  const chip = page.locator('#morpho-ext-fav-toggle');
  await expect(chip).toBeVisible();
  await chip.click();

  // The html element now has data-morpho-ext-fav-only="true".
  await expect(page.locator('html')).toHaveAttribute('data-morpho-ext-fav-only', 'true');

  // Starred row remains visible, at least one off-row is hidden.
  await expect(firstRow).toBeVisible();
  const hiddenOff = await page.evaluate(() => {
    const offs = Array.from(
      document.querySelectorAll<HTMLElement>('tr[data-morpho-ext-fav="off"]'),
    );
    return offs.some((el) => el.getBoundingClientRect().height === 0);
  });
  expect(hiddenOff).toBeTruthy();

  // Toggle off — the off rows become visible again.
  await chip.click();
  await expect(page.locator('html')).toHaveAttribute('data-morpho-ext-fav-only', 'false');
});

test('multiple favorites can be selected at once', async () => {
  const page = await ctx.newPage();
  await page.goto(MARKETS_URL);
  await page.waitForSelector('tbody tr[data-morpho-ext-fav-key]', { timeout: 30_000 });

  const rows = page.locator('tbody tr[data-morpho-ext-fav-key]');
  await rows.nth(0).locator('.morpho-ext-fav-btn').click();
  await rows.nth(1).locator('.morpho-ext-fav-btn').click();
  await rows.nth(2).locator('.morpho-ext-fav-btn').click();

  await expect(rows.nth(0)).toHaveAttribute('data-morpho-ext-fav', 'on');
  await expect(rows.nth(1)).toHaveAttribute('data-morpho-ext-fav', 'on');
  await expect(rows.nth(2)).toHaveAttribute('data-morpho-ext-fav', 'on');

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('morpho-ext:favorites') ?? '[]'),
  );
  expect(stored.length).toBeGreaterThanOrEqual(3);

  // Clicking the navigation (the <a>) should still work on unstarred areas.
  // We verify the star click did NOT navigate — URL should still be /markets.
  expect(page.url()).toContain('/markets');
});

test('stars also work on /vaults and persist across navigation', async () => {
  const page = await ctx.newPage();
  await page.goto(VAULTS_URL);

  const rowCount = await waitForStars(page);
  expect(rowCount).toBeGreaterThan(2);

  const firstRow = page.locator('tbody tr[data-morpho-ext-fav-key]').first();
  const star = firstRow.locator('.morpho-ext-fav-btn');
  await star.click();
  await expect(firstRow).toHaveAttribute('data-morpho-ext-fav', 'on');
  const key = await firstRow.getAttribute('data-morpho-ext-fav-key');
  expect(key).toMatch(/^vault:[a-z-]+:0x[a-f0-9]+$/);

  // Navigate to /markets and back — favorite persists.
  await page.goto(MARKETS_URL);
  await waitForStars(page);
  await page.goto(VAULTS_URL);
  await page.waitForSelector('tbody tr[data-morpho-ext-fav-key]', { timeout: 30_000 });

  const stillOn = await page.evaluate((favKey) => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('tr[data-morpho-ext-fav-key]'),
    );
    const match = rows.find((r) => r.getAttribute('data-morpho-ext-fav-key') === favKey);
    return match?.getAttribute('data-morpho-ext-fav') === 'on';
  }, key);
  expect(stillOn).toBeTruthy();
});

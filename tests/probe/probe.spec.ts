import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const MARKET_URL =
  'https://app.morpho.org/ethereum/market/0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99/wbtc-usdt';
const DASHBOARD_URL =
  'https://app.morpho.org/dashboard/0x11111111652DeB43CF2ee68065E8296249428B61';

async function dump(page: import('@playwright/test').Page, name: string) {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  // Extra wait for React hydration + data load
  await page.waitForTimeout(6_000);

  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });

  const report = await page.evaluate(() => {
    const byTestId = Array.from(document.querySelectorAll<HTMLElement>('[data-testid]')).map(
      (el) => ({
        testid: el.getAttribute('data-testid'),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.innerText || '').slice(0, 80).replace(/\s+/g, ' ').trim(),
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
      }),
    );

    // Find the element containing the word "Borrow" that looks like a panel/form
    const borrowCandidates = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .filter((el) => {
        const t = (el.innerText || '').trim();
        return t.length < 500 && /\bBorrow\b/i.test(t);
      })
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute('data-testid'),
        className: (el.className || '').toString().slice(0, 120),
        text: (el.innerText || '').slice(0, 150).replace(/\s+/g, ' ').trim(),
        path: (() => {
          const parts: string[] = [];
          let cur: Element | null = el;
          while (cur && parts.length < 8) {
            const tid = cur.getAttribute?.('data-testid');
            parts.unshift(
              `${cur.tagName.toLowerCase()}${tid ? `[data-testid="${tid}"]` : ''}`,
            );
            cur = cur.parentElement;
          }
          return parts.join(' > ');
        })(),
      }));

    return {
      url: location.href,
      title: document.title,
      totalTestIds: byTestId.length,
      testIds: byTestId,
      borrowCandidates,
    };
  });

  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(report, null, 2));

  // Trim HTML: innerHTML of the first element whose innerText contains "Borrow" and is moderately sized
  const html = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    // Strip scripts/styles to keep file small
    const clone = main.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script,style,noscript,svg').forEach((n) => n.remove());
    return clone.outerHTML.slice(0, 400_000);
  });
  writeFileSync(join(OUT, `${name}.html`), html);
}

test('probe market page', async ({ page }) => {
  await page.goto(MARKET_URL);
  await dump(page, 'market');
});

test('probe dashboard page', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  await dump(page, 'dashboard');
});

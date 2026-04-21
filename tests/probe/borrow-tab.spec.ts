import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const MARKET_URL =
  'https://app.morpho.org/ethereum/market/0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99/wbtc-usdt';

test('describe borrow tab structure', async ({ page }) => {
  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });
  await page.waitForTimeout(3000);

  const report = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(
      '[data-testid="market-action-panel"]',
    );
    if (!panel) return { error: 'no panel' };

    // Find the "Borrow" button (pill) that's a direct child of the panel area
    const borrowBtn = Array.from(panel.querySelectorAll<HTMLElement>('button')).find(
      (b) => (b.textContent || '').trim() === 'Borrow',
    );
    if (!borrowBtn) return { error: 'no borrow button found' };

    // Capture ancestor chain up to panel with classNames/tag/role
    const ancestors: unknown[] = [];
    let cur: HTMLElement | null = borrowBtn;
    while (cur && cur !== panel && ancestors.length < 8) {
      const r = cur.getBoundingClientRect();
      ancestors.push({
        tag: cur.tagName.toLowerCase(),
        role: cur.getAttribute('role'),
        ariaSelected: cur.getAttribute('aria-selected'),
        classes: (cur.className || '').toString().slice(0, 200),
        text: (cur.textContent || '').trim().slice(0, 80),
        childCount: cur.children.length,
        rect: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
      });
      cur = cur.parentElement;
    }

    // Siblings of the immediate tab container
    const tabContainer = borrowBtn.parentElement;
    const siblings = tabContainer
      ? Array.from(tabContainer.children).map((c) => ({
          tag: c.tagName.toLowerCase(),
          text: (c.textContent || '').trim().slice(0, 60),
          classes: (c.className || '').toString().slice(0, 120),
          rect: (() => {
            const r = c.getBoundingClientRect();
            return {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })(),
        }))
      : [];

    // Panel top-level structure: first few children
    const panelChildren = Array.from(panel.children).map((c) => ({
      tag: c.tagName.toLowerCase(),
      classes: (c.className || '').toString().slice(0, 120),
      text: (c.textContent || '').trim().slice(0, 100),
      childCount: c.children.length,
      rect: (() => {
        const r = c.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })(),
    }));

    return {
      borrowBtnHtml: borrowBtn.outerHTML.slice(0, 500),
      borrowBtnRect: (() => {
        const r = borrowBtn.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })(),
      ancestors,
      siblings,
      panelChildren,
      panelRect: (() => {
        const r = panel.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })(),
      panelOuter: panel.outerHTML.slice(0, 4000),
    };
  });

  writeFileSync(join(OUT, 'borrow-tab.json'), JSON.stringify(report, null, 2));
  await page.screenshot({
    path: join(OUT, 'borrow-tab.png'),
    clip: { x: 820, y: 160, width: 460, height: 700 },
  });
});

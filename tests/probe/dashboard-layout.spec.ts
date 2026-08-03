import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');

const DASHBOARD_URL =
  'https://app.morpho.org/portfolio/0x11111111652DeB43CF2ee68065E8296249428B61';

test('describe dashboard layout tree', async ({ page }) => {
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('main', { timeout: 30_000 });
  await page.waitForTimeout(3000);

  const report = await page.evaluate(() => {
    function describe(el: Element, depth: number): unknown {
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(el as HTMLElement);
      return {
        depth,
        tag: el.tagName.toLowerCase(),
        classes: (el.className || '').toString().slice(0, 180),
        text: ((el as HTMLElement).innerText || '').trim().slice(0, 40).replace(/\s+/g, ' '),
        display: cs.display,
        flexDirection: cs.flexDirection,
        rect: {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
        childCount: el.children.length,
      };
    }

    const tree: unknown[] = [];
    function walk(el: Element, depth: number, maxDepth: number) {
      tree.push(describe(el, depth));
      if (depth >= maxDepth) return;
      for (const c of Array.from(el.children)) walk(c, depth + 1, maxDepth);
    }
    const main = document.querySelector('main');
    if (!main) return { error: 'no main' };
    walk(main, 0, 4);
    return { tree };
  });

  writeFileSync(join(OUT, 'dashboard-layout.json'), JSON.stringify(report, null, 2));
});

import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const MARKET_URL =
  'https://app.morpho.org/ethereum/variable/0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99/wbtc-usdt';

test('describe all primary buttons + CSS token names', async ({ page }) => {
  await page.goto(MARKET_URL);
  await page.waitForSelector('[data-testid="market-action-panel"]', { timeout: 45_000 });
  await page.waitForTimeout(3000);

  const report = await page.evaluate(() => {
    // All buttons on the page with their computed styles + class names
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 40 && r.height > 20 && r.width < 500;
      })
      .slice(0, 30)
      .map((b) => {
        const cs = getComputedStyle(b);
        return {
          text: (b.textContent || '').trim().slice(0, 40),
          classes: (b.className || '').toString().slice(0, 250),
          bg: cs.backgroundColor,
          color: cs.color,
          fontWeight: cs.fontWeight,
          fontSize: cs.fontSize,
          height: cs.height,
          padding: cs.padding,
          borderRadius: cs.borderRadius,
        };
      });

    // Dump :root custom properties related to colors/typography so we can use them
    const rootStyle = getComputedStyle(document.documentElement);
    const keys = [
      '--color-bg-primary', '--color-bg-card', '--color-bg-bloc',
      '--color-bg-inverted', '--color-text-inverted',
      '--color-text-primary', '--color-text-secondary',
      '--color-text-body', '--color-text-negative', '--color-text-positive',
      '--color-border-primary', '--color-border-interactive-active',
    ];
    const vars: Record<string, string> = {};
    keys.forEach((k) => {
      const v = rootStyle.getPropertyValue(k);
      if (v) vars[k] = v.trim();
    });
    // Dump ALL --color-* custom props
    const allColorVars: Record<string, string> = {};
    for (let i = 0; i < document.styleSheets.length; i++) {
      try {
        const rules = (document.styleSheets[i].cssRules || []) as unknown as CSSRule[];
        for (const rule of Array.from(rules)) {
          const r = rule as CSSRule & { selectorText?: string; style?: CSSStyleDeclaration };
          if (r.selectorText === ':root' || r.selectorText === 'html' || r.selectorText === ':root, :host') {
            const style = r.style;
            if (!style) continue;
            for (let j = 0; j < style.length; j++) {
              const prop = style[j];
              if (prop.startsWith('--color-') || prop.startsWith('--bg-') || prop.startsWith('--text-')) {
                allColorVars[prop] = style.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch {
        /* cross-origin sheet, ignore */
      }
    }

    return { buttons, vars, allColorVars };
  });

  writeFileSync(join(OUT, 'buttons.json'), JSON.stringify(report, null, 2));
});

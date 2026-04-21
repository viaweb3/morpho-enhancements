import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import styleText from '@/ui/styles.css?inline';

const HOST_ATTR = 'data-morpho-ext-mount';

export type MountHandle = {
  unmount: () => void;
  isStillAttached: () => boolean;
};

type MountOptions = {
  id: string;
  anchor: Element;
  position: 'beforeend' | 'afterend' | 'beforebegin' | 'afterbegin';
  component: () => React.ReactNode;
};

function isDarkTheme(): boolean {
  // Primary signal: next-themes toggles html.dark / data-theme on <html>.
  const html = document.documentElement;
  if (html.classList.contains('dark')) return true;
  if (html.getAttribute('data-theme') === 'dark') return true;
  if (html.classList.contains('light')) return false;
  if (html.getAttribute('data-theme') === 'light') return false;
  // Fallback: compute luminance from the first element that actually paints
  // a non-transparent background (transparent rgba(0,0,0,0) would falsely
  // register as dark).
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
    if (!m) continue;
    const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (alpha < 0.05) continue; // transparent — not a signal
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luma < 0.5;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function mountReact(opts: MountOptions): MountHandle {
  // If a previous host with the same id is around, remove it first
  document
    .querySelectorAll<HTMLElement>(`[${HOST_ATTR}="${opts.id}"]`)
    .forEach((n) => n.remove());

  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, opts.id);
  host.style.display = 'block';
  host.style.width = '100%';
  opts.anchor.insertAdjacentElement(opts.position, host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styleText as string;
  shadow.appendChild(style);
  const appRoot = document.createElement('div');
  const applyTheme = () => {
    appRoot.classList.toggle('mx-dark', isDarkTheme());
  };
  appRoot.className = 'mx-root';
  applyTheme();
  shadow.appendChild(appRoot);

  // Watch for theme switches on the host page (next-themes toggles html.dark)
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  mql?.addEventListener?.('change', applyTheme);

  let root: Root | null = createRoot(appRoot);
  root.render(createElement(opts.component));

  return {
    unmount: () => {
      themeObserver.disconnect();
      mql?.removeEventListener?.('change', applyTheme);
      if (root) {
        root.unmount();
        root = null;
      }
      host.remove();
    },
    isStillAttached: () => host.isConnected,
  };
}

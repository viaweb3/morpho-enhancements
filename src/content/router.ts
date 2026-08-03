import { matchRoute, type RouteMatch } from '@/lib/url';

type Listener = (route: RouteMatch, pathname: string) => void;

// Patch history.pushState/replaceState + listen to popstate so SPA navigations
// emit a synthetic 'locationchange' event. Safe to call multiple times.
function ensureLocationChangeEvent() {
  const flag = '__morphoExtPatchedHistory';
  const w = window as unknown as Record<string, unknown>;
  if (w[flag]) return;
  w[flag] = true;
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const ret = origPush(...args);
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  };
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const ret = origReplace(...args);
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  };
  window.addEventListener('popstate', () =>
    window.dispatchEvent(new Event('locationchange')),
  );
}

export function watchRoute(listener: Listener): () => void {
  ensureLocationChangeEvent();
  let lastPathname = location.pathname;
  const emit = () => {
    lastPathname = location.pathname;
    listener(matchRoute(lastPathname), lastPathname);
  };
  const handler = () => emit();
  window.addEventListener('locationchange', handler);
  // pushState monkey-patches are not guaranteed to cross Chrome isolated-world
  // boundaries. A cheap pathname-only poll prevents stale market parameters
  // after client-side navigation even when the page replaces no watched node.
  const poll = setInterval(() => {
    if (location.pathname !== lastPathname) emit();
  }, 500);
  emit();
  return () => {
    clearInterval(poll);
    window.removeEventListener('locationchange', handler);
  };
}

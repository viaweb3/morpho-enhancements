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
  const emit = () => listener(matchRoute(location.pathname), location.pathname);
  const handler = () => emit();
  window.addEventListener('locationchange', handler);
  emit();
  return () => window.removeEventListener('locationchange', handler);
}

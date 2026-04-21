import { SUPPORTED_SLUGS as SLUG_LIST, type SupportedChainSlug } from './chains';

export type RouteMatch =
  | { kind: 'market'; chainSlug: SupportedChainSlug; marketId: `0x${string}`; pairSlug: string }
  | { kind: 'dashboard'; address: `0x${string}` }
  | { kind: 'other' };

const SUPPORTED_SLUGS = new Set<SupportedChainSlug>(SLUG_LIST);

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_ID = /^0x[a-fA-F0-9]{64}$/;

export function matchRoute(pathname: string): RouteMatch {
  const parts = pathname.split('/').filter(Boolean);
  // /<chain>/market/<id>/<slug>
  if (parts.length >= 4 && parts[1] === 'market') {
    const chainSlug = parts[0];
    const marketId = parts[2];
    const pairSlug = parts[3];
    if (
      SUPPORTED_SLUGS.has(chainSlug as SupportedChainSlug) &&
      HEX_ID.test(marketId)
    ) {
      return {
        kind: 'market',
        chainSlug: chainSlug as SupportedChainSlug,
        marketId: marketId as `0x${string}`,
        pairSlug,
      };
    }
  }
  // /dashboard/<address>
  if (parts.length >= 2 && parts[0] === 'dashboard' && HEX_ADDRESS.test(parts[1])) {
    return { kind: 'dashboard', address: parts[1] as `0x${string}` };
  }
  return { kind: 'other' };
}

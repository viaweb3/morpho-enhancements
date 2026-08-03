import { SUPPORTED_SLUGS as SLUG_LIST, type SupportedChainSlug } from './chains';

export type RouteMatch =
  | { kind: 'market'; chainSlug: SupportedChainSlug; marketId: `0x${string}`; pairSlug: string }
  | { kind: 'dashboard'; address: `0x${string}` }
  | { kind: 'markets-list' }
  | { kind: 'vaults-list' }
  | { kind: 'other' };

const SUPPORTED_SLUGS = new Set<SupportedChainSlug>(SLUG_LIST);

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const HEX_ID = /^0x[a-fA-F0-9]{64}$/;

export function matchRoute(pathname: string): RouteMatch {
  const parts = pathname.split('/').filter(Boolean);
  // /<chain>/variable/<id>/<slug>
  if (parts.length >= 4 && parts[1] === 'variable') {
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
  // /portfolio/<address>
  if (
    parts.length >= 2 &&
    parts[0] === 'portfolio' &&
    HEX_ADDRESS.test(parts[1])
  ) {
    return { kind: 'dashboard', address: parts[1] as `0x${string}` };
  }
  // /variable or /vaults (root list pages)
  if (parts.length === 1 && parts[0] === 'variable') {
    return { kind: 'markets-list' };
  }
  if (parts.length === 1 && parts[0] === 'vaults') return { kind: 'vaults-list' };
  return { kind: 'other' };
}

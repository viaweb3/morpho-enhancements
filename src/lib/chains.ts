import {
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  unichain,
  monad,
  worldchain,
  katana,
  hyperEvm,
} from 'viem/chains';
import type { Chain } from 'viem';

// URL slugs match what app.morpho.org uses in its public URLs
// (sourced from https://app.morpho.org/sitemap.xml). `opmainnet` NOT
// `optimism` — Morpho renamed their route when they onboarded OP to the
// new chain selector. `world-chain` uses a hyphen.
export type SupportedChainSlug =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'opmainnet'
  | 'polygon'
  | 'unichain'
  | 'monad'
  | 'world-chain'
  | 'katana'
  | 'hyperevm';

export const SUPPORTED_SLUGS: readonly SupportedChainSlug[] = [
  'ethereum',
  'base',
  'arbitrum',
  'opmainnet',
  'polygon',
  'unichain',
  'monad',
  'world-chain',
  'katana',
  'hyperevm',
] as const;

const SLUG_TO_CHAIN: Record<SupportedChainSlug, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  opmainnet: optimism,
  polygon,
  unichain,
  monad,
  'world-chain': worldchain,
  katana,
  hyperevm: hyperEvm,
};

// Morpho Blue is deployed at the same CREATE2 singleton address on every
// EVM chain Morpho officially supports. (zkSync would be an exception but
// Morpho does not deploy there.)
export const MORPHO_BLUE_ADDRESS =
  '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

// Address you receive when calling deposit() on each chain's native-wrapper
// contract (WETH9 or a WETH9-compatible clone). This is what we need for the
// "pay with native currency" flow: wrap native → receive this token → supply.
// Sources: each chain's native-wrapper deployment. Supported chain IDs are
// checked against https://docs.morpho.org/developers/api/get-started/#supported-networks.
export const WRAPPED_NATIVE_ADDRESS: Record<SupportedChainSlug, `0x${string}`> = {
  // ETH chains — wrapping ETH yields WETH.
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  base: '0x4200000000000000000000000000000000000006',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  opmainnet: '0x4200000000000000000000000000000000000006',
  unichain: '0x4200000000000000000000000000000000000006',
  'world-chain': '0x4200000000000000000000000000000000000006',
  katana: '0x4200000000000000000000000000000000000006',
  // Non-ETH chains — wrapping native yields a different token.
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WPOL (wraps POL)
  monad: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',   // WMON (wraps MON)
  hyperevm: '0x5555555555555555555555555555555555555555', // WHYPE (wraps HYPE)
};

// For legacy callers — same semantic.
export const WETH_ADDRESS = WRAPPED_NATIVE_ADDRESS;

export function isWrappedNative(address: string, slug: SupportedChainSlug): boolean {
  return address.toLowerCase() === WRAPPED_NATIVE_ADDRESS[slug].toLowerCase();
}

export const isWeth = isWrappedNative;

// Multiple public RPC endpoints per chain — viem's fallback transport rotates
// between them when one rate-limits (429) or errors. Ordered by observed
// reliability; chain-owned RPCs first, then public aggregators.
const RPC_URLS: Record<SupportedChainSlug, string[]> = {
  ethereum: [
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com',
    'https://eth.llamarpc.com',
  ],
  base: [
    'https://base-rpc.publicnode.com',
    'https://base.meowrpc.com',
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
  ],
  arbitrum: [
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arbitrum.meowrpc.com',
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.llamarpc.com',
  ],
  opmainnet: [
    'https://optimism-rpc.publicnode.com',
    'https://optimism.meowrpc.com',
    'https://mainnet.optimism.io',
    'https://optimism.llamarpc.com',
  ],
  polygon: [
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.meowrpc.com',
    'https://polygon-rpc.com',
    'https://polygon.llamarpc.com',
  ],
  unichain: [
    'https://unichain-rpc.publicnode.com',
    'https://mainnet.unichain.org',
  ],
  monad: [
    'https://rpc.monad.xyz',
    'https://rpc1.monad.xyz',
  ],
  'world-chain': [
    'https://worldchain-mainnet.g.alchemy.com/public',
    'https://worldchain-mainnet.gateway.tenderly.co',
  ],
  katana: [
    'https://rpc.katana.network',
  ],
  hyperevm: [
    'https://rpc.hyperliquid.xyz/evm',
  ],
};

export function resolveChain(slug: string): {
  chain: Chain;
  slug: SupportedChainSlug;
  rpcUrls: string[];
} | null {
  if (!(slug in SLUG_TO_CHAIN)) return null;
  const typed = slug as SupportedChainSlug;
  return { chain: SLUG_TO_CHAIN[typed], slug: typed, rpcUrls: RPC_URLS[typed] };
}

export function chainIdFromSlug(slug: SupportedChainSlug): number {
  return SLUG_TO_CHAIN[slug].id;
}

export function slugFromChainId(chainId: number): SupportedChainSlug | null {
  for (const slug of SUPPORTED_SLUGS) {
    if (SLUG_TO_CHAIN[slug].id === chainId) return slug;
  }
  return null;
}

// The native-currency symbol for a chain (ETH / POL / MON / HYPE). Used by
// the UI to label the wrap toggle appropriately per chain.
export function nativeSymbolForSlug(slug: SupportedChainSlug): string {
  return SLUG_TO_CHAIN[slug].nativeCurrency.symbol;
}

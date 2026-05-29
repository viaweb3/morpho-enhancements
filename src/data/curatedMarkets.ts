// Curated Morpho Blue markets surfaced in the toolbar popup's default tab.
//
// Selection rationale (mirrors the trademan/config/morpho.ts watch list
// the author runs in production):
//   - Blue-chip Prime-tier markets across mature chains
//   - Collateral whitelist: BTC / ETH / wstETH / sUSDS / XAUt
//   - Pool TVL ≥ $3M for non-Mainnet chains
//   - Mainnet, Base, Arbitrum, OP only (newer chains excluded as too thin)

import type { SupportedChainSlug } from '@/lib/chains';

export interface CuratedMarket {
  /** EVM chainId. */
  chainId: number;
  /** URL slug used by app.morpho.org for this chain. */
  chainSlug: SupportedChainSlug;
  /** Human label for the chain ("Mainnet", "Base"...). */
  chainLabel: string;
  /** Morpho Blue marketId (32-byte hex). */
  marketId: string;
  /** "cbBTC/USDC" style label for quick reading. */
  label: string;
  /** Loan (supplied) asset symbol. */
  loan: string;
  /** Collateral asset symbol. */
  collateral: string;
  /** LLTV as a percentage (e.g. 86.0). */
  lltv: number;
  /** Which V1 vault(s) allocate to this market — informational. */
  vaults: string[];
}

export const CURATED_MARKETS: CuratedMarket[] = [
  // --- Mainnet · Steakhouse USDC (V1) markets ---
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64',
    label: 'cbBTC/USDC',
    loan: 'USDC',
    collateral: 'cbBTC',
    lltv: 86.0,
    vaults: ['Steakhouse USDC'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49',
    label: 'WBTC/USDC',
    loan: 'USDC',
    collateral: 'WBTC',
    lltv: 86.0,
    vaults: ['Steakhouse USDC'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x94b823e6bd8ea533b4e33fbc307faea0b307301bc48763acc4d4aa4def7636cd',
    label: 'WETH/USDC',
    loan: 'USDC',
    collateral: 'WETH',
    lltv: 86.0,
    vaults: ['Steakhouse USDC'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc',
    label: 'wstETH/USDC',
    loan: 'USDC',
    collateral: 'wstETH',
    lltv: 86.0,
    vaults: ['Steakhouse USDC'],
  },

  // --- Mainnet · Steakhouse USDT (V1) markets ---
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0xe7e9694b754c4d4f7e21faf7223f6fa71abaeb10296a4c43a54a7977149687d2',
    label: 'wstETH/USDT',
    loan: 'USDT',
    collateral: 'wstETH',
    lltv: 86.0,
    vaults: ['Steakhouse USDT'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99',
    label: 'WBTC/USDT',
    loan: 'USDT',
    collateral: 'WBTC',
    lltv: 86.0,
    vaults: ['Steakhouse USDT'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0xb7843fe78e7e7fd3106a1b939645367967d1f986c2e45edb8932ad1896450877',
    label: 'XAUt/USDT',
    loan: 'USDT',
    collateral: 'XAUt',
    lltv: 77.0,
    vaults: ['Steakhouse USDT'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x3274643db77a064abd3bc851de77556a4ad2e2f502f4f0c80845fa8f909ecf0b',
    label: 'sUSDS/USDT',
    loan: 'USDT',
    collateral: 'sUSDS',
    lltv: 96.5,
    vaults: ['Steakhouse USDT'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x45671fb8d5dea1c4fbca0b8548ad742f6643300eeb8dbd34ad64a658b2b05bca',
    label: 'cbBTC/USDT',
    loan: 'USDT',
    collateral: 'cbBTC',
    lltv: 86.0,
    vaults: ['Steakhouse USDT'],
  },

  // --- Mainnet · Steakhouse ETH (V1) markets ---
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0xb8fc70e82bc5bb53e773626fcc6a23f7eefa036918d7ef216ecfb1950a94a85e',
    label: 'wstETH/WETH',
    loan: 'WETH',
    collateral: 'wstETH',
    lltv: 96.5,
    vaults: ['Steakhouse ETH'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0xd0e50cdac92fe2172043f5e0c36532c6369d24947e40968f34a5e8819ca9ec5d',
    label: 'wstETH/WETH',
    loan: 'WETH',
    collateral: 'wstETH',
    lltv: 94.5,
    vaults: ['Steakhouse ETH'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x138eec0e4a1937eb92ebc70043ed539661dd7ed5a89fb92a720b341650288a40',
    label: 'WBTC/WETH',
    loan: 'WETH',
    collateral: 'WBTC',
    lltv: 91.5,
    vaults: ['Steakhouse ETH'],
  },
  {
    chainId: 1,
    chainSlug: 'ethereum',
    chainLabel: 'Mainnet',
    marketId: '0x2cbfb38723a8d9a2ad1607015591a78cfe3a5949561b39bde42c242b22874ec0',
    label: 'cbBTC/WETH',
    loan: 'WETH',
    collateral: 'cbBTC',
    lltv: 91.5,
    vaults: ['Steakhouse ETH'],
  },

  // --- Base · blue-chip markets (TVL ≥ $3M only) ---
  {
    chainId: 8453,
    chainSlug: 'base',
    chainLabel: 'Base',
    marketId: '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836',
    label: 'cbBTC/USDC',
    loan: 'USDC',
    collateral: 'cbBTC',
    lltv: 86.0,
    vaults: ['Steakhouse USDC'],
  },
  {
    chainId: 8453,
    chainSlug: 'base',
    chainLabel: 'Base',
    marketId: '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda',
    label: 'WETH/USDC',
    loan: 'USDC',
    collateral: 'WETH',
    lltv: 86.0,
    vaults: ['Steakhouse USDC'],
  },

  // --- Arbitrum · blue-chip markets (USDT0 = LayerZero-bridged USDT) ---
  {
    chainId: 42161,
    chainSlug: 'arbitrum',
    chainLabel: 'Arbitrum',
    marketId: '0x33e0c8ab132390822b07e5dc95033cf250c963153320b7ffca73220664da2ea0',
    label: 'wstETH/USDC',
    loan: 'USDC',
    collateral: 'wstETH',
    lltv: 86.0,
    vaults: ['Arbitrum Prime tier'],
  },
  {
    chainId: 42161,
    chainSlug: 'arbitrum',
    chainLabel: 'Arbitrum',
    marketId: '0xe6392ff19d10454b099d692b58c361ef93e31af34ed1ef78232e07c78fe99169',
    label: 'WBTC/USDC',
    loan: 'USDC',
    collateral: 'WBTC',
    lltv: 86.0,
    vaults: ['Arbitrum Prime tier'],
  },
  {
    chainId: 42161,
    chainSlug: 'arbitrum',
    chainLabel: 'Arbitrum',
    marketId: '0xde895fd4a9d1ca693485fcfc2ee47d8c3b47f810bbce3c965c60d97b855d4ed2',
    label: 'sUSDS/USDT0',
    loan: 'USDT0',
    collateral: 'sUSDS',
    lltv: 94.5,
    vaults: ['Arbitrum Prime tier'],
  },

  // --- OP Mainnet · blue-chip Prime-tier markets ---
  {
    chainId: 10,
    chainSlug: 'opmainnet',
    chainLabel: 'OP',
    marketId: '0x8e77af0efaf4a3d59f37126c77f6f0ee7b56bcb1363c0986b8f6087b93ba833e',
    label: 'WBTC/USDC',
    loan: 'USDC',
    collateral: 'WBTC',
    lltv: 86.0,
    vaults: ['OP Prime tier'],
  },
];

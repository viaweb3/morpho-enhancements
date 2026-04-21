// Implements Morpho Blue's SharesMathLib off-chain.
// Ref: https://github.com/morpho-org/morpho-blue/blob/main/src/libraries/SharesMathLib.sol
// VIRTUAL_SHARES = 1e6, VIRTUAL_ASSETS = 1. mulDiv with +1 offset.

const VIRTUAL_SHARES = 1_000_000n;
const VIRTUAL_ASSETS = 1n;

// (x * y + d - 1) / d
function mulDivUp(x: bigint, y: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('mulDiv by zero');
  return (x * y + d - 1n) / d;
}

// (x * y) / d — floor
function mulDivDown(x: bigint, y: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('mulDiv by zero');
  return (x * y) / d;
}

export function toAssetsDown(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivDown(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
}

export function toAssetsUp(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
}

export function toSharesDown(
  assets: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivDown(assets, totalShares + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS);
}

export function toSharesUp(
  assets: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivUp(assets, totalShares + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS);
}

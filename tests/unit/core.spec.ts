import { expect, test } from '@playwright/test';
import { favoriteKey, parseFavoriteKey, parseHrefToKey } from '../../src/lib/favorites';
import { toAssetsDown, toAssetsUp, toSharesDown, toSharesUp } from '../../src/lib/sharesMath';
import { matchRoute } from '../../src/lib/url';
import { marketParamsToId, MorphoClient, type MarketParams } from '../../src/lib/morpho';
import { assertExpectedChain, isAllowedWalletRpcMethod } from '../../src/lib/walletRpcPolicy';
import { formatAmount, formatPercent, formatUsd, tryParseUnits } from '../../src/ui/format';
import { humanizeError } from '../../src/ui/errorMessage';

test('wallet RPC policy allows only the methods used by the extension', () => {
  expect(isAllowedWalletRpcMethod('eth_accounts')).toBe(true);
  expect(isAllowedWalletRpcMethod('eth_requestAccounts')).toBe(true);
  expect(isAllowedWalletRpcMethod('eth_chainId')).toBe(true);
  expect(isAllowedWalletRpcMethod('eth_sendTransaction')).toBe(true);
  expect(isAllowedWalletRpcMethod('personal_sign')).toBe(false);
  expect(isAllowedWalletRpcMethod('eth_signTypedData_v4')).toBe(false);
  expect(isAllowedWalletRpcMethod('wallet_switchEthereumChain')).toBe(false);
});

test('wallet chain mismatch is rejected', () => {
  expect(() => assertExpectedChain(1, 8453)).toThrow(/wrong wallet network/i);
  expect(() => assertExpectedChain(null, 1)).toThrow(/unable to read/i);
  expect(() => assertExpectedChain(8453, 8453)).not.toThrow();
});

test('routes reject malformed addresses and unsupported chains', () => {
  const marketId = `0x${'a'.repeat(64)}`;
  expect(matchRoute(`/base/variable/${marketId}/weth-usdc`)).toMatchObject({
    kind: 'market',
    chainSlug: 'base',
  });
  expect(matchRoute(`/unknown/variable/${marketId}/weth-usdc`)).toEqual({ kind: 'other' });
  expect(matchRoute('/portfolio/0x1234')).toEqual({ kind: 'other' });
  const account = `0x${'1'.repeat(40)}`;
  expect(matchRoute(`/portfolio/${account}`)).toEqual({ kind: 'dashboard', address: account });
  expect(matchRoute('/variable')).toEqual({ kind: 'markets-list' });
  expect(matchRoute('/vaults')).toEqual({ kind: 'vaults-list' });
  expect(matchRoute(`/base/market/${marketId}/weth-usdc`)).toEqual({ kind: 'other' });
  expect(matchRoute('/markets')).toEqual({ kind: 'other' });
  expect(matchRoute(`/dashboard/${account}`)).toEqual({ kind: 'other' });
  expect(matchRoute(`/base/variable/0x1234/weth-usdc`)).toEqual({ kind: 'other' });
});

test('favorite keys normalize IDs and reject malformed keys', () => {
  const marketId = `0x${'A'.repeat(64)}`;
  const key = favoriteKey('market', 'base', marketId);
  expect(key).toBe(`market:base:0x${'a'.repeat(64)}`);
  expect(parseFavoriteKey(key)).toEqual({
    kind: 'market',
    chainSlug: 'base',
    id: `0x${'a'.repeat(64)}`,
  });
  expect(parseHrefToKey(`/base/variable/${marketId}/weth-usdc`)).toBe(key);
  const vault = `0x${'B'.repeat(40)}`;
  expect(parseHrefToKey(`/ethereum/vault/${vault}/usdc`)).toBe(
    favoriteKey('vault', 'ethereum', vault),
  );
  expect(parseFavoriteKey('market:base:not-hex')).toBeNull();
  expect(parseFavoriteKey('market:base:0xabc123')).toBeNull();
  expect(parseHrefToKey(`/base/market/${marketId}/weth-usdc`)).toBeNull();
});

test('share math preserves conservative rounding', () => {
  const assets = toAssetsDown(1_000n, 10_000n, 5_000n);
  expect(assets).toBeGreaterThan(0n);
  expect(toSharesDown(assets, 10_000n, 5_000n)).toBeLessThanOrEqual(1_000n);
  expect(toAssetsDown(1n, 2n, 1n)).toBeLessThanOrEqual(toAssetsUp(1n, 2n, 1n));
  expect(toSharesDown(1n, 2n, 1n)).toBeLessThanOrEqual(toSharesUp(1n, 2n, 1n));
  expect(toAssetsDown(0n, 0n, 0n)).toBe(0n);
});

test('amount parser accepts decimals and rejects invalid values', () => {
  expect(tryParseUnits('1.25', 6)).toBe(1_250_000n);
  expect(tryParseUnits('-1', 6)).toBeNull();
  expect(tryParseUnits('1e3', 6)).toBeNull();
  expect(tryParseUnits('1.0000001', 6)).toBeNull();
  expect(tryParseUnits('.', 6)).toBeNull();
  expect(tryParseUnits(' 0.000001 ', 6)).toBe(1n);
});

test('formatters handle null, rounding, and non-finite values', () => {
  expect(formatAmount(1_234_567n, 6, 3)).toBe('1.234');
  expect(formatAmount(null, 6)).toBe('—');
  expect(formatUsd(0.001)).toBe('< $0.01');
  expect(formatUsd(Number.NaN)).toBe('—');
  expect(formatPercent(0.03456, 2)).toBe('3.46%');
});

test('wallet and viem errors are reduced to safe actionable messages', () => {
  expect(humanizeError({ code: 4001, message: 'User rejected' })).toEqual({
    message: 'Transaction cancelled.',
    silent: true,
  });
  expect(humanizeError(new Error('insufficient funds for gas'))).toMatchObject({
    message: /Insufficient funds/,
    silent: false,
  });
  const verbose = humanizeError({ message: `failure ${'x'.repeat(300)}` });
  expect(verbose.message.length).toBeLessThanOrEqual(160);
});

test('market parameters are bound to their deterministic market ID', async () => {
  const params: MarketParams = {
    loanToken: `0x${'1'.repeat(40)}`,
    collateralToken: `0x${'2'.repeat(40)}`,
    oracle: `0x${'3'.repeat(40)}`,
    irm: `0x${'4'.repeat(40)}`,
    lltv: 860_000_000_000_000_000n,
  };
  const expectedId = marketParamsToId(params);
  const client = new MorphoClient('base');
  Object.defineProperty(client, 'publicClient', {
    value: { readContract: async () => params },
  });
  await expect(client.idToMarketParams(expectedId)).resolves.toEqual(params);
  await expect(client.idToMarketParams(`0x${'f'.repeat(64)}`)).rejects.toThrow(/do not match/i);
});

test('native gas reserve scales with current gas price', async () => {
  const client = new MorphoClient('base');
  Object.defineProperty(client, 'publicClient', {
    value: { getGasPrice: async () => 2_000_000_000n },
  });
  await expect(client.nativeGasReserve()).resolves.toBe(700_000_000_000_000n);
});

test('transaction receipts must report success', async () => {
  const hash = `0x${'1'.repeat(64)}` as const;
  const client = new MorphoClient('base');
  Object.defineProperty(client, 'publicClient', {
    value: { waitForTransactionReceipt: async () => ({ status: 'reverted' }) },
  });
  await expect(client.waitForSuccessfulTransaction(hash)).rejects.toThrow(/reverted/i);

  Object.defineProperty(client, 'publicClient', {
    value: { waitForTransactionReceipt: async () => ({ status: 'success' }) },
  });
  await expect(client.waitForSuccessfulTransaction(hash)).resolves.toBeUndefined();
});

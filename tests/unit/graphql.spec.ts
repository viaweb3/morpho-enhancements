import { expect, test } from '@playwright/test';
import {
  clearPopupCaches,
  fetchMarketById,
  fetchMarketsBatch,
  fetchUserMarketPositions,
  type ApiMarket,
} from '../../src/lib/graphql';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearPopupCaches();
});

test('dashboard positions are fetched through all pages', async () => {
  const requests: number[] = [];
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: { skip: number };
    };
    expect(body.query).toContain('supplyShares_gte: "1"');
    requests.push(body.variables.skip);
    const count = body.variables.skip === 0 ? 100 : 2;
    const items = Array.from({ length: count }, (_, index) => ({
      state: {
        supplyShares: String(index + 1),
        supplyAssets: '0',
        supplyAssetsUsd: 0,
        borrowShares: '0',
        borrowAssets: '0',
        borrowAssetsUsd: 0,
        collateral: '0',
        collateralUsd: 0,
      },
      market: {
        marketId: `0x${String(index).padStart(64, '0')}`,
        lltv: '860000000000000000',
        loanAsset: {
          address: `0x${'1'.repeat(40)}`,
          symbol: 'USDC',
          decimals: 6,
          logoURI: null,
        },
        collateralAsset: null,
        state: null,
        morphoBlue: { chain: { id: 1 } },
      },
    }));
    return new Response(JSON.stringify({ data: { marketPositions: { items } } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const positions = await fetchUserMarketPositions(`0x${'1'.repeat(40)}`, [1, 8453]);
  expect(positions).toHaveLength(102);
  expect(positions[0]).toMatchObject({
    supplyShares: '1',
    supplyAssets: '0',
    supplyAssetsUsd: 0,
    borrowShares: '0',
    market: { marketId: `0x${'0'.repeat(64)}` },
  });
  expect(requests).toEqual([0, 100]);
});

test('popup markets on the same chain use one GraphQL request', async () => {
  let requestCount = 0;
  const market = (marketId: string): ApiMarket => ({
    marketId,
    lltv: '860000000000000000',
    loanAsset: { address: `0x${'1'.repeat(40)}`, symbol: 'USDC', decimals: 6, logoURI: null },
    collateralAsset: null,
    state: {
      supplyApy: 0.05,
      borrowApy: 0.07,
      supplyAssets: '1000000',
      supplyAssetsUsd: 1,
      borrowAssets: '0',
      utilization: 0,
    },
  });
  globalThis.fetch = (async (_input, init) => {
    requestCount += 1;
    const body = JSON.parse(String(init?.body)) as { variables: Record<string, string> };
    return new Response(JSON.stringify({
      data: {
        market0: market(body.variables.marketId0),
        market1: market(body.variables.marketId1),
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const refs = [
    { chainId: 1, marketId: `0x${'a'.repeat(64)}` },
    { chainId: 1, marketId: `0x${'b'.repeat(64)}` },
  ];
  const result = await fetchMarketsBatch(refs);
  expect(requestCount).toBe(1);
  expect(result.map((item) => item.market?.marketId)).toEqual(refs.map((item) => item.marketId));
});

test('popup market batches split by chain, deduplicate network fields, and preserve order', async () => {
  const requests: Array<{ chainId: number; fieldCount: number }> = [];
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string | number>;
    };
    const ids = Object.entries(body.variables)
      .filter(([key]) => key.startsWith('marketId'))
      .map(([, value]) => String(value));
    requests.push({
      chainId: Number(body.variables.chainId),
      fieldCount: (body.query.match(/market\d+:/g) ?? []).length,
    });
    const data = Object.fromEntries(ids.map((id, index) => [`market${index}`, {
      marketId: id,
      lltv: '0',
      loanAsset: { address: `0x${'1'.repeat(40)}`, symbol: 'USDC', decimals: 6, logoURI: null },
      collateralAsset: null,
      state: null,
    }]));
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const first = `0x${'a'.repeat(64)}`;
  const second = `0x${'b'.repeat(64)}`;
  const refs = [
    { chainId: 1, marketId: first },
    { chainId: 8453, marketId: second },
    { chainId: 1, marketId: first },
  ];
  const result = await fetchMarketsBatch(refs);
  expect(requests).toHaveLength(2);
  expect(requests).toEqual(expect.arrayContaining([
    { chainId: 1, fieldCount: 1 },
    { chainId: 8453, fieldCount: 1 },
  ]));
  expect(result.map(({ market }) => market?.marketId)).toEqual([first, second, first]);
});

test('GraphQL HTTP and schema errors are surfaced', async () => {
  globalThis.fetch = (async (input) => {
    expect(String(input)).toBe('https://api.morpho.org/graphql');
    return new Response('unavailable', { status: 503 });
  }) as typeof fetch;
  await expect(fetchMarketById(`0x${'a'.repeat(64)}`, 1)).rejects.toThrow('GraphQL HTTP 503');

  globalThis.fetch = (async () => new Response(JSON.stringify({
    errors: [{ message: 'field removed' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  await expect(fetchMarketById(`0x${'a'.repeat(64)}`, 1)).rejects.toThrow(/field removed/);
});

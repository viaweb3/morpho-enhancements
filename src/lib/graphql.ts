// Thin GraphQL client for blue-api.morpho.org.
// We use plain fetch to keep the content-script bundle small.

const ENDPOINT = 'https://blue-api.morpho.org/graphql';

type GraphQLError = { message: string };

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: T; errors?: GraphQLError[] };
  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) throw new Error('GraphQL returned no data');
  return json.data;
}

// --- Queries ---

const MARKET_BY_ID = `
  query MarketById($marketId: String!, $chainId: Int!) {
    marketByUniqueKey(uniqueKey: $marketId, chainId: $chainId) {
      uniqueKey
      lltv
      loanAsset { address symbol decimals }
      collateralAsset { address symbol decimals }
      state {
        supplyApy
        borrowApy
        supplyAssets
        supplyAssetsUsd
        borrowAssets
        utilization
      }
    }
  }
`;

const USER_MARKET_POSITIONS = `
  query UserMarketPositions($user: String!, $chainIds: [Int!]!) {
    marketPositions(
      first: 100
      where: { userAddress_in: [$user], chainId_in: $chainIds }
    ) {
      items {
        supplyShares
        supplyAssets
        supplyAssetsUsd
        borrowShares
        borrowAssets
        borrowAssetsUsd
        collateral
        collateralUsd
        market {
          uniqueKey
          lltv
          loanAsset { address symbol decimals }
          collateralAsset { address symbol decimals }
          state { supplyApy borrowApy }
          morphoBlue { chain { id } }
        }
      }
    }
  }
`;

export type ApiAsset = {
  address: string;
  symbol: string;
  decimals: number;
};

export type ApiMarket = {
  uniqueKey: string;
  lltv: string;
  loanAsset: ApiAsset;
  collateralAsset: ApiAsset | null;
  state: {
    supplyApy: number;
    borrowApy: number;
    supplyAssets: string;
    supplyAssetsUsd: number;
    borrowAssets: string;
    utilization: number;
  } | null;
};

export type ApiMarketPosition = {
  supplyShares: string;
  supplyAssets: string;
  supplyAssetsUsd: number;
  borrowShares: string;
  borrowAssets: string;
  borrowAssetsUsd: number;
  collateral: string;
  collateralUsd: number;
  market: {
    uniqueKey: string;
    lltv: string;
    loanAsset: ApiAsset;
    collateralAsset: ApiAsset | null;
    state: { supplyApy: number; borrowApy: number } | null;
    morphoBlue?: { chain: { id: number } };
  };
};

export async function fetchMarketById(
  marketId: string,
  chainId: number,
): Promise<ApiMarket | null> {
  const data = await request<{ marketByUniqueKey: ApiMarket | null }>(MARKET_BY_ID, {
    marketId,
    chainId,
  });
  return data.marketByUniqueKey;
}

export async function fetchUserMarketPositions(
  user: string,
  chainIds: number | readonly number[],
): Promise<ApiMarketPosition[]> {
  // blue-api requires lowercase addresses — EIP-55 checksum fails validation.
  const ids = Array.isArray(chainIds) ? chainIds : [chainIds];
  const data = await request<{
    marketPositions: { items: ApiMarketPosition[] } | null;
  }>(USER_MARKET_POSITIONS, {
    user: user.toLowerCase(),
    chainIds: ids,
  });
  return data.marketPositions?.items ?? [];
}

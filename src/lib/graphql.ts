// Thin GraphQL client for api.morpho.org.
// We use plain fetch to keep the content-script bundle small.

const ENDPOINT = 'https://api.morpho.org/graphql';

type GraphQLError = { message: string };
type GraphQLWarning = {
  type?: string;
  field?: string;
  path?: string;
  message?: string;
  replacement?: string;
  deprecatedAt?: string;
  removalAt?: string;
};

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: T;
    errors?: GraphQLError[];
    extensions?: { warnings?: GraphQLWarning[] };
  };
  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (json.extensions?.warnings?.length) {
    console.warn('[morpho-ext] Morpho API warnings', json.extensions.warnings);
  }
  if (!json.data) throw new Error('GraphQL returned no data');
  return json.data;
}

// --- Queries ---

const MARKET_BY_ID = `
  query MarketById($marketId: String!, $chainId: Int!) {
    marketById(marketId: $marketId, chainId: $chainId) {
      marketId
      lltv
      loanAsset { address symbol decimals logoURI }
      collateralAsset { address symbol decimals logoURI }
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
  query UserMarketPositions($user: String!, $chainIds: [Int!]!, $skip: Int!) {
    marketPositions(
      first: 100
      skip: $skip
      where: { userAddress_in: [$user], chainId_in: $chainIds, supplyShares_gte: "1" }
    ) {
      items {
        state {
          supplyShares
          supplyAssets
          supplyAssetsUsd
          borrowShares
          borrowAssets
          borrowAssetsUsd
          collateral
          collateralUsd
        }
        market {
          marketId
          lltv
          loanAsset { address symbol decimals logoURI }
          collateralAsset { address symbol decimals logoURI }
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
  logoURI: string | null;
};

export type ApiMarket = {
  marketId: string;
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
    marketId: string;
    lltv: string;
    loanAsset: ApiAsset;
    collateralAsset: ApiAsset | null;
    state: { supplyApy: number; borrowApy: number } | null;
    morphoBlue?: { chain: { id: number } };
  };
};

type BigIntish = string | number | bigint | null | undefined;

type RawApiMarket = Omit<ApiMarket, 'marketId'> & {
  marketId?: string;
  uniqueKey?: string;
};

type RawApiMarketPosition = Partial<Omit<ApiMarketPosition, 'market'>> & {
  state?: Partial<Omit<ApiMarketPosition, 'market'>> | null;
  market: Omit<ApiMarketPosition['market'], 'marketId'> & {
    marketId?: string;
    uniqueKey?: string;
  };
};

function bigintishToString(value: BigIntish): string {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function nullableNumber(value: number | null | undefined): number {
  return value ?? 0;
}

function marketIdFromRaw(market: { marketId?: string; uniqueKey?: string }): string {
  return market.marketId ?? market.uniqueKey ?? '';
}

function normalizeMarket(market: RawApiMarket): ApiMarket {
  const { uniqueKey: _oldUniqueKey, ...rest } = market;
  return {
    ...rest,
    marketId: marketIdFromRaw(market),
  };
}

function normalizeMarketPosition(p: RawApiMarketPosition): ApiMarketPosition {
  // Morpho API moved position amounts under `state` in May 2026. Keep support
  // for the old flat shape so older fixtures remain valid.
  const state = p.state ?? p;
  const { uniqueKey: _oldUniqueKey, ...market } = p.market;
  return {
    supplyShares: bigintishToString(state.supplyShares),
    supplyAssets: bigintishToString(state.supplyAssets),
    supplyAssetsUsd: nullableNumber(state.supplyAssetsUsd),
    borrowShares: bigintishToString(state.borrowShares),
    borrowAssets: bigintishToString(state.borrowAssets),
    borrowAssetsUsd: nullableNumber(state.borrowAssetsUsd),
    collateral: bigintishToString(state.collateral),
    collateralUsd: nullableNumber(state.collateralUsd),
    market: {
      ...market,
      marketId: marketIdFromRaw(p.market),
    },
  };
}
export async function fetchMarketById(
  marketId: string,
  chainId: number,
): Promise<ApiMarket | null> {
  const data = await request<{ marketById: RawApiMarket | null }>(MARKET_BY_ID, {
    marketId,
    chainId,
  });
  return data.marketById ? normalizeMarket(data.marketById) : null;
}

export async function fetchUserMarketPositions(
  user: string,
  chainIds: number | readonly number[],
): Promise<ApiMarketPosition[]> {
  // Morpho API requires lowercase addresses — EIP-55 checksum fails validation.
  const ids = Array.isArray(chainIds) ? chainIds : [chainIds];
  const positions: ApiMarketPosition[] = [];
  for (let skip = 0; skip < 10_000; skip += 100) {
    const data = await request<{
      marketPositions: { items: RawApiMarketPosition[] } | null;
    }>(USER_MARKET_POSITIONS, {
      user: user.toLowerCase(),
      chainIds: ids,
      skip,
    });
    const items = data.marketPositions?.items ?? [];
    positions.push(...items.map(normalizeMarketPosition));
    if (items.length < 100) return positions;
  }
  throw new Error('Position query exceeded the 10,000-item safety limit');
}

// --- Batch fetch (used by the toolbar popup) ---

export interface MarketRef {
  marketId: string;
  chainId: number;
}

export interface MarketBatchResult {
  ref: MarketRef;
  market: ApiMarket | null;
  error?: string;
}

// Two-tier cache:
//   1. In-memory (this map) keeps results across rapid re-opens within
//      the same popup session. Entries younger than FRESH_TTL_MS are
//      treated as fresh and short-circuit the network.
//   2. chrome.storage.local persists the same entries across popup
//      open/close cycles so first paint is instant. Hydrated into the
//      memory map at module init via `cacheReady`.
const FRESH_TTL_MS = 5 * 60 * 1000; // 5 min — markets don't drift that fast
const PERSIST_KEY = 'morpho-ext:popup-cache';
const PERSIST_VERSION = 2;

interface CacheEntry<T> {
  at: number;
  data: T | null;
}

const marketCache = new Map<string, CacheEntry<ApiMarket>>();
const vaultCache = new Map<string, CacheEntry<ApiVault>>();
// In-flight requests so concurrent fetches for the same key share one round-trip.
const marketInflight = new Map<string, Promise<ApiMarket | null>>();
const vaultInflight = new Map<string, Promise<ApiVault | null>>();

function marketCacheKey(ref: MarketRef): string {
  return `${ref.chainId}:${ref.marketId.toLowerCase()}`;
}

function vaultCacheKey(ref: VaultRef): string {
  return `${ref.chainId}:${ref.address.toLowerCase()}`;
}

interface PersistedShape {
  version?: number;
  markets: Record<string, CacheEntry<ApiMarket>>;
  vaults: Record<string, CacheEntry<ApiVault>>;
}

async function loadPersistedCache(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    const result = await chrome.storage.local.get(PERSIST_KEY);
    const raw = result[PERSIST_KEY] as PersistedShape | undefined;
    if (!raw) return;
    if (raw.version !== PERSIST_VERSION) {
      await chrome.storage.local.remove(PERSIST_KEY);
      return;
    }
    for (const [k, v] of Object.entries(raw.markets ?? {})) {
      if (v && typeof v.at === 'number') marketCache.set(k, v);
    }
    for (const [k, v] of Object.entries(raw.vaults ?? {})) {
      if (v && typeof v.at === 'number') vaultCache.set(k, v);
    }
  } catch {
    // Cache is best-effort — proceed with empty memory.
  }
}

export const cacheReady: Promise<void> = loadPersistedCache();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  if (persistTimer) return;
  // Coalesce rapid fetches into a single write.
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const payload: PersistedShape = {
      version: PERSIST_VERSION,
      markets: Object.fromEntries(marketCache),
      vaults: Object.fromEntries(vaultCache),
    };
    void chrome.storage.local.set({ [PERSIST_KEY]: payload }).catch(() => {});
  }, 200);
}

/** Synchronous read of whatever is currently cached, regardless of age.
 *  Returns null if the entry hasn't been seen this profile-lifetime. */
export function readMarketCache(ref: MarketRef): ApiMarket | null | undefined {
  const hit = marketCache.get(marketCacheKey(ref));
  return hit?.data;
}

export function readVaultCache(ref: VaultRef): ApiVault | null | undefined {
  const hit = vaultCache.get(vaultCacheKey(ref));
  return hit?.data;
}

/** Returns true if every requested ref already has a memory entry,
 *  fresh or stale. The popup uses this to decide whether to skip the
 *  loading skeleton on first paint. */
export function hasCachedMarkets(refs: readonly MarketRef[]): boolean {
  return refs.every((r) => marketCache.has(marketCacheKey(r)));
}

export function hasCachedVaults(refs: readonly VaultRef[]): boolean {
  return refs.every((r) => vaultCache.has(vaultCacheKey(r)));
}

export function fetchMarketByIdCached(ref: MarketRef): Promise<ApiMarket | null> {
  const key = marketCacheKey(ref);
  const hit = marketCache.get(key);
  if (hit && Date.now() - hit.at < FRESH_TTL_MS) {
    return Promise.resolve(hit.data);
  }
  const inflight = marketInflight.get(key);
  if (inflight) return inflight;
  const promise = fetchMarketById(ref.marketId, ref.chainId)
    .then((data) => {
      marketCache.set(key, { at: Date.now(), data });
      schedulePersist();
      marketInflight.delete(key);
      return data;
    })
    .catch((e) => {
      marketInflight.delete(key);
      throw e;
    });
  marketInflight.set(key, promise);
  return promise;
}

export async function fetchMarketsBatch(
  refs: readonly MarketRef[],
): Promise<MarketBatchResult[]> {
  const results = new Map<string, { market: ApiMarket | null; error?: string }>();
  const stale: MarketRef[] = [];
  const now = Date.now();

  for (const ref of refs) {
    const key = marketCacheKey(ref);
    const hit = marketCache.get(key);
    if (hit && now - hit.at < FRESH_TTL_MS) results.set(key, { market: hit.data });
    else stale.push(ref);
  }

  const groups = new Map<number, MarketRef[]>();
  for (const ref of stale) {
    const group = groups.get(ref.chainId) ?? [];
    if (!group.some((item) => marketCacheKey(item) === marketCacheKey(ref))) group.push(ref);
    groups.set(ref.chainId, group);
  }

  await Promise.all(
    [...groups.entries()].map(async ([chainId, group]) => {
      try {
        const fetched = await fetchMarketsForChain(chainId, group);
        for (const ref of group) {
          const key = marketCacheKey(ref);
          const market = fetched.get(key) ?? null;
          marketCache.set(key, { at: Date.now(), data: market });
          results.set(key, { market });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        for (const ref of group) {
          const key = marketCacheKey(ref);
          results.set(key, { market: marketCache.get(key)?.data ?? null, error: message });
        }
      }
    }),
  );
  if (stale.length > 0) schedulePersist();

  return refs.map((ref) => ({ ref, ...(results.get(marketCacheKey(ref)) ?? { market: null }) }));
}

async function fetchMarketsForChain(
  chainId: number,
  refs: readonly MarketRef[],
): Promise<Map<string, ApiMarket | null>> {
  if (refs.length === 0) return new Map();
  const declarations = ['$chainId: Int!'];
  const fields: string[] = [];
  const variables: Record<string, unknown> = { chainId };
  refs.forEach((ref, index) => {
    const variable = `marketId${index}`;
    declarations.push(`$${variable}: String!`);
    variables[variable] = ref.marketId;
    fields.push(`
      market${index}: marketById(marketId: $${variable}, chainId: $chainId) {
        marketId
        lltv
        loanAsset { address symbol decimals logoURI }
        collateralAsset { address symbol decimals logoURI }
        state { supplyApy borrowApy supplyAssets supplyAssetsUsd borrowAssets utilization }
      }
    `);
  });
  const query = `query MarketsBatch(${declarations.join(', ')}) { ${fields.join('\n')} }`;
  const data = await request<Record<string, RawApiMarket | null>>(query, variables);
  const result = new Map<string, ApiMarket | null>();
  refs.forEach((ref, index) => {
    const market = data[`market${index}`];
    result.set(marketCacheKey(ref), market ? normalizeMarket(market) : null);
  });
  return result;
}

// --- Vault query (used by the popup's Favorites tab) ---

// Morpho API exposes V1 vaults under `vaultByAddress` and V2 vaults under
// `vaultV2ByAddress`. Favorite URLs don't disambiguate. We can't combine
// both in one request: the server raises a hard `NOT_FOUND` GraphQL
// error when either resolver misses, which voids the entire response
// (sister alias data included). So we issue them as two independent
// requests and use whichever returns data.
const VAULT_V1_BY_ADDRESS = `
  query VaultV1ByAddress($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset { address symbol decimals logoURI }
      state {
        netApy
        totalAssets
        totalAssetsUsd
      }
    }
  }
`;

const VAULT_V2_BY_ADDRESS = `
  query VaultV2ByAddress($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset { address symbol decimals logoURI }
      netApy
      totalAssets
      totalAssetsUsd
    }
  }
`;

export interface ApiVault {
  address: string;
  name: string;
  symbol: string;
  asset: ApiAsset;
  /** Vault ABI generation — informational, helpful in the UI. */
  version: 'v1' | 'v2';
  state: {
    netApy: number;
    totalAssets: string;
    totalAssetsUsd: number;
  } | null;
}

interface RawV1Vault {
  address: string;
  name: string;
  symbol: string;
  asset: ApiAsset;
  state: {
    netApy: number;
    totalAssets: string;
    totalAssetsUsd: number;
  } | null;
}

interface RawV2Vault {
  address: string;
  name: string;
  symbol: string;
  asset: ApiAsset;
  netApy: number | null;
  totalAssets: string | null;
  totalAssetsUsd: number | null;
}

export interface VaultRef {
  address: string;
  chainId: number;
}

export interface VaultBatchResult {
  ref: VaultRef;
  vault: ApiVault | null;
  error?: string;
}


export async function fetchVaultByAddress(
  address: string,
  chainId: number,
): Promise<ApiVault | null> {
  const variables = { address: address.toLowerCase(), chainId };
  // Issue both lookups in parallel. Either resolver may throw NOT_FOUND
  // — that's expected (the address is V1 xor V2, never both) — so a
  // rejected promise gets swallowed into `null`.
  const [v1, v2] = await Promise.all([
    request<{ vaultByAddress: RawV1Vault | null }>(VAULT_V1_BY_ADDRESS, variables)
      .then((d) => d.vaultByAddress)
      .catch(() => null),
    request<{ vaultV2ByAddress: RawV2Vault | null }>(VAULT_V2_BY_ADDRESS, variables)
      .then((d) => d.vaultV2ByAddress)
      .catch(() => null),
  ]);
  if (v1) {
    return { ...v1, version: 'v1' };
  }
  if (v2) {
    const { netApy, totalAssets, totalAssetsUsd, ...rest } = v2;
    return {
      ...rest,
      version: 'v2',
      state:
        netApy === null || totalAssets === null || totalAssetsUsd === null
          ? null
          : { netApy, totalAssets, totalAssetsUsd },
    };
  }
  return null;
}

export function fetchVaultByAddressCached(ref: VaultRef): Promise<ApiVault | null> {
  const key = vaultCacheKey(ref);
  const hit = vaultCache.get(key);
  if (hit && Date.now() - hit.at < FRESH_TTL_MS) {
    return Promise.resolve(hit.data);
  }
  const inflight = vaultInflight.get(key);
  if (inflight) return inflight;
  const promise = fetchVaultByAddress(ref.address, ref.chainId)
    .then((data) => {
      vaultCache.set(key, { at: Date.now(), data });
      schedulePersist();
      vaultInflight.delete(key);
      return data;
    })
    .catch((e) => {
      vaultInflight.delete(key);
      throw e;
    });
  vaultInflight.set(key, promise);
  return promise;
}

export async function fetchVaultsBatch(
  refs: readonly VaultRef[],
): Promise<VaultBatchResult[]> {
  return Promise.all(
    refs.map(async (ref) => {
      try {
        const vault = await fetchVaultByAddressCached(ref);
        return { ref, vault };
      } catch (e: unknown) {
        return {
          ref,
          vault: null,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );
}

// Used by the popup's refresh button. Wipes memory + persisted cache so
// the next fetch always hits the API.
export function clearPopupCaches(): void {
  marketCache.clear();
  vaultCache.clear();
  marketInflight.clear();
  vaultInflight.clear();
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    void chrome.storage.local.remove(PERSIST_KEY).catch(() => {});
  }
}

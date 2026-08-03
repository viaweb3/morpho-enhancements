import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { CURATED_MARKETS, type CuratedMarket } from '@/data/curatedMarkets';
import { TokenPair, TokenIcon } from './TokenIcon';
import {
  getAllFavoriteKeys,
  getFavoritesCount,
  onFavoritesChange,
  parseFavoriteKey,
  ready as favoritesReady,
} from '@/lib/favorites';
import {
  cacheReady,
  clearPopupCaches,
  fetchMarketsBatch,
  fetchVaultsBatch,
  hasCachedMarkets,
  hasCachedVaults,
  readMarketCache,
  readVaultCache,
  type ApiMarket,
  type ApiVault,
  type MarketBatchResult,
  type MarketRef,
  type VaultBatchResult,
  type VaultRef,
} from '@/lib/graphql';
import { chainIdFromSlug, type SupportedChainSlug } from '@/lib/chains';
import { formatPercent } from '@/ui/format';

type Tab = 'prime' | 'favorites';
type SortMode = 'default' | 'apy' | 'tvl';

const CHAIN_LABEL: Record<SupportedChainSlug, string> = {
  ethereum: 'Mainnet',
  base: 'Base',
  arbitrum: 'Arbitrum',
  opmainnet: 'OP',
  polygon: 'Polygon',
  unichain: 'Unichain',
  monad: 'Monad',
  'world-chain': 'World',
  katana: 'Katana',
  hyperevm: 'HyperEVM',
};

// Authentic per-chain brand colors. Mirrored as CSS custom properties
// applied per chip — semi-transparent fill, full-strength foreground.
const CHAIN_COLOR: Record<SupportedChainSlug, string> = {
  ethereum: '#627eea',
  base: '#0052ff',
  arbitrum: '#28a0f0',
  opmainnet: '#ff0420',
  polygon: '#7b3fe4',
  unichain: '#f50db4',
  monad: '#836ef9',
  'world-chain': '#1f2937',
  katana: '#e64e2a',
  hyperevm: '#00c896',
};

function chainChipStyle(slug: string): CSSProperties {
  const color = CHAIN_COLOR[slug as SupportedChainSlug] ?? '#6b7280';
  return {
    ['--chain-fg' as string]: color,
    ['--chain-glow' as string]: hexToRgba(color, 0.22),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (!m) return `rgba(99,102,241,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

function marketUrl(slug: string, marketId: string): string {
  return `https://app.morpho.org/${slug}/variable/${marketId}`;
}

function vaultUrl(slug: string, address: string): string {
  return `https://app.morpho.org/${slug}/vault/${address.toLowerCase()}`;
}

function openInNewTab(url: string): void {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function Popup() {
  const [tab, setTab] = useState<Tab>('prime');
  const [sort, setSort] = useState<SortMode>('default');
  const [favCount, setFavCount] = useState<number>(0);
  const [favReady, setFavReady] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Hydrate favorites count once chrome.storage finishes loading, then
  // keep it in sync with cross-tab edits.
  useEffect(() => {
    let cancelled = false;
    void favoritesReady.then(() => {
      if (cancelled) return;
      setFavReady(true);
      setFavCount(getFavoritesCount());
    });
    const unsub = onFavoritesChange(() => {
      setFavCount(getFavoritesCount());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    clearPopupCaches();
    setRefreshTick((n) => n + 1);
  }, []);

  return (
    <>
      <header className="p-banner">
        <div className="p-banner-row">
          <div className="p-brand">
            <img className="p-brand-logo" src="/logo.svg" alt="" aria-hidden="true" />
            <span className="p-brand-title">Morpho Enhancements</span>
          </div>
          <RefreshButton onClick={handleRefresh} />
        </div>
      </header>

      <nav className="p-tabs" role="tablist">
        <button
          className="p-tab"
          role="tab"
          aria-selected={tab === 'prime'}
          data-active={tab === 'prime'}
          onClick={() => setTab('prime')}
        >
          Prime
          <span className="p-tab-count">{CURATED_MARKETS.length}</span>
        </button>
        <button
          className="p-tab"
          role="tab"
          aria-selected={tab === 'favorites'}
          data-active={tab === 'favorites'}
          onClick={() => setTab('favorites')}
        >
          Favorites
          {favReady && <span className="p-tab-count">{favCount}</span>}
        </button>
      </nav>

      <SortBar sort={sort} onChange={setSort} />

      <div className="p-list" key={tab + ':' + refreshTick}>
        {tab === 'prime' ? (
          <CuratedList sort={sort} />
        ) : (
          <FavoritesList ready={favReady} sort={sort} />
        )}
      </div>

      <footer className="p-footer">
        <span className="p-footer-left">
          <span className="p-footer-dot" aria-hidden="true" />
          live · blue-api.morpho.org
        </span>
        <a
          href="https://github.com/viaweb3/morpho-enhancements"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
      </footer>
    </>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const handle = () => {
    setSpinning(true);
    onClick();
    setTimeout(() => setSpinning(false), 600);
  };
  return (
    <button
      type="button"
      className="p-refresh"
      onClick={handle}
      data-loading={spinning}
      title="Refresh"
      aria-label="Refresh data"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}

// --- Sort bar -------------------------------------------------------------

function SortBar({
  sort,
  onChange,
}: {
  sort: SortMode;
  onChange: (s: SortMode) => void;
}) {
  return (
    <div className="p-sortbar">
      <span className="p-sortbar-label">Sort</span>
      <div className="p-sortgroup" role="group" aria-label="Sort by">
        <SortBtn current={sort} value="default" onClick={onChange}>
          Default
        </SortBtn>
        <SortBtn current={sort} value="apy" onClick={onChange}>
          APY <span className="p-sortbtn-arrow" aria-hidden="true">↓</span>
        </SortBtn>
        <SortBtn current={sort} value="tvl" onClick={onChange}>
          TVL <span className="p-sortbtn-arrow" aria-hidden="true">↓</span>
        </SortBtn>
      </div>
    </div>
  );
}

function SortBtn({
  current,
  value,
  onClick,
  children,
}: {
  current: SortMode;
  value: SortMode;
  onClick: (s: SortMode) => void;
  children: ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      className="p-sortbtn"
      data-active={active}
      aria-pressed={active}
      onClick={() => onClick(value)}
    >
      {children}
    </button>
  );
}

// --- Curated tab ----------------------------------------------------------

function CuratedList({ sort }: { sort: SortMode }) {
  const refs = useMemo<MarketRef[]>(
    () =>
      CURATED_MARKETS.map((m) => ({
        marketId: m.marketId,
        chainId: m.chainId,
      })),
    [],
  );
  const { data, loading, error } = useMarketsBatch(refs);

  const sorted = useMemo(() => {
    if (sort === 'default') return CURATED_MARKETS;
    return [...CURATED_MARKETS].sort((a, b) => {
      const av = sortMetric(findLiveMarket(data, a.marketId, a.chainId), sort);
      const bv = sortMetric(findLiveMarket(data, b.marketId, b.chainId), sort);
      return bv - av; // descending
    });
  }, [data, sort]);

  if (error) return <div className="p-error">Failed to load: {error}</div>;
  if (loading) return <SkeletonList n={6} />;

  return (
    <>
      {sorted.map((m) => {
        const live = findLiveMarket(data, m.marketId, m.chainId);
        return (
          <CuratedRow key={`${m.chainId}:${m.marketId}`} curated={m} live={live} />
        );
      })}
    </>
  );
}

function sortMetric(market: ApiMarket | null, sort: SortMode): number {
  if (!market?.state) return -Infinity;
  if (sort === 'apy') return market.state.supplyApy ?? -Infinity;
  if (sort === 'tvl') return market.state.supplyAssetsUsd ?? -Infinity;
  return 0;
}

function findLiveMarket(
  results: MarketBatchResult[] | null,
  marketId: string,
  chainId: number,
): ApiMarket | null {
  if (!results) return null;
  const hit = results.find(
    (r) =>
      r.ref.chainId === chainId &&
      r.ref.marketId.toLowerCase() === marketId.toLowerCase(),
  );
  return hit?.market ?? null;
}

function CuratedRow({
  curated,
  live,
}: {
  curated: CuratedMarket;
  live: ApiMarket | null;
}) {
  const supplyApy = live?.state?.supplyApy;
  const utilization = live?.state?.utilization;
  const tvl = live?.state?.supplyAssetsUsd;
  return (
    <button
      type="button"
      className="p-row"
      onClick={() => openInNewTab(marketUrl(curated.chainSlug, curated.marketId))}
      title={`Open ${curated.label} on ${curated.chainLabel}`}
    >
      <div className="p-row-top">
        <span className="p-pair">
          <TokenPair
            collateralLogoURI={live?.collateralAsset?.logoURI}
            collateralSymbol={curated.collateral}
            loanLogoURI={live?.loanAsset.logoURI}
            loanSymbol={curated.loan}
          />
          {curated.label}
          <span className="p-pair-arrow" aria-hidden="true">↗</span>
        </span>
        <span className="p-chain-chip" style={chainChipStyle(curated.chainSlug)}>
          {curated.chainLabel}
        </span>
      </div>
      <div className="p-row-stats">
        <span className="p-stat-apy">
          Supply <strong>{formatPercent(supplyApy)}</strong>
        </span>
        <span>
          TVL <strong>{formatUsdCompact(tvl)}</strong>
        </span>
        <span>
          util <strong>{formatPercent(utilization)}</strong>
        </span>
        <span>
          LLTV <strong>{curated.lltv.toFixed(1)}%</strong>
        </span>
      </div>
    </button>
  );
}

// --- Favorites tab --------------------------------------------------------

interface FavMarket {
  kind: 'market';
  key: string;
  chainSlug: string;
  marketId: string;
}
interface FavVault {
  kind: 'vault';
  key: string;
  chainSlug: string;
  address: string;
}
type FavItem = FavMarket | FavVault;

function FavoritesList({ ready, sort }: { ready: boolean; sort: SortMode }) {
  const [items, setItems] = useState<FavItem[]>([]);

  useEffect(() => {
    if (!ready) return;
    const refresh = () => setItems(parseFavorites());
    refresh();
    return onFavoritesChange(refresh);
  }, [ready]);

  if (!ready) return <SkeletonList n={3} />;

  if (items.length === 0) {
    return (
      <div className="p-empty">
        <span className="p-empty-icon" aria-hidden="true">★</span>
        <strong>No favorites yet</strong>
        Open <code>/variable</code> or <code>/vaults</code> on app.morpho.org and
        tap the star on any row to pin it here.
      </div>
    );
  }

  const marketRefs = items
    .filter((i): i is FavMarket => i.kind === 'market')
    .map((i) => ({
      marketId: i.marketId,
      chainId: chainIdFromSlugSafe(i.chainSlug),
    }))
    .filter((r): r is MarketRef => r.chainId > 0);

  const vaultRefs = items
    .filter((i): i is FavVault => i.kind === 'vault')
    .map((i) => ({
      address: i.address,
      chainId: chainIdFromSlugSafe(i.chainSlug),
    }))
    .filter((r): r is VaultRef => r.chainId > 0);

  return (
    <FavoritesContent
      items={items}
      marketRefs={marketRefs}
      vaultRefs={vaultRefs}
      sort={sort}
    />
  );
}

function FavoritesContent({
  items,
  marketRefs,
  vaultRefs,
  sort,
}: {
  items: FavItem[];
  marketRefs: MarketRef[];
  vaultRefs: VaultRef[];
  sort: SortMode;
}) {
  const { data: marketData, loading: marketsLoading } = useMarketsBatch(marketRefs);
  const { data: vaultData, loading: vaultsLoading } = useVaultsBatch(vaultRefs);

  const sorted = useMemo(() => {
    if (sort === 'default') return items;
    return [...items].sort((a, b) => {
      const av = favSortMetric(a, marketData, vaultData, sort);
      const bv = favSortMetric(b, marketData, vaultData, sort);
      return bv - av;
    });
  }, [items, marketData, vaultData, sort]);

  if (marketsLoading || vaultsLoading) return <SkeletonList n={items.length} />;

  return (
    <>
      {sorted.map((item) => {
        if (item.kind === 'market') {
          const live = findLiveMarket(
            marketData,
            item.marketId,
            chainIdFromSlugSafe(item.chainSlug),
          );
          return (
            <FavoriteMarketRow
              key={item.key}
              item={item}
              live={live}
            />
          );
        }
        const live = findLiveVault(
          vaultData,
          item.address,
          chainIdFromSlugSafe(item.chainSlug),
        );
        return <FavoriteVaultRow key={item.key} item={item} live={live} />;
      })}
    </>
  );
}

function favSortMetric(
  item: FavItem,
  marketData: MarketBatchResult[] | null,
  vaultData: VaultBatchResult[] | null,
  sort: SortMode,
): number {
  if (item.kind === 'market') {
    const live = findLiveMarket(
      marketData,
      item.marketId,
      chainIdFromSlugSafe(item.chainSlug),
    );
    if (sort === 'apy') return live?.state?.supplyApy ?? -Infinity;
    if (sort === 'tvl') return live?.state?.supplyAssetsUsd ?? -Infinity;
    return 0;
  }
  const live = findLiveVault(
    vaultData,
    item.address,
    chainIdFromSlugSafe(item.chainSlug),
  );
  if (sort === 'apy') return live?.state?.netApy ?? -Infinity;
  if (sort === 'tvl') return live?.state?.totalAssetsUsd ?? -Infinity;
  return 0;
}

function findLiveVault(
  results: VaultBatchResult[] | null,
  address: string,
  chainId: number,
): ApiVault | null {
  if (!results) return null;
  const hit = results.find(
    (r) =>
      r.ref.chainId === chainId &&
      r.ref.address.toLowerCase() === address.toLowerCase(),
  );
  return hit?.vault ?? null;
}

function FavoriteMarketRow({
  item,
  live,
}: {
  item: FavMarket;
  live: ApiMarket | null;
}) {
  const label = live
    ? `${live.collateralAsset?.symbol ?? '???'}/${live.loanAsset.symbol}`
    : shortHash(item.marketId);
  const chainLabel = chainLabelFromSlug(item.chainSlug);
  return (
    <button
      type="button"
      className="p-row"
      onClick={() => openInNewTab(marketUrl(item.chainSlug, item.marketId))}
      title={`Open ${label} on ${chainLabel}`}
    >
      <div className="p-row-top">
        <span className="p-pair">
          {live ? (
            <TokenPair
              collateralLogoURI={live.collateralAsset?.logoURI}
              collateralSymbol={live.collateralAsset?.symbol ?? '?'}
              loanLogoURI={live.loanAsset.logoURI}
              loanSymbol={live.loanAsset.symbol}
            />
          ) : null}
          {label}
          <span className="p-pair-arrow" aria-hidden="true">↗</span>
        </span>
        <span className="p-chain-chip" style={chainChipStyle(item.chainSlug)}>
          {chainLabel}
        </span>
      </div>
      <div className="p-row-stats">
        <span className="p-stat-apy">
          Supply <strong>{formatPercent(live?.state?.supplyApy)}</strong>
        </span>
        <span>
          TVL <strong>{formatUsdCompact(live?.state?.supplyAssetsUsd)}</strong>
        </span>
        <span>
          util <strong>{formatPercent(live?.state?.utilization)}</strong>
        </span>
        <span>
          LLTV <strong>{formatLltv(live?.lltv)}</strong>
        </span>
      </div>
    </button>
  );
}

function FavoriteVaultRow({
  item,
  live,
}: {
  item: FavVault;
  live: ApiVault | null;
}) {
  const label = live?.name ?? live?.symbol ?? shortHash(item.address);
  const chainLabel = chainLabelFromSlug(item.chainSlug);
  return (
    <button
      type="button"
      className="p-row"
      onClick={() => openInNewTab(vaultUrl(item.chainSlug, item.address))}
      title={`Open ${label} on ${chainLabel}`}
    >
      <div className="p-row-top">
        <span className="p-pair">
          {live ? (
            <TokenIcon
              logoURI={live.asset.logoURI}
              symbol={live.asset.symbol}
            />
          ) : null}
          {label}
          {live?.version ? (
            <span
              className="p-version-chip"
              data-version={live.version}
              title={`MetaMorpho ${live.version.toUpperCase()}`}
            >
              {live.version.toUpperCase()}
            </span>
          ) : null}
          <span className="p-pair-arrow" aria-hidden="true">↗</span>
        </span>
        <span className="p-chain-chip" style={chainChipStyle(item.chainSlug)}>
          {chainLabel}
        </span>
      </div>
      <div className="p-row-stats">
        <span className="p-stat-apy">
          Net APY <strong>{formatPercent(live?.state?.netApy)}</strong>
        </span>
        <span>
          TVL <strong>{formatUsdCompact(live?.state?.totalAssetsUsd)}</strong>
        </span>
      </div>
    </button>
  );
}

// --- Hooks ---------------------------------------------------------------

// Stale-while-revalidate. Synchronously rehydrate from the persisted
// cache so the popup paints with last-known data immediately, then fire
// a background refresh and swap in fresh values when they arrive.
function useMarketsBatch(refs: MarketRef[]) {
  const [data, setData] = useState<MarketBatchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sig = useMemo(
    () => refs.map((r) => `${r.chainId}:${r.marketId.toLowerCase()}`).sort().join('|'),
    [refs],
  );
  useEffect(() => {
    if (refs.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);

    void cacheReady.then(() => {
      if (cancelled) return;

      // Phase 1 — instant render from any persisted entries.
      if (hasCachedMarkets(refs)) {
        const cached: MarketBatchResult[] = refs.map((ref) => ({
          ref,
          market: readMarketCache(ref) ?? null,
        }));
        setData(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Phase 2 — always fetch fresh; cache layer no-ops if memory is
      // still within FRESH_TTL_MS.
      fetchMarketsBatch(refs)
        .then((res) => {
          if (cancelled) return;
          setData(res);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return { data, loading, error };
}

function useVaultsBatch(refs: VaultRef[]) {
  const [data, setData] = useState<VaultBatchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sig = useMemo(
    () => refs.map((r) => `${r.chainId}:${r.address.toLowerCase()}`).sort().join('|'),
    [refs],
  );
  useEffect(() => {
    if (refs.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);

    void cacheReady.then(() => {
      if (cancelled) return;

      if (hasCachedVaults(refs)) {
        const cached: VaultBatchResult[] = refs.map((ref) => ({
          ref,
          vault: readVaultCache(ref) ?? null,
        }));
        setData(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      fetchVaultsBatch(refs)
        .then((res) => {
          if (cancelled) return;
          setData(res);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return { data, loading, error };
}

// --- Helpers --------------------------------------------------------------

function SkeletonList({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: Math.max(1, n) }).map((_, i) => (
        <div key={i} className="p-skeleton-row" />
      ))}
    </>
  );
}

function parseFavorites(): FavItem[] {
  return getAllFavoriteKeys()
    .map((key) => {
      const parsed = parseFavoriteKey(key);
      if (!parsed) return null;
      if (parsed.kind === 'market') {
        return {
          kind: 'market',
          key,
          chainSlug: parsed.chainSlug,
          marketId: parsed.id,
        } satisfies FavMarket;
      }
      return {
        kind: 'vault',
        key,
        chainSlug: parsed.chainSlug,
        address: parsed.id,
      } satisfies FavVault;
    })
    .filter((x): x is FavItem => x !== null)
    .reverse(); // most recently added on top
}

function chainIdFromSlugSafe(slug: string): number {
  if (slug in CHAIN_LABEL) {
    return chainIdFromSlug(slug as SupportedChainSlug);
  }
  return 0;
}

function chainLabelFromSlug(slug: string): string {
  return slug in CHAIN_LABEL ? CHAIN_LABEL[slug as SupportedChainSlug] : slug;
}

function shortHash(s: string): string {
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

// blue-api returns LLTV as a wei-string (e.g. "860000000000000000" for 86%).
function formatLltv(raw: string | undefined): string {
  if (!raw) return '—';
  try {
    const n = Number(BigInt(raw)) / 1e16; // 1e18 → percent, then ÷100
    return `${n.toFixed(1)}%`;
  } catch {
    return '—';
  }
}

function formatUsdCompact(value: number | undefined | null): string {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

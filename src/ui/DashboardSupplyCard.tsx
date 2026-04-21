import { useEffect, useState } from 'react';
import { fetchUserMarketPositions, type ApiMarketPosition } from '@/lib/graphql';
import { slugFromChainId } from '@/lib/chains';
import { formatAmount, formatPercent, formatUsd, shortAddress } from './format';

type Props = {
  address: `0x${string}`;
  chainIds: readonly number[];
};

type Row = ApiMarketPosition;

// Our section drops into Morpho's dashboard flex column as a sibling to the
// Vaults/Markets stacks. The parent controls horizontal padding and gap, so
// we keep the root transparent and only add vertical spacing below to keep
// a breath between us and Vaults (which starts immediately after).
const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: '100%',
  marginBottom: 24,
};

const HEADER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};

// Matches the "Vaults" / "Markets" headline size on Morpho's dashboard.
const TITLE_STYLE: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 500,
  lineHeight: 1.05,
  letterSpacing: '-0.02em',
  color: 'var(--mx-fg)',
  margin: 0,
};

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--mx-fg-muted)',
  paddingBottom: 6,
};

// Hero mirrors Morpho's Vaults/Markets summary: a horizontal split with the
// label+value on the left and stat panel on the right, divided by a hairline.
const HERO_CARD_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 342px',
  minHeight: 155,
  background: 'var(--mx-surface)',
  border: '1px solid var(--mx-border)',
  borderRadius: 16,
  overflow: 'hidden',
};

const HERO_LEFT_STYLE: React.CSSProperties = {
  padding: '24px 28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 10,
};

const HERO_LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--mx-fg-muted)',
};

const HERO_VALUE_STYLE: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 500,
  lineHeight: 1,
  color: 'var(--mx-fg)',
  letterSpacing: '-0.02em',
  fontFeatureSettings: '"tnum"',
};

const HERO_SIDE_STYLE: React.CSSProperties = {
  padding: '24px 28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 16,
  borderLeft: '1px solid var(--mx-border)',
  background: 'var(--mx-surface-subtle)',
};

const HERO_STAT_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
};

const HERO_STAT_LABEL: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--mx-fg-muted)',
};

const HERO_STAT_VALUE: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 500,
  color: 'var(--mx-fg)',
  fontFeatureSettings: '"tnum"',
  letterSpacing: '-0.01em',
};

const HERO_STAT_VALUE_ACCENT: React.CSSProperties = {
  ...HERO_STAT_VALUE,
  color: 'var(--mx-accent)',
};

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  gap: 12,
};

const CARD_STYLE: React.CSSProperties = {
  padding: 18,
  background: 'var(--mx-surface)',
  border: '1px solid var(--mx-border)',
  borderRadius: 14,
  transition: 'border-color 120ms ease, background 120ms ease',
};

const CARD_HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
};

const TOKEN_PAIR: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--mx-fg)',
};

const TOKEN_DIVIDER: React.CSSProperties = { color: 'var(--mx-fg-muted)', margin: '0 2px' };

const HASH_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--mx-fg-muted)',
  fontFeatureSettings: '"tnum"',
};

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: 13,
  padding: '4px 0',
};

const STAT_LABEL: React.CSSProperties = { color: 'var(--mx-fg-muted)' };
const STAT_VALUE: React.CSSProperties = {
  color: 'var(--mx-fg)',
  fontWeight: 500,
  fontFeatureSettings: '"tnum"',
};
const STAT_SUB: React.CSSProperties = {
  marginLeft: 6,
  color: 'var(--mx-fg-muted)',
  fontWeight: 400,
};

const EMPTY_STYLE: React.CSSProperties = {
  padding: 28,
  textAlign: 'center',
  fontSize: 13,
  color: 'var(--mx-fg-muted)',
  border: '1px dashed var(--mx-border)',
  borderRadius: 12,
};

export function DashboardSupplyCard({ address, chainIds }: Props) {
  const [positions, setPositions] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchUserMarketPositions(address, chainIds);
        if (cancelled) return;
        setPositions(rows.filter((p) => BigInt(p.supplyShares ?? '0') > 0n));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, chainIds]);

  const totalUsd = positions?.reduce((sum, p) => sum + (p.supplyAssetsUsd ?? 0), 0);
  const avgApy =
    positions && positions.length > 0 && totalUsd && totalUsd > 0
      ? positions.reduce(
          (sum, p) => sum + (p.market.state?.supplyApy ?? 0) * (p.supplyAssetsUsd ?? 0),
          0,
        ) / totalUsd
      : null;
  const positionCount = positions?.length ?? 0;

  return (
    <section style={ROOT_STYLE}>
      <div style={HEADER_ROW_STYLE}>
        <h2 style={TITLE_STYLE}>Market Lending</h2>
        <span style={SUBTITLE_STYLE}>Direct deposits into Morpho Blue markets</span>
      </div>

      <div style={HERO_CARD_STYLE}>
        <div style={HERO_LEFT_STYLE}>
          <span style={HERO_LABEL_STYLE}>Your direct-market lending</span>
          <div style={HERO_VALUE_STYLE}>
            {positions === null ? '…' : formatUsd(totalUsd)}
          </div>
        </div>
        <div style={HERO_SIDE_STYLE}>
          <div style={HERO_STAT_ROW}>
            <span style={HERO_STAT_LABEL}>Avg APY</span>
            <span style={HERO_STAT_VALUE_ACCENT}>{formatPercent(avgApy)}</span>
          </div>
          <div style={HERO_STAT_ROW}>
            <span style={HERO_STAT_LABEL}>Positions</span>
            <span style={HERO_STAT_VALUE}>{positionCount}</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ ...EMPTY_STYLE, color: 'var(--mx-danger)', borderStyle: 'solid' }}>
          {error}
        </div>
      )}

      {positions && positions.length === 0 && !error && (
        <div style={EMPTY_STYLE}>
          No direct-market supplies yet. On a market page, switch to the "Lend" tab
          to deposit the loan asset and earn interest.
        </div>
      )}

      {positions && positions.length > 0 && (
        <div style={GRID_STYLE}>
          {positions.map((p) => (
            <PositionRow
              key={`${p.market.morphoBlue?.chain.id ?? 1}-${p.market.uniqueKey}`}
              p={p}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PositionRow({ p }: { p: Row }) {
  const loan = p.market.loanAsset;
  const coll = p.market.collateralAsset;
  const chainId = p.market.morphoBlue?.chain.id ?? 1;
  const chainSlug = slugFromChainId(chainId) ?? 'ethereum';
  const marketUrl = `/${chainSlug}/market/${p.market.uniqueKey}/${(coll?.symbol ?? 'idle').toLowerCase()}-${loan.symbol.toLowerCase()}`;
  const supplied = BigInt(p.supplyAssets);
  return (
    <div
      style={{ ...CARD_STYLE, cursor: 'pointer' }}
      onClick={() => (window.location.href = marketUrl)}
    >
      <div style={CARD_HEADER}>
        <div style={TOKEN_PAIR}>
          <TokenLogo symbol={coll?.symbol} />
          <span>{coll?.symbol ?? '—'}</span>
          <span style={TOKEN_DIVIDER}>/</span>
          <TokenLogo symbol={loan.symbol} />
          <span>{loan.symbol}</span>
        </div>
        <span style={HASH_STYLE}>{shortAddress(p.market.uniqueKey)}</span>
      </div>
      <div style={STAT_ROW}>
        <span style={STAT_LABEL}>Supplied</span>
        <span style={STAT_VALUE}>
          {formatAmount(supplied, loan.decimals, 4)} {loan.symbol}
          <span style={STAT_SUB}>{formatUsd(p.supplyAssetsUsd)}</span>
        </span>
      </div>
      <div style={STAT_ROW}>
        <span style={STAT_LABEL}>Supply APY</span>
        <span style={{ ...STAT_VALUE, color: 'var(--mx-accent)' }}>
          {formatPercent(p.market.state?.supplyApy)}
        </span>
      </div>
    </div>
  );
}

function TokenLogo({ symbol }: { symbol: string | undefined }) {
  if (!symbol) return null;
  const src = `https://cdn.morpho.org/assets/logos/${symbol.toLowerCase()}.svg`;
  return (
    <img
      src={src}
      alt={symbol}
      width={20}
      height={20}
      style={{
        borderRadius: '50%',
        display: 'inline-block',
        verticalAlign: 'middle',
        marginRight: 4,
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

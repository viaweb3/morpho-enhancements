import { useMemo, useState, type CSSProperties } from 'react';

// When blue-api doesn't ship a logoURI, try Morpho's own asset CDN at
// the conventional path (lowercase symbol → SVG). Most assets they list
// follow this pattern. If that 404s too, fall through to the letter
// avatar.
function morphoCdnGuess(symbol: string): string {
  return `https://cdn.morpho.org/assets/logos/${symbol.toLowerCase()}.svg`;
}

// Stable per-symbol fallback color (so USDC is always the same shade across
// the popup). Used only when the API didn't ship a logoURI for the asset
// AND the fallback letter avatar is rendered.
const SYMBOL_COLOR: Record<string, string> = {
  USDC: '#2775ca',
  USDT: '#26a17b',
  USDT0: '#26a17b',
  USDS: '#fbbf24',
  sUSDS: '#fbbf24',
  DAI: '#f5ac37',
  WETH: '#627eea',
  ETH: '#627eea',
  WBTC: '#f7931a',
  cbBTC: '#0052ff',
  tBTC: '#000000',
  LBTC: '#f7931a',
  wstETH: '#00a3ff',
  rETH: '#ffa07a',
  XAUt: '#d4af37',
  POL: '#7b3fe4',
  WPOL: '#7b3fe4',
  MON: '#836ef9',
  WMON: '#836ef9',
  HYPE: '#00c896',
  WHYPE: '#00c896',
};

interface TokenIconProps {
  /** Morpho-shipped logo URL — preferred when present. */
  logoURI?: string | null;
  /** Asset symbol — used for the fallback letter and fallback color. */
  symbol: string;
  size?: number;
}

export function TokenIcon({ logoURI, symbol, size = 16 }: TokenIconProps) {
  // Two-stage fallback chain: provided URI → guessed Morpho CDN URL →
  // letter avatar. `step` advances on each <img onError>.
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (logoURI) list.push(logoURI);
    const guess = morphoCdnGuess(symbol);
    if (guess !== logoURI) list.push(guess);
    return list;
  }, [logoURI, symbol]);
  const [step, setStep] = useState(0);

  const fallbackBg = SYMBOL_COLOR[symbol] ?? '#2973ff';
  // Drop a leading "W" so wrapped variants share the underlying token's
  // letter (WETH → E, WBTC → B). Looks more native than "W" for everything.
  const letter = symbol.replace(/^W/, '').slice(0, 1).toUpperCase();

  const style: CSSProperties = { width: size, height: size };
  const currentSrc = candidates[step];

  if (currentSrc) {
    return (
      <img
        className="p-token-icon"
        style={style}
        src={currentSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setStep((s) => s + 1)}
      />
    );
  }

  return (
    <span
      className="p-token-icon p-token-icon-fallback"
      style={{ ...style, background: fallbackBg, fontSize: size * 0.55 }}
      aria-hidden="true"
      title={symbol}
    >
      {letter}
    </span>
  );
}

export function TokenPair({
  collateralLogoURI,
  collateralSymbol,
  loanLogoURI,
  loanSymbol,
  size = 16,
}: {
  collateralLogoURI?: string | null;
  collateralSymbol: string;
  loanLogoURI?: string | null;
  loanSymbol: string;
  size?: number;
}) {
  return (
    <span className="p-token-pair">
      <TokenIcon logoURI={collateralLogoURI} symbol={collateralSymbol} size={size} />
      <TokenIcon logoURI={loanLogoURI} symbol={loanSymbol} size={size} />
    </span>
  );
}

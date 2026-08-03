import { formatUnits, parseUnits } from 'viem';

export function formatAmount(
  value: bigint | undefined | null,
  decimals: number,
  maxFraction = 6,
): string {
  if (value === null || value === undefined) return '—';
  const raw = formatUnits(value, decimals);
  const [intPart, fracPart = ''] = raw.split('.');
  if (!fracPart) return intPart;
  const trimmed = fracPart.slice(0, maxFraction).replace(/0+$/, '');
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

export function formatUsd(value: number | undefined | null): string {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  if (value < 0.01 && value > 0) return '< $0.01';
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(
  value: number | undefined | null,
  fraction = 2,
): string {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  return `${(value * 100).toFixed(fraction)}%`;
}

export function tryParseUnits(raw: string, decimals: number): bigint | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  if (trimmed === '' || trimmed === '.') return null;
  const fraction = trimmed.split('.')[1] ?? '';
  if (fraction.length > decimals) return null;
  try {
    return parseUnits(trimmed as `${number}`, decimals);
  } catch {
    return null;
  }
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

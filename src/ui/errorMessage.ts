// Translates raw viem / wallet errors into short, user-friendly messages.
// Also flags user-rejection errors as "silent" so the UI can return to the
// idle state instead of surfacing an alarming red block.

type Humanized = {
  message: string;
  // True when the user intentionally dismissed the wallet prompt. Callers
  // should treat this as a no-op, not as an error state.
  silent: boolean;
};

const MAX_LEN = 160;

function pickFirstNonEmpty(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function truncate(s: string): string {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_LEN ? collapsed.slice(0, MAX_LEN - 1) + '…' : collapsed;
}

export function humanizeError(err: unknown): Humanized {
  const e = (err ?? {}) as Record<string, unknown>;
  // EIP-1193 codes (metamask + friends): 4001 = user rejected request,
  // 4100 = unauthorized, 4200 = unsupported method, etc.
  const code =
    typeof e.code === 'number' ? (e.code as number) :
    typeof (e.cause as { code?: unknown })?.code === 'number'
      ? ((e.cause as { code: number }).code)
      : undefined;

  const rawMsg =
    pickFirstNonEmpty(
      (e.shortMessage as string | undefined),
      (e.message as string | undefined),
      err instanceof Error ? err.message : '',
    ) || 'Unknown error';

  const lower = rawMsg.toLowerCase();

  // User rejection — silent dismiss. This covers:
  //  - viem: "User rejected the request."
  //  - metamask: "MetaMask Tx Signature: User denied transaction signature."
  //  - wallet connect / rabby / frame variants
  if (
    code === 4001 ||
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('request rejected') ||
    lower.includes('rejected by user') ||
    lower.includes('action_rejected')
  ) {
    return { message: 'Transaction cancelled.', silent: true };
  }

  // Common, higher-signal substrings — surface a short friendly line.
  if (lower.includes('insufficient funds')) {
    return { message: 'Insufficient funds for gas on this network.', silent: false };
  }
  if (lower.includes('insufficient allowance')) {
    return { message: 'Token allowance too low — approve the token again.', silent: false };
  }
  if (lower.includes('transferfromfailed') || lower.includes('transfer_from_failed')) {
    return { message: 'Token transfer failed. Check balance and allowance.', silent: false };
  }
  if (lower.includes('chain mismatch') || lower.includes('does not match the target chain')) {
    return { message: 'Wrong network — switch your wallet to the market\'s chain.', silent: false };
  }
  if (lower.includes('nonce too low')) {
    return { message: 'Nonce conflict — try again in a few seconds.', silent: false };
  }
  if (lower.includes('replacement transaction underpriced')) {
    return { message: 'A pending transaction is blocking this one.', silent: false };
  }
  if (lower.includes('network request failed') || lower.includes('failed to fetch')) {
    return { message: 'Network request failed. Check your RPC connection.', silent: false };
  }

  // Execution reverted — try to extract a short reason phrase.
  if (lower.includes('execution reverted') || lower.includes('reverted')) {
    const reason =
      (e as { reason?: string }).reason ||
      (e as { shortMessage?: string }).shortMessage ||
      'Transaction reverted on-chain.';
    return { message: truncate(`${reason}`), silent: false };
  }

  // Fallback: prefer shortMessage, otherwise the first sentence only —
  // never dump the full viem blob with calldata / docs links.
  const short = (e.shortMessage as string | undefined)?.trim();
  if (short) return { message: truncate(short), silent: false };

  const firstLine = rawMsg.split(/\r?\n/)[0] ?? rawMsg;
  return { message: truncate(firstLine), silent: false };
}

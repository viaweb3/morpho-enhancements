// Rendered INSIDE the Morpho market-action-panel (light DOM, no Shadow DOM).
// Uses Morpho's own Tailwind utility classes plus our own --mx-* theme
// variables so the form looks native in both light and dark modes.

import { useEffect, useMemo, useState } from 'react';
import { MorphoClient, type MarketParams, type Erc20Meta, type MarketState } from '@/lib/morpho';
import {
  MORPHO_BLUE_ADDRESS,
  WRAPPED_NATIVE_ADDRESS,
  chainIdFromSlug,
  isWrappedNative,
  nativeSymbolForSlug,
  resolveChain,
  type SupportedChainSlug,
} from '@/lib/chains';
import { fetchMarketById, type ApiMarket } from '@/lib/graphql';
import { formatAmount, formatPercent, formatUsd, tryParseUnits } from './format';
import { humanizeError } from './errorMessage';
import {
  getPageProvider,
  assertWalletContext,
  makeWalletClientFromPage,
  requestAccount,
} from '@/lib/pageProvider';
import { toAssetsDown } from '@/lib/sharesMath';
import type { Address, Hex } from 'viem';
import { formatUnits } from 'viem';

type Props = {
  chainSlug: SupportedChainSlug;
  marketId: Hex;
};

type Mode = 'deposit' | 'withdraw';
// "Pay with" / "Receive as" mode — only meaningful when the loan token is
// the chain's wrapped-native asset (WETH, WPOL, WMON, WHYPE). In 'wrapped'
// mode we treat the loan token as a normal ERC20. In 'native' mode we wrap
// the chain's native currency before supply and unwrap after withdraw.
type PayMode = 'wrapped' | 'native';
type Phase =
  | { name: 'idle' }
  | {
      name: 'wrapping' | 'approving' | 'supplying' | 'withdrawing' | 'unwrapping';
      txHash?: Hex;
    }
  | { name: 'success'; txHash: Hex }
  | { name: 'error'; message: string };

export function MarketLendForm({ chainSlug, marketId }: Props) {
  const morpho = useMemo(() => new MorphoClient(chainSlug), [chainSlug]);
  const chainId = useMemo(() => chainIdFromSlug(chainSlug), [chainSlug]);
  const chain = useMemo(() => resolveChain(chainSlug)?.chain, [chainSlug]);

  const [mode, setMode] = useState<Mode>('deposit');
  const [payMode, setPayMode] = useState<PayMode>('wrapped');
  const [params, setParams] = useState<MarketParams | null>(null);
  const [loanMeta, setLoanMeta] = useState<Erc20Meta | null>(null);
  const [collMeta, setCollMeta] = useState<Erc20Meta | null>(null);
  const [apiMarket, setApiMarket] = useState<ApiMarket | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [ethBalance, setEthBalance] = useState<bigint | null>(null);
  const [gasReserve, setGasReserve] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [supplyShares, setSupplyShares] = useState<bigint | null>(null);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
  const [amount, setAmount] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [dataError, setDataError] = useState<string | null>(null);

  // Resolve market params + metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await morpho.idToMarketParams(marketId);
        if (cancelled) return;
        setParams(p);
        const [loan, coll, api] = await Promise.all([
          morpho.erc20Meta(p.loanToken),
          morpho.erc20Meta(p.collateralToken),
          fetchMarketById(marketId, chainId).catch(() => null),
        ]);
        if (cancelled) return;
        setLoanMeta(loan);
        setCollMeta(coll);
        setApiMarket(api);
      } catch (err) {
        if (!cancelled) {
          const { message } = humanizeError(err);
          setPhase({ name: 'error', message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [morpho, marketId, chainId]);

  useEffect(() => {
    const bridge = getPageProvider();
    const off = bridge.onAccountsChanged((accs) => {
      setAccount(accs[0] ? (accs[0] as Address) : null);
    });
    (async () => {
      const accs = (await bridge.request('eth_accounts').catch(() => [])) as string[];
      if (accs[0]) setAccount(accs[0] as Address);
    })();
    return off;
  }, []);

  // True when the market's loan token is exactly the chain's wrapped-native
  // token (WETH on ETH chains, WPOL on Polygon, WMON on Monad, WHYPE on
  // HyperEVM). Only then does the "pay with native" / "receive as native"
  // flow make sense — you can't wrap POL into WETH, etc.
  const loanIsWrappedNative = useMemo(
    () => (params ? isWrappedNative(params.loanToken, chainSlug) : false),
    [params, chainSlug],
  );
  const nativeSymbol = useMemo(() => nativeSymbolForSlug(chainSlug), [chainSlug]);

  // Refresh balances, allowance, position, market state whenever phase settles
  useEffect(() => {
    if (!account || !params) return;
    let cancelled = false;
    (async () => {
      try {
        const [bal, all, pos, market, eth, reserve] = await Promise.all([
          morpho.erc20Balance(params.loanToken, account),
          morpho.erc20Allowance(params.loanToken, account, MORPHO_BLUE_ADDRESS),
          morpho.position(marketId, account),
          morpho.marketState(marketId),
          loanIsWrappedNative ? morpho.nativeBalance(account) : Promise.resolve(null),
          loanIsWrappedNative ? morpho.nativeGasReserve().catch(() => 200_000_000_000_000n) : 0n,
        ]);
        if (cancelled) return;
        setBalance(bal);
        setAllowance(all);
        setSupplyShares(pos.supplyShares);
        setMarketState(market);
        setEthBalance(eth);
        setGasReserve(reserve);
        setDataError(null);
      } catch (error) {
        if (!cancelled) setDataError(humanizeError(error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [morpho, marketId, account, params, phase.name, loanIsWrappedNative]);

  const decimals = loanMeta?.decimals ?? 18;
  const parsedAmount = useMemo(() => tryParseUnits(amount, decimals), [amount, decimals]);

  // Live user-supplied balance (assets equivalent of supplyShares). Note this
  // is storage-level value without mid-block interest accrual; close enough
  // for UX — the tx will round correctly on-chain.
  const suppliedAssets: bigint | null = useMemo(() => {
    if (supplyShares === null || marketState === null) return null;
    if (supplyShares === 0n) return 0n;
    return toAssetsDown(
      supplyShares,
      marketState.totalSupplyAssets,
      marketState.totalSupplyShares,
    );
  }, [supplyShares, marketState]);

  // In native-pay mode the user spends native currency (ETH/POL/MON/HYPE).
  // Their effective balance is (wrapped-balance + native-balance) and we wrap
  // on the fly for whatever portion exceeds current wrapped holdings.
  const useNative = loanIsWrappedNative && payMode === 'native';
  const depositBalance = useNative
    ? (balance ?? 0n) + (ethBalance ?? 0n)
    : balance;
  const wrapAmount =
    useNative &&
    mode === 'deposit' &&
    parsedAmount !== null &&
    balance !== null &&
    parsedAmount > balance
      ? parsedAmount - balance
      : 0n;
  const needsWrap = wrapAmount > 0n;

  const needsApprove =
    mode === 'deposit' && parsedAmount !== null && allowance !== null && allowance < parsedAmount;
  const insufficientBalance =
    mode === 'deposit' &&
    parsedAmount !== null &&
    depositBalance !== null &&
    depositBalance < parsedAmount;
  const insufficientSupply =
    mode === 'withdraw' &&
    parsedAmount !== null &&
    suppliedAssets !== null &&
    suppliedAssets < parsedAmount;

  const symbol = loanMeta?.symbol ?? '';
  const displaySymbol = useNative ? nativeSymbol : symbol;
  const busy =
    phase.name === 'approving' ||
    phase.name === 'supplying' ||
    phase.name === 'withdrawing' ||
    phase.name === 'wrapping' ||
    phase.name === 'unwrapping';

  function handleError(err: unknown) {
    const { message, silent } = humanizeError(err);
    // A user rejecting the wallet prompt is not an error — just return to
    // idle instead of flashing a scary red block with raw calldata.
    setPhase(silent ? { name: 'idle' } : { name: 'error', message });
  }

  async function onConnect() {
    try {
      const a = await requestAccount();
      if (a) setAccount(a);
    } catch (err) {
      handleError(err);
    }
  }

  function onMax() {
    if (mode === 'deposit') {
      if (!loanMeta) return;
      // In ETH-pay mode we can fund the deposit from the combined pool of
      // WETH + native ETH. Keep a small dust buffer out of the ETH max so
      // gas doesn't push the user into insufficient-funds territory.
      if (useNative) {
        if (balance === null || ethBalance === null) return;
        const ethSpendable = ethBalance > gasReserve ? ethBalance - gasReserve : 0n;
        const total = balance + ethSpendable;
        setAmount(formatAmount(total, loanMeta.decimals, loanMeta.decimals));
        return;
      }
      if (!balance) return;
      setAmount(formatAmount(balance, loanMeta.decimals, loanMeta.decimals));
    } else {
      if (suppliedAssets === null || !loanMeta) return;
      setAmount(formatAmount(suppliedAssets, loanMeta.decimals, loanMeta.decimals));
    }
  }

  async function onWrap() {
    if (!account || !chain || wrapAmount <= 0n) return;
    try {
      setPhase({ name: 'wrapping' });
      await assertWalletContext(chainId, account);
      const wallet = makeWalletClientFromPage(chain, account);
      const txHash = await morpho.wrapEth(wallet, WRAPPED_NATIVE_ADDRESS[chainSlug], wrapAmount, account);
      setPhase({ name: 'wrapping', txHash });
      await morpho.waitForSuccessfulTransaction(txHash);
      setPhase({ name: 'idle' });
    } catch (err) {
      handleError(err);
    }
  }

  async function onApprove() {
    if (!params || !account || !chain || !parsedAmount) return;
    try {
      setPhase({ name: 'approving' });
      await assertWalletContext(chainId, account);
      const wallet = makeWalletClientFromPage(chain, account);
      if ((allowance ?? 0n) > 0n) {
        const resetHash = await morpho.approve(
          wallet,
          params.loanToken,
          MORPHO_BLUE_ADDRESS,
          0n,
          account,
        );
        setPhase({ name: 'approving', txHash: resetHash });
        await morpho.waitForSuccessfulTransaction(resetHash);
      }
      const txHash = await morpho.approve(
        wallet,
        params.loanToken,
        MORPHO_BLUE_ADDRESS,
        parsedAmount,
        account,
      );
      setPhase({ name: 'approving', txHash });
      await morpho.waitForSuccessfulTransaction(txHash);
      setPhase({ name: 'idle' });
    } catch (err) {
      handleError(err);
    }
  }

  async function onSupply() {
    if (!params || !account || !chain || !parsedAmount) return;
    try {
      setPhase({ name: 'supplying' });
      await assertWalletContext(chainId, account);
      const wallet = makeWalletClientFromPage(chain, account);
      const txHash = await morpho.supply(wallet, params, parsedAmount, account);
      setPhase({ name: 'supplying', txHash });
      await morpho.waitForSuccessfulTransaction(txHash);
      setPhase({ name: 'success', txHash });
      setAmount('');
    } catch (err) {
      handleError(err);
    }
  }

  async function onWithdraw() {
    if (!params || !account || !chain || !parsedAmount) return;
    if (suppliedAssets === null || supplyShares === null) return;
    try {
      setPhase({ name: 'withdrawing' });
      await assertWalletContext(chainId, account);
      const wallet = makeWalletClientFromPage(chain, account);
      // Full withdraw: pass shares to avoid precision reverts.
      // Partial: pass assets. We consider "full" when user's amount equals
      // their displayed supplied balance (within 0.01% tolerance).
      const isFull =
        parsedAmount >= (suppliedAssets * 9999n) / 10000n && parsedAmount <= suppliedAssets;
      // Snapshot WETH balance so we can compute what was actually received
      // after the withdraw (handles rounding vs. pre-existing WETH holdings).
      const wethBefore = useNative ? (balance ?? 0n) : 0n;
      const txHash = isFull
        ? await morpho.withdrawBySharesFull(wallet, params, supplyShares, account, account)
        : await morpho.withdrawByAssets(wallet, params, parsedAmount, account, account);
      setPhase({ name: 'withdrawing', txHash });
      await morpho.waitForSuccessfulTransaction(txHash);
      // When receiving-as-ETH, unwrap only the delta we just pulled in so we
      // don't touch WETH the user already held.
      if (useNative) {
        const wethAfter = await morpho.erc20Balance(params.loanToken, account);
        const received = wethAfter > wethBefore ? wethAfter - wethBefore : 0n;
        if (received > 0n) {
          setPhase({ name: 'unwrapping' });
          const unwrapTx = await morpho.unwrapWeth(
            wallet,
            WRAPPED_NATIVE_ADDRESS[chainSlug],
            received,
            account,
          );
          setPhase({ name: 'unwrapping', txHash: unwrapTx });
          await morpho.waitForSuccessfulTransaction(unwrapTx);
          setPhase({ name: 'success', txHash: unwrapTx });
          setAmount('');
          return;
        }
      }
      setPhase({ name: 'success', txHash });
      setAmount('');
    } catch (err) {
      handleError(err);
    }
  }

  function primaryLabel(): string {
    if (!account) return 'Connect wallet';
    if (mode === 'deposit') {
      if (insufficientBalance) return `Insufficient ${displaySymbol} balance`;
      if (needsWrap) {
        return phase.name === 'wrapping'
          ? `Wrapping ${nativeSymbol}…`
          : `Wrap ${nativeSymbol} → ${symbol}`;
      }
      if (needsApprove) return phase.name === 'approving' ? 'Approving…' : `Approve ${symbol}`;
      return phase.name === 'supplying' ? 'Supplying…' : `Supply ${displaySymbol}`;
    }
    if (insufficientSupply) return `Insufficient supplied ${symbol}`;
    if (phase.name === 'withdrawing') return 'Withdrawing…';
    if (phase.name === 'unwrapping') return `Unwrapping ${symbol}…`;
    return useNative ? `Withdraw as ${nativeSymbol}` : `Withdraw ${symbol}`;
  }

  function primaryAction() {
    if (!account) return onConnect;
    if (mode === 'deposit') {
      if (insufficientBalance) return () => {};
      if (needsWrap) return onWrap;
      if (needsApprove) return onApprove;
      return onSupply;
    }
    if (insufficientSupply) return () => {};
    return onWithdraw;
  }

  const primaryDisabled =
    busy ||
    (account !== null &&
      (!parsedAmount ||
        (mode === 'deposit' && insufficientBalance) ||
        (mode === 'withdraw' && insufficientSupply)));

  const loanLogo = symbol
    ? `https://cdn.morpho.org/assets/logos/${symbol.toLowerCase()}.svg`
    : '';
  const collateralLogo = collMeta?.symbol
    ? `https://cdn.morpho.org/assets/logos/${collMeta.symbol.toLowerCase()}.svg`
    : '';
  const inputUsd = useMemo(() => {
    if (!parsedAmount || !loanMeta || !apiMarket?.state) return null;
    try {
      const totalAssets = Number(formatUnits(BigInt(apiMarket.state.supplyAssets), loanMeta.decimals));
      if (!Number.isFinite(totalAssets) || totalAssets <= 0) return null;
      const priceUsd = apiMarket.state.supplyAssetsUsd / totalAssets;
      const entered = Number(formatUnits(parsedAmount, loanMeta.decimals));
      const value = entered * priceUsd;
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }, [parsedAmount, loanMeta, apiMarket]);

  return (
    <>
      {/* Match Morpho's compact secondary segmented control. */}
      <div style={SUBTABS_STYLE}>
        <button
          type="button"
          onClick={() => {
            setMode('deposit');
            setAmount('');
          }}
          aria-selected={mode === 'deposit'}
          style={{ ...SUBTAB_STYLE, ...(mode === 'deposit' ? SUBTAB_ACTIVE_STYLE : {}) }}
        >
          Supply
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('withdraw');
            setAmount('');
          }}
          aria-selected={mode === 'withdraw'}
          style={{ ...SUBTAB_STYLE, ...(mode === 'withdraw' ? SUBTAB_ACTIVE_STYLE : {}) }}
        >
          Withdraw
        </button>
      </div>

      {/* Same three-row anatomy and density as Morpho's native asset input. */}
      <div className="flex flex-col gap-[2px]">
        <div className="flex flex-col gap-[9px]">
          <div
          data-morpho-ext-input-card=""
          className="gap-sm p-md shadow-md dark:shadow-none flex flex-col rounded-[20px] bg-card cursor-text hover:bg-card"
          style={{
            outline: inputFocused
              ? '1px solid var(--mx-ring)'
              : '0.5px solid var(--mx-border)',
            outlineOffset: -1,
          }}
          onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
        >
          <div className="gap-s flex flex-row items-center justify-between">
            <span className="text-secondary-foreground max-w-[170px] truncate text-xs">
              {mode === 'deposit' ? 'Supply' : 'Withdraw'} {displaySymbol}
            </span>
            <div className="flex items-center gap-[6px]">
              {loanIsWrappedNative && (
                <div style={PAY_TOGGLE_STYLE}>
                  <button
                    type="button"
                    style={{
                      ...PAY_TOGGLE_BTN,
                      ...(payMode === 'wrapped' ? PAY_TOGGLE_ACTIVE : {}),
                    }}
                    onClick={() => {
                      setPayMode('wrapped');
                      setAmount('');
                    }}
                    disabled={busy}
                    title={`Use wallet's ${symbol} directly`}
                  >
                    {symbol}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...PAY_TOGGLE_BTN,
                      ...(payMode === 'native' ? PAY_TOGGLE_ACTIVE : {}),
                    }}
                    onClick={() => {
                      setPayMode('native');
                      setAmount('');
                    }}
                    disabled={busy}
                    title={`Wrap ${nativeSymbol} → ${symbol} automatically`}
                  >
                    {nativeSymbol}
                  </button>
                </div>
              )}
              {loanLogo && (
                <div className="flex gap-[2px]">
                  <div
                    className="relative inline-flex shrink-0 items-center justify-center p-[2px]"
                    style={{ width: 20, height: 20 }}
                  >
                    <img
                      alt={displaySymbol}
                      src={
                        useNative
                          ? `https://cdn.morpho.org/assets/logos/${nativeSymbol.toLowerCase()}.svg`
                          : loanLogo
                      }
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = loanLogo;
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="gap-s flex flex-row items-center justify-between">
            <input
              aria-label="Asset Input"
              placeholder="0.00"
              inputMode="decimal"
              lang="en-US"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              disabled={busy}
              className="text-xl text-foreground h-[33px] w-full border-none bg-transparent p-0 outline-none caret-primary input-no-spinner truncate placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>
          <div className="gap-s flex min-h-[26px] w-full flex-row items-center justify-between">
            <span className="text-3xs h-[18px] truncate leading-none break-all text-secondary-foreground">
              {inputUsd === null ? '$0' : formatUsd(inputUsd)}
            </span>
            <div className="gap-xs flex flex-row items-center">
              <span className="text-3xs text-secondary-foreground max-w-[140px] truncate whitespace-nowrap">
                {mode === 'deposit'
                  ? walletDisplay({
                      loanMeta,
                      wrappedBal: balance,
                      nativeBal: useNative ? ethBalance : null,
                      combined: useNative,
                      wrappedSymbol: symbol,
                      nativeSymbol,
                    })
                  : suppliedAssets !== null && loanMeta
                  ? `${formatAmount(suppliedAssets, loanMeta.decimals, 4)} ${symbol}`
                  : `— ${symbol}`}
              </span>
              <button
                type="button"
                onClick={onMax}
                disabled={
                  busy ||
                  (mode === 'deposit'
                    ? !(depositBalance && depositBalance > 0n)
                    : suppliedAssets === null || suppliedAssets === 0n)
                }
                className="inline-flex items-center cursor-pointer disabled:cursor-not-allowed justify-center whitespace-nowrap rounded-lg active:scale-98 disabled:opacity-50 shrink-0 outline-none border-[0.5px] border-border bg-popover text-foreground shadow-sm hover:bg-accent active:bg-accent disabled:border-transparent disabled:shadow-none gap-1 px-3 text-2xs leading-none h-[26px]"
              >
                <span className="truncate leading-none text-inherit">MAX</span>
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Native-style summary card. */}
      <div
        data-morpho-ext-summary-card=""
        className="bg-card shadow-md dark:shadow-none flex rounded-[20px] p-md border-[0.5px] border-border gap-sm flex-col justify-between"
        style={{ borderColor: 'var(--mx-border)' }}
      >
        <Row label="Loan asset" value={symbol} logo={loanLogo} />
        <Row label="Collateral asset" value={collMeta?.symbol ?? '—'} logo={collateralLogo} />
        <Row label="Supply APY" value={formatPercent(apiMarket?.state?.supplyApy)} />
        <Row
          label="Market utilization"
          value={formatPercent(apiMarket?.state?.utilization)}
        />
        <Row
          label="Total supplied"
          value={formatUsd(apiMarket?.state?.supplyAssetsUsd)}
        />
      </div>

      <div className="gap-xs pb-sm flex flex-col items-stretch justify-start">
        <ActionButton onClick={primaryAction()} disabled={primaryDisabled}>
          {primaryLabel()}
        </ActionButton>

        {phase.name === 'error' && (
          <div style={ERROR_STYLE}>{phase.message}</div>
        )}
        {dataError && phase.name !== 'error' && (
          <div style={ERROR_STYLE}>Live wallet data unavailable: {dataError}</div>
        )}
        {phase.name === 'success' && (
          <div style={SUCCESS_STYLE}>
            Done — tx {phase.txHash.slice(0, 10)}…
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Styles ----------

const SUBTABS_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  padding: 2,
  gap: 2,
  background: 'var(--mx-control-bg)',
  borderRadius: 10,
  alignSelf: 'flex-start',
};

const SUBTAB_STYLE: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: 'var(--mx-fg-muted)',
  height: 28,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1,
  padding: '0 12px',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background-color 120ms ease, color 120ms ease',
};

const SUBTAB_ACTIVE_STYLE: React.CSSProperties = {
  background: 'var(--mx-control-active)',
  color: 'var(--mx-fg)',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
};

const PAY_TOGGLE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  padding: 2,
  gap: 2,
  background: 'var(--mx-control-bg)',
  borderRadius: 8,
  border: '0.5px solid var(--mx-border)',
};

const PAY_TOGGLE_BTN: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  color: 'var(--mx-fg-muted)',
  fontSize: 11,
  fontWeight: 400,
  height: 22,
  padding: '0 7px',
  borderRadius: 6,
  cursor: 'pointer',
  letterSpacing: '0.02em',
};

const PAY_TOGGLE_ACTIVE: React.CSSProperties = {
  background: 'var(--mx-control-active)',
  color: 'var(--mx-fg)',
  boxShadow: '0 0 0 1px var(--mx-border)',
};

function walletDisplay({
  loanMeta,
  wrappedBal,
  nativeBal,
  combined,
  wrappedSymbol,
  nativeSymbol,
}: {
  loanMeta: Erc20Meta | null;
  wrappedBal: bigint | null;
  nativeBal: bigint | null;
  combined: boolean;
  wrappedSymbol: string;
  nativeSymbol: string;
}): string {
  if (!loanMeta) return `— ${wrappedSymbol}`;
  if (combined) {
    const nat = nativeBal ?? 0n;
    const wrapped = wrappedBal ?? 0n;
    if (wrapped > 0n) {
      return `${formatAmount(nat, loanMeta.decimals, 4)} ${nativeSymbol} + ${formatAmount(wrapped, loanMeta.decimals, 4)} ${wrappedSymbol}`;
    }
    return `${formatAmount(nat, loanMeta.decimals, 4)} ${nativeSymbol}`;
  }
  if (wrappedBal === null) return `— ${wrappedSymbol}`;
  return `${formatAmount(wrappedBal, loanMeta.decimals, 4)} ${wrappedSymbol}`;
}

const ERROR_STYLE: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  fontSize: 12,
  color: '#d64545',
  background: 'rgba(214, 69, 69, 0.1)',
  borderRadius: 8,
  wordBreak: 'break-word',
};

const SUCCESS_STYLE: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  fontSize: 12,
  color: '#16a26a',
  background: 'rgba(22, 162, 106, 0.1)',
  borderRadius: 8,
};

function Row({ label, value, logo }: { label: string; value: string; logo?: string }) {
  return (
    <div className="flex min-h-5 items-center justify-between text-3xs leading-none">
      <span className="text-secondary-foreground">{label}</span>
      <span className="flex items-center gap-[6px] text-foreground">
        {logo && value !== '—' && (
          <img
            alt=""
            aria-hidden="true"
            src={logo}
            className="size-5 shrink-0 object-contain p-[2px]"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span>{value}</span>
      </span>
    </div>
  );
}

function ActionButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style, children, disabled, ...rest } = props;
  const base: React.CSSProperties = {
    width: '100%',
    height: 48,
    padding: '0 20px',
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontWeight: 400,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: disabled ? 'var(--mx-disabled-bg)' : 'var(--mx-primary)',
    color: disabled ? 'var(--mx-fg-disabled)' : '#ffffff',
    transition: 'background-color 120ms ease, opacity 120ms ease',
  };
  return (
    <button type="button" disabled={disabled} style={{ ...base, ...style }} {...rest}>
      {children}
    </button>
  );
}

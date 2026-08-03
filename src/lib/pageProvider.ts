import { custom, createWalletClient, type WalletClient, type Chain, type Address } from 'viem';
import { assertExpectedChain } from './walletRpcPolicy';

type AccountsListener = (accounts: string[]) => void;
type ChainListener = (chainId: string) => void;
type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: number; message: string } };

class PageProviderBridge {
  private accountsListeners = new Set<AccountsListener>();
  private chainListeners = new Set<ChainListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastAccounts = '';
  private lastChain = '';
  private preferredAccount: Address | null = null;

  setPreferredAccount(account: Address): void {
    this.preferredAccount = account;
  }

  async request(
    method: string,
    params?: unknown[] | object,
    accountHint: Address | null = this.preferredAccount,
  ): Promise<unknown> {
    const response = await chrome.runtime.sendMessage({
      type: 'morpho-ext:wallet-rpc',
      method,
      params,
      accountHint,
    }) as RpcResponse | undefined;
    if (!response) throw new Error('The extension wallet service is unavailable');
    if (!response.ok) {
      const error = new Error(response.error.message) as Error & { code?: number };
      error.code = response.error.code;
      throw error;
    }
    return response.result;
  }

  onAccountsChanged(listener: AccountsListener): () => void {
    this.accountsListeners.add(listener);
    this.ensurePolling();
    void this.poll();
    return () => {
      this.accountsListeners.delete(listener);
      this.stopPollingIfIdle();
    };
  }

  onChainChanged(listener: ChainListener): () => void {
    this.chainListeners.add(listener);
    this.ensurePolling();
    void this.poll();
    return () => {
      this.chainListeners.delete(listener);
      this.stopPollingIfIdle();
    };
  }

  private ensurePolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.poll(), 2_000);
  }

  private stopPollingIfIdle(): void {
    if (this.accountsListeners.size > 0 || this.chainListeners.size > 0 || !this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async poll(): Promise<void> {
    const [accounts, chainId] = await Promise.all([
      this.request('eth_accounts').catch(() => []),
      this.request('eth_chainId').catch(() => ''),
    ]) as [string[], string];
    const accountSignature = accounts.join(',').toLowerCase();
    if (accountSignature !== this.lastAccounts) {
      this.lastAccounts = accountSignature;
      for (const listener of this.accountsListeners) listener(accounts);
    }
    if (chainId && chainId !== this.lastChain) {
      this.lastChain = chainId;
      for (const listener of this.chainListeners) listener(chainId);
    }
  }
}

let singleton: PageProviderBridge | null = null;

export function getPageProvider(): PageProviderBridge {
  if (!singleton) singleton = new PageProviderBridge();
  return singleton;
}

export function makeWalletClientFromPage(chain: Chain, account: Address): WalletClient {
  const bridge = getPageProvider();
  bridge.setPreferredAccount(account);
  const transport = custom({ request: ({ method, params }) => bridge.request(method, params, account) });
  return createWalletClient({ account, chain, transport });
}

export async function requestAccount(): Promise<Address | null> {
  const bridge = getPageProvider();
  const accounts = (await bridge.request('eth_accounts').catch(() => [])) as string[];
  if (accounts.length > 0) {
    bridge.setPreferredAccount(accounts[0] as Address);
    return accounts[0] as Address;
  }
  const requested = (await bridge.request('eth_requestAccounts').catch(() => [])) as string[];
  if (requested.length === 0) return null;
  bridge.setPreferredAccount(requested[0] as Address);
  return requested[0] as Address;
}

export async function currentChainId(): Promise<number | null> {
  const hex = (await getPageProvider().request('eth_chainId').catch(() => null)) as string | null;
  return hex ? Number.parseInt(hex, 16) : null;
}

export async function assertWalletContext(expectedChainId: number, expectedAccount: Address): Promise<void> {
  const bridge = getPageProvider();
  bridge.setPreferredAccount(expectedAccount);
  const [chainId, accounts] = await Promise.all([
    currentChainId(),
    bridge.request('eth_accounts').catch(() => []),
  ]) as [number | null, string[]];
  assertExpectedChain(chainId, expectedChainId);
  const activeAccount = accounts[0];
  if (!activeAccount || activeAccount.toLowerCase() !== expectedAccount.toLowerCase()) {
    throw new Error('The active wallet account changed. Reconnect and review the transaction again.');
  }
}

// Lives in the content script (ISOLATED world). Injects provider-bridge.ts into
// the page and exposes an EIP-1193-style async request() that postMessages to
// the bridge. Viem consumes it via custom({ request }).

import { custom, createWalletClient, type WalletClient, type Chain, type Address } from 'viem';

type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

type ProviderEntry = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type ProviderListener = (providers: ProviderEntry[]) => void;
type AccountsListener = (accounts: string[]) => void;
type ChainListener = (chainId: string) => void;

const SRC_CS = 'morpho-ext/cs';
const SRC_PAGE = 'morpho-ext/page';

class PageProviderBridge {
  private nextId = 1;
  private pending = new Map<number, PendingCall>();
  private providers: ProviderEntry[] = [];
  private providerListeners = new Set<ProviderListener>();
  private accountsListeners = new Set<AccountsListener>();
  private chainListeners = new Set<ChainListener>();
  private injected = false;

  ensureInjected() {
    // The provider bridge is now injected by the manifest as a
    // world: 'MAIN' content_script, so there's nothing to dynamically inject.
    // We just need to subscribe to its postMessages once.
    if (this.injected) return;
    this.injected = true;
    window.addEventListener('message', this.onMessage);
    // Ask the bridge to (re-)announce its provider list
    try {
      window.postMessage({ source: SRC_CS, id: 0, method: 'morpho-ext/listProviders' }, '*');
    } catch {
      // ignore — bridge may not be ready yet; subscribers get announcements later
    }
  }

  private onMessage = (event: MessageEvent) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== SRC_PAGE) return;

    if (msg.type === 'providers') {
      this.providers = msg.providers;
      for (const l of this.providerListeners) l(this.providers);
      return;
    }
    if (msg.type === 'accountsChanged') {
      const accounts = (msg.accounts as string[]) ?? [];
      for (const l of this.accountsListeners) l(accounts);
      return;
    }
    if (msg.type === 'chainChanged') {
      const chainId = String(msg.chainId);
      for (const l of this.chainListeners) l(chainId);
      return;
    }
    if (typeof msg.id === 'number') {
      const call = this.pending.get(msg.id);
      if (!call) return;
      this.pending.delete(msg.id);
      if (msg.error) call.reject(msg.error);
      else call.resolve(msg.result);
    }
  };

  async request(method: string, params?: unknown[] | object, providerUuid?: string): Promise<unknown> {
    this.ensureInjected();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      window.postMessage({ source: SRC_CS, id, method, params, providerUuid }, '*');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`EIP-1193 request timeout: ${method}`));
        }
      }, 120_000);
    });
  }

  listProviders(): ProviderEntry[] {
    return this.providers;
  }

  onProviders(listener: ProviderListener): () => void {
    this.providerListeners.add(listener);
    // Kick a re-announce in case bridge already loaded
    this.request('morpho-ext/listProviders').catch(() => {});
    return () => this.providerListeners.delete(listener);
  }

  onAccountsChanged(listener: AccountsListener): () => void {
    this.accountsListeners.add(listener);
    return () => this.accountsListeners.delete(listener);
  }

  onChainChanged(listener: ChainListener): () => void {
    this.chainListeners.add(listener);
    return () => this.chainListeners.delete(listener);
  }
}

let singleton: PageProviderBridge | null = null;

export function getPageProvider(): PageProviderBridge {
  if (!singleton) singleton = new PageProviderBridge();
  singleton.ensureInjected();
  return singleton;
}

export function makeWalletClientFromPage(chain: Chain, account: Address): WalletClient {
  const bridge = getPageProvider();
  const transport = custom({
    request: ({ method, params }) => bridge.request(method, params),
  });
  return createWalletClient({ account, chain, transport });
}

export async function requestAccount(): Promise<Address | null> {
  const bridge = getPageProvider();
  const accounts = (await bridge.request('eth_accounts').catch(() => [])) as string[];
  if (accounts && accounts.length > 0) return accounts[0] as Address;
  // Ask the page wallet to reveal — will prompt if not previously connected
  const requested = (await bridge.request('eth_requestAccounts').catch(() => [])) as string[];
  return requested && requested.length > 0 ? (requested[0] as Address) : null;
}

export async function currentChainId(): Promise<number | null> {
  const bridge = getPageProvider();
  const hex = (await bridge.request('eth_chainId').catch(() => null)) as string | null;
  return hex ? parseInt(hex, 16) : null;
}

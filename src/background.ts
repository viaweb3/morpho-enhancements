import { isAllowedWalletRpcMethod } from './lib/walletRpcPolicy';

type WalletRpcMessage = {
  type: 'morpho-ext:wallet-rpc';
  method: unknown;
  params?: unknown;
  accountHint?: unknown;
};

type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: number; message: string } };

function isTrustedContentScript(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id === undefined) {
    return false;
  }
  try {
    return new URL(sender.url ?? '').origin === 'https://app.morpho.org';
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const msg = message as Partial<WalletRpcMessage> | null;
  if (!msg || msg.type !== 'morpho-ext:wallet-rpc') return false;

  if (!isTrustedContentScript(sender) || !isAllowedWalletRpcMethod(msg.method)) {
    sendResponse({
      ok: false,
      error: { code: -32601, message: 'Wallet RPC request is not allowed' },
    } satisfies RpcResponse);
    return false;
  }

  const tabId = sender.tab!.id!;
  const accountHint = typeof msg.accountHint === 'string' && /^0x[0-9a-fA-F]{40}$/.test(msg.accountHint)
    ? msg.accountHint
    : undefined;
  void executeWalletRpc(tabId, msg.method, msg.params, accountHint)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      } satisfies RpcResponse);
    });
  return true;
});

async function executeWalletRpc(
  tabId: number,
  method: string,
  params: unknown,
  accountHint?: string,
): Promise<RpcResponse> {
  const [execution] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    world: 'MAIN',
    // executeScript args must be JSON-serializable; normalize absent values.
    args: [method, params ?? null, accountHint ?? null],
    func: async (
      rpcMethod: string,
      rpcParams: unknown,
      preferredAccount: string | null,
    ): Promise<RpcResponse> => {
      type Provider = {
        request: (request: { method: string; params?: unknown }) => Promise<unknown>;
      };
      type AnnounceEvent = CustomEvent<{ provider?: Provider }>;

      const discovered: Provider[] = [];
      const onProvider = (event: Event) => {
        const provider = (event as AnnounceEvent).detail?.provider;
        if (provider && typeof provider.request === 'function') discovered.push(provider);
      };

      window.addEventListener('eip6963:announceProvider', onProvider);
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      window.removeEventListener('eip6963:announceProvider', onProvider);

      const legacy = (window as typeof window & { ethereum?: Provider }).ethereum;
      if (legacy && !discovered.includes(legacy)) discovered.push(legacy);

      let provider = discovered[0];
      if (preferredAccount) {
        const normalized = preferredAccount.toLowerCase();
        for (const candidate of discovered) {
          try {
            const accounts = await candidate.request({ method: 'eth_accounts' });
            if (Array.isArray(accounts) && accounts.some(
              (account) => typeof account === 'string' && account.toLowerCase() === normalized,
            )) {
              provider = candidate;
              break;
            }
          } catch {
            // Ignore wallets that are locked or unavailable and try the next provider.
          }
        }
      }
      if (!provider) {
        return {
          ok: false,
          error: { code: -32603, message: 'No injected EIP-1193 wallet found on this page' },
        };
      }

      try {
        const request = rpcParams === null
          ? { method: rpcMethod }
          : { method: rpcMethod, params: rpcParams };
        return { ok: true, result: await provider.request(request) };
      } catch (error: unknown) {
        const candidate = error as { code?: unknown; message?: unknown } | null;
        return {
          ok: false,
          error: {
            code: typeof candidate?.code === 'number' ? candidate.code : -32603,
            message:
              typeof candidate?.message === 'string' ? candidate.message : String(error),
          },
        };
      }
    },
  });

  if (!execution) throw new Error('Wallet RPC execution failed');
  return execution.result as RpcResponse;
}

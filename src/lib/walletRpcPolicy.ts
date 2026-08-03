const ALLOWED_WALLET_RPC_METHODS = new Set([
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'eth_sendTransaction',
]);

export function isAllowedWalletRpcMethod(method: unknown): method is string {
  return typeof method === 'string' && ALLOWED_WALLET_RPC_METHODS.has(method);
}

export function assertExpectedChain(currentChainId: number | null, expectedChainId: number): void {
  if (currentChainId === null) {
    throw new Error('Unable to read the wallet network. Reconnect the wallet and try again.');
  }
  if (currentChainId !== expectedChainId) {
    throw new Error(
      `Wrong wallet network. Switch to chain ${expectedChainId} before confirming the transaction.`,
    );
  }
}

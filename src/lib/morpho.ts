import {
  createPublicClient,
  encodeAbiParameters,
  fallback,
  http,
  keccak256,
  getContract,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { MORPHO_ABI, ERC20_ABI, WETH_ABI } from './morphoAbi';
import { MORPHO_BLUE_ADDRESS, resolveChain, type SupportedChainSlug } from './chains';
import { toAssetsDown } from './sharesMath';

export type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

export type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

export type Erc20Meta = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
};

export function marketParamsToId(params: MarketParams): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address', name: 'loanToken' },
        { type: 'address', name: 'collateralToken' },
        { type: 'address', name: 'oracle' },
        { type: 'address', name: 'irm' },
        { type: 'uint256', name: 'lltv' },
      ],
      [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
    ),
  );
}

export class MorphoClient {
  readonly chainSlug: SupportedChainSlug;
  readonly publicClient: PublicClient;

  constructor(chainSlug: SupportedChainSlug) {
    const resolved = resolveChain(chainSlug);
    if (!resolved) throw new Error(`Unsupported chain slug: ${chainSlug}`);
    this.chainSlug = chainSlug;
    // Fallback transport with fast failover — a 429 from the first RPC
    // shouldn't block the UI for 10s before trying the next one.
    //   retryCount:0 per http() — fallback handles the retry by switching
    //   timeout:3500 — if an RPC can't respond in 3.5s on a simple eth_call,
    //                   it's likely throttled; move on.
    this.publicClient = createPublicClient({
      chain: resolved.chain,
      transport: fallback(
        resolved.rpcUrls.map((url) =>
          http(url, { retryCount: 0, timeout: 3_500 }),
        ),
        { rank: false, retryCount: 1 },
      ),
      // Multicall batches same-block reads into one RPC request — cuts load
      // dramatically when the form fetches loan meta + coll meta + balance +
      // allowance in parallel.
      batch: { multicall: true },
    });
  }

  async idToMarketParams(id: Hex): Promise<MarketParams> {
    const result = await this.publicClient.readContract({
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_ABI,
      functionName: 'idToMarketParams',
      args: [id],
    });
    const params: MarketParams = {
      loanToken: result.loanToken,
      collateralToken: result.collateralToken,
      oracle: result.oracle,
      irm: result.irm,
      lltv: result.lltv,
    };
    const resolvedId = marketParamsToId(params);
    if (resolvedId.toLowerCase() !== id.toLowerCase()) {
      throw new Error('RPC returned market parameters that do not match the requested market ID');
    }
    return params;
  }

  async marketState(id: Hex): Promise<MarketState> {
    const r = await this.publicClient.readContract({
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_ABI,
      functionName: 'market',
      args: [id],
    });
    return {
      totalSupplyAssets: BigInt(r[0]),
      totalSupplyShares: BigInt(r[1]),
      totalBorrowAssets: BigInt(r[2]),
      totalBorrowShares: BigInt(r[3]),
      lastUpdate: BigInt(r[4]),
      fee: BigInt(r[5]),
    };
  }

  async position(id: Hex, user: Address): Promise<{
    supplyShares: bigint;
    borrowShares: bigint;
    collateral: bigint;
  }> {
    const r = await this.publicClient.readContract({
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_ABI,
      functionName: 'position',
      args: [id, user],
    });
    return {
      supplyShares: BigInt(r[0]),
      borrowShares: BigInt(r[1]),
      collateral: BigInt(r[2]),
    };
  }

  // Off-chain supply-asset value for the user at the state read (no interest sim).
  // For dashboard freshness we recommend fetching the same value from the GraphQL
  // API which already applies on-chain accrual in its indexer.
  supplyAssetsFromPosition(
    supplyShares: bigint,
    market: MarketState,
  ): bigint {
    return toAssetsDown(supplyShares, market.totalSupplyAssets, market.totalSupplyShares);
  }

  async erc20Meta(token: Address): Promise<Erc20Meta> {
    const contract = getContract({
      address: token,
      abi: ERC20_ABI,
      client: this.publicClient,
    });
    const [name, symbol, decimals] = await Promise.all([
      contract.read.name().catch(() => 'Unknown'),
      contract.read.symbol().catch(() => '???'),
      contract.read.decimals().catch(() => 18),
    ]);
    return { address: token, name, symbol, decimals: Number(decimals) };
  }

  async erc20Balance(token: Address, owner: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async erc20Allowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    });
  }

  async approve(
    wallet: WalletClient,
    token: Address,
    spender: Address,
    amount: bigint,
    account: Address,
  ): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account,
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
    });
    return wallet.writeContract(request);
  }

  async supply(
    wallet: WalletClient,
    params: MarketParams,
    assets: bigint,
    onBehalf: Address,
  ): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account: onBehalf,
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_ABI,
      functionName: 'supply',
      args: [params, assets, 0n, onBehalf, '0x'],
    });
    return wallet.writeContract(request);
  }

  async withdrawBySharesFull(
    wallet: WalletClient,
    params: MarketParams,
    shares: bigint,
    onBehalf: Address,
    receiver: Address,
  ): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account: onBehalf,
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_ABI,
      functionName: 'withdraw',
      args: [params, 0n, shares, onBehalf, receiver],
    });
    return wallet.writeContract(request);
  }

  async withdrawByAssets(
    wallet: WalletClient,
    params: MarketParams,
    assets: bigint,
    onBehalf: Address,
    receiver: Address,
  ): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account: onBehalf,
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_ABI,
      functionName: 'withdraw',
      args: [params, assets, 0n, onBehalf, receiver],
    });
    return wallet.writeContract(request);
  }

  async nativeBalance(owner: Address): Promise<bigint> {
    return this.publicClient.getBalance({ address: owner });
  }

  async nativeGasReserve(): Promise<bigint> {
    const gasPrice = await this.publicClient.getGasPrice();
    // Reserve enough native currency for the wrap + approve + supply sequence.
    return gasPrice * 350_000n;
  }

  async waitForSuccessfulTransaction(hash: Hex): Promise<void> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`Transaction reverted: ${hash}`);
    }
  }

  async wrapEth(
    wallet: WalletClient,
    weth: Address,
    amount: bigint,
    account: Address,
  ): Promise<Hex> {
    // WETH9.deposit() is payable and accepts msg.value. We don't simulate
    // here because some WETH variants reject zero-gas estimation on deposit —
    // the tx is simple enough to submit directly.
    return wallet.writeContract({
      account,
      address: weth,
      abi: WETH_ABI,
      functionName: 'deposit',
      args: [],
      value: amount,
      chain: this.publicClient.chain,
    });
  }

  async unwrapWeth(
    wallet: WalletClient,
    weth: Address,
    amount: bigint,
    account: Address,
  ): Promise<Hex> {
    const { request } = await this.publicClient.simulateContract({
      account,
      address: weth,
      abi: WETH_ABI,
      functionName: 'withdraw',
      args: [amount],
    });
    return wallet.writeContract(request);
  }
}

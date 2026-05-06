import type { PoolEdge, TokenNode } from './types';

// Sepolia token addresses (verified)
export const TOKENS: Record<string, TokenNode> = {
  WETH: {
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    symbol: 'WETH',
    decimals: 18,
  },
  USDC: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    decimals: 6,
  },
  USDT: {
    address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    symbol: 'USDT',
    decimals: 6,
  },
};

// Static fallback pools — used only when on-chain fetching is unavailable.
// Reserves are snapshots from Sepolia block ~7650000, replaced at runtime by pool-fetcher.
export const POOLS: PoolEdge[] = [
  // Uniswap V2 USDC-WETH
  {
    address: '0x8af3398492E8e64Da6aF148BF5867F543817BD6b',
    protocol: 'uniswap_v2',
    token0: TOKENS.USDC.address,
    token1: TOKENS.WETH.address,
    reserve0: 62037627n,
    reserve1: 8036637613993658n,
    fee: 30,
  },
  // Uniswap V2 USDT-WETH
  {
    address: '0xc7808638742780A98A34724530e6EA434483Da97',
    protocol: 'uniswap_v2',
    token0: TOKENS.USDT.address,
    token1: TOKENS.WETH.address,
    reserve0: 43097696626n,
    reserve1: 15831515199662703n,
    fee: 30,
  },
  // Uniswap V3 USDC-WETH (0.3% fee tier) — virtual reserves from tick + liquidity
  {
    address: '0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50',
    protocol: 'uniswap_v3',
    token0: TOKENS.USDC.address,
    token1: TOKENS.WETH.address,
    reserve0: 73252470286n,
    reserve1: 416836906223n,
    fee: 30,
    extraData: { feeTier: 3000 },
  },
];

export function getTokenBySymbol(symbol: string): TokenNode | undefined {
  return TOKENS[symbol.toUpperCase()];
}

export function getTokenByAddress(address: string): TokenNode | undefined {
  const lower = address.toLowerCase();
  return Object.values(TOKENS).find(
    (t) => t.address.toLowerCase() === lower
  );
}

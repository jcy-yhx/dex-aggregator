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
// Updated to current Sepolia chain state (block ~10838000).
export const POOLS: PoolEdge[] = [
  // Uniswap V2 USDC-WETH
  {
    address: '0x8af3398492E8e64Da6aF148BF5867F543817BD6b',
    protocol: 'uniswap_v2',
    token0: TOKENS.USDC.address,
    token1: TOKENS.WETH.address,
    reserve0: 86359333n,
    reserve1: 5782479538702740n,
    fee: 30,
  },
  // Uniswap V2 USDT-WETH
  {
    address: '0xc7808638742780A98A34724530e6EA434483Da97',
    protocol: 'uniswap_v2',
    token0: TOKENS.USDT.address,
    token1: TOKENS.WETH.address,
    reserve0: 41786702279n,
    reserve1: 16725845461148509n,
    fee: 30,
  },
  // Uniswap V3 USDC-WETH (0.3% fee tier) — virtual reserves from tick + liquidity
  {
    address: '0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50',
    protocol: 'uniswap_v3',
    token0: TOKENS.USDC.address,
    token1: TOKENS.WETH.address,
    reserve0: 980191233985n,
    reserve1: 64843291574437851884n,
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

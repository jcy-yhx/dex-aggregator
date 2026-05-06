import type { Protocol } from './types';

// Verified Sepolia pool addresses
export interface PoolRegistryEntry {
  address: `0x${string}`;
  protocol: Protocol;
  fee: number; // basis points
  extraData?: {
    feeTier?: number;
    coinIndices?: [number, number];
  };
}

export const POOL_REGISTRY: PoolRegistryEntry[] = [
  // Uniswap V2 USDC-WETH
  {
    address: '0x8af3398492E8e64Da6aF148BF5867F543817BD6b',
    protocol: 'uniswap_v2',
    fee: 30,
  },
  // Uniswap V2 USDT-WETH
  {
    address: '0xc7808638742780A98A34724530e6EA434483Da97',
    protocol: 'uniswap_v2',
    fee: 30,
  },
  // Uniswap V3 USDC-WETH (0.3% fee tier)
  {
    address: '0x6Ce0896eAE6D4BD668fDe41BB784548fb8F59b50',
    protocol: 'uniswap_v3',
    fee: 30,
    extraData: { feeTier: 3000 },
  },
];

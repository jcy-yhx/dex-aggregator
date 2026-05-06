import { ROUTER_ADDRESS, V2_ADAPTER, V3_ADAPTER, CURVE_ADAPTER } from './config';
import RouterABI from '@/abis/AggregationRouter.json';
import type { Protocol } from '@/engine/types';

export const AGGREGATION_ROUTER = {
  address: ROUTER_ADDRESS as `0x${string}`,
  abi: RouterABI,
} as const;

export const ADAPTER_ADDRESS: Record<Protocol, `0x${string}`> = {
  uniswap_v2: V2_ADAPTER as `0x${string}`,
  uniswap_v3: V3_ADAPTER as `0x${string}`,
  curve: CURVE_ADAPTER as `0x${string}`,
};

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

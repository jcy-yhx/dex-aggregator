import { createPublicClient, http, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import type { PoolEdge } from './types';
import { POOL_REGISTRY, type PoolRegistryEntry } from './pool-registry';

const V2_PAIR_ABI = [
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getReserves', outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }], stateMutability: 'view', type: 'function' },
] as const;

const V3_POOL_ABI = [
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'fee', outputs: [{ type: 'uint24' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'slot0', outputs: [{ type: 'uint160' }, { type: 'int24' }, { type: 'uint16' }, { type: 'uint16' }, { type: 'uint16' }, { type: 'uint8' }, { type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'liquidity', outputs: [{ type: 'uint128' }], stateMutability: 'view', type: 'function' },
] as const;

let _client: PublicClient | null = null;

function getClient(): PublicClient {
  if (!_client) {
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.gateway.tenderly.co';
    _client = createPublicClient({ chain: sepolia, transport: http(rpcUrl, { timeout: 15000 }) });
  }
  return _client;
}

async function fetchV2Pool(entry: PoolRegistryEntry): Promise<PoolEdge> {
  const client = getClient();
  const [token0, token1, reserves] = await Promise.all([
    client.readContract({ address: entry.address, abi: V2_PAIR_ABI, functionName: 'token0' }),
    client.readContract({ address: entry.address, abi: V2_PAIR_ABI, functionName: 'token1' }),
    client.readContract({ address: entry.address, abi: V2_PAIR_ABI, functionName: 'getReserves' }),
  ]);

  return {
    address: entry.address,
    protocol: 'uniswap_v2',
    token0: token0.toLowerCase(),
    token1: token1.toLowerCase(),
    reserve0: reserves[0],
    reserve1: reserves[1],
    fee: entry.fee,
  };
}

async function fetchV3Pool(entry: PoolRegistryEntry): Promise<PoolEdge> {
  const client = getClient();
  const [token0, token1, fee, slot0, liquidity] = await Promise.all([
    client.readContract({ address: entry.address, abi: V3_POOL_ABI, functionName: 'token0' }),
    client.readContract({ address: entry.address, abi: V3_POOL_ABI, functionName: 'token1' }),
    client.readContract({ address: entry.address, abi: V3_POOL_ABI, functionName: 'fee' }),
    client.readContract({ address: entry.address, abi: V3_POOL_ABI, functionName: 'slot0' }),
    client.readContract({ address: entry.address, abi: V3_POOL_ABI, functionName: 'liquidity' }),
  ]);

  const sqrtPriceX96 = slot0[0];
  const liq = liquidity;
  const Q96 = 2n ** 96n;
  const virtualReserve0 = (liq * Q96) / sqrtPriceX96;
  const virtualReserve1 = (liq * sqrtPriceX96) / Q96;

  return {
    address: entry.address,
    protocol: 'uniswap_v3',
    token0: token0.toLowerCase(),
    token1: token1.toLowerCase(),
    reserve0: virtualReserve0,
    reserve1: virtualReserve1,
    fee: Number(fee) / 100,
    extraData: entry.extraData as PoolEdge['extraData'],
  };
}

async function fetchAllPools(): Promise<PoolEdge[]> {
  return Promise.all(
    POOL_REGISTRY.map((entry) =>
      entry.protocol === 'uniswap_v3' ? fetchV3Pool(entry) : fetchV2Pool(entry)
    )
  );
}

let _cachedPools: PoolEdge[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 30000;

export async function getPools(): Promise<PoolEdge[]> {
  if (_cachedPools && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedPools;
  }
  _cachedPools = await fetchAllPools();
  _cacheTime = Date.now();
  return _cachedPools;
}

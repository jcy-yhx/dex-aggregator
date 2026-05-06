import type { PoolEdge } from './types';

export function getAmountOut(
  pool: PoolEdge,
  tokenIn: string,
  amountIn: bigint
): bigint {
  switch (pool.protocol) {
    case 'uniswap_v2':
      return getAmountOutV2(pool, tokenIn, amountIn);
    case 'uniswap_v3':
      return getAmountOutV3(pool, tokenIn, amountIn);
    case 'curve':
      return getAmountOutCurve(pool, tokenIn, amountIn);
    default:
      return 0n;
  }
}

function getAmountOutV2(pool: PoolEdge, tokenIn: string, amountIn: bigint): bigint {
  const [reserveIn, reserveOut] =
    tokenIn.toLowerCase() === pool.token0.toLowerCase()
      ? [pool.reserve0, pool.reserve1]
      : [pool.reserve1, pool.reserve0];

  if (reserveIn === 0n || reserveOut === 0n) return 0n;

  const amountInWithFee = amountIn * BigInt(10000 - pool.fee);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;

  return numerator / denominator;
}

function getAmountOutV3(pool: PoolEdge, tokenIn: string, amountIn: bigint): bigint {
  const [reserveIn, reserveOut] =
    tokenIn.toLowerCase() === pool.token0.toLowerCase()
      ? [pool.reserve0, pool.reserve1]
      : [pool.reserve1, pool.reserve0];

  if (reserveIn === 0n || reserveOut === 0n) return 0n;

  // Simplified V3: use constant-product with fee, same formula as V2
  const feeBps = pool.extraData?.feeTier ? pool.extraData.feeTier / 100 : pool.fee;
  const amountInWithFee = amountIn * BigInt(10000 - feeBps);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;

  return numerator / denominator;
}

function getAmountOutCurve(pool: PoolEdge, tokenIn: string, amountIn: bigint): bigint {
  const [reserveIn, reserveOut] =
    tokenIn.toLowerCase() === pool.token0.toLowerCase()
      ? [pool.reserve0, pool.reserve1]
      : [pool.reserve1, pool.reserve0];

  if (reserveIn === 0n || reserveOut === 0n) return 0n;

  // Simplified stableswap: 1:1 exchange with fee (0.04% default)
  const fee = pool.fee || 4; // 0.04% default
  return amountIn - (amountIn * BigInt(fee)) / 10000n;
}

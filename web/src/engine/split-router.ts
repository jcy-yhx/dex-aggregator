import type { PoolEdge, RoutePath } from './types';
import { getAmountOut } from './pricing';
import { findPaths, type FoundPath } from './pathfinder';
import { buildGraph } from './graph';

const SPLIT_GRANULARITY = 20; // number of increments

export interface SplitAllocation {
  pathIndex: number;
  amount: bigint;
  expectedOutput: bigint;
  percentage: number;
}

export function allocateSplit(
  pools: PoolEdge[],
  srcToken: string,
  dstToken: string,
  totalAmountIn: bigint
): SplitAllocation[] {
  const adj = buildGraph(pools);
  const paths = findPaths(pools, adj, srcToken, dstToken, totalAmountIn);

  if (paths.length === 0) return [];
  if (paths.length === 1) {
    return [
      {
        pathIndex: 0,
        amount: totalAmountIn,
        expectedOutput: paths[0].output,
        percentage: 100,
      },
    ];
  }

  // Greedy marginal-rate allocation
  const increment = totalAmountIn / BigInt(SPLIT_GRANULARITY);
  if (increment === 0n) {
    // Amount too small to split
    return [
      {
        pathIndex: 0,
        amount: totalAmountIn,
        expectedOutput: paths[0].output,
        percentage: 100,
      },
    ];
  }

  const allocations: bigint[] = new Array(paths.length).fill(0n);
  let remaining = totalAmountIn;

  for (let step = 0; step < SPLIT_GRANULARITY && remaining > 0n; step++) {
    let bestPath = 0;
    let bestMarginal = 0n;
    const inc = step === SPLIT_GRANULARITY - 1 ? remaining : increment;

    for (let k = 0; k < paths.length; k++) {
      const newAlloc = allocations[k] + inc;
      const newOutput = computePathOutput(pools, paths[k], newAlloc);
      const prevOutput = computePathOutput(pools, paths[k], allocations[k]);
      const marginal = newOutput - prevOutput;

      if (marginal > bestMarginal) {
        bestMarginal = marginal;
        bestPath = k;
      }
    }

    allocations[bestPath] += inc;
    remaining -= inc;
  }

  // Verify: the first path should always get some allocation
  if (paths.length > 1 && allocations.filter((a) => a > 0n).length <= 1) {
    // Fallback: all to the best path
    allocations[0] = totalAmountIn;
    for (let k = 1; k < allocations.length; k++) allocations[k] = 0n;
  }

  const totalAllocated = allocations.reduce((s, a) => s + a, 0n);
  const scale = totalAmountIn > 0n
    ? Number(totalAmountIn) / Number(totalAllocated)
    : 1;

  return allocations
    .map((amount, i) => ({
      pathIndex: i,
      amount,
      expectedOutput: computePathOutput(pools, paths[i], amount),
      percentage: totalAmountIn > 0n
        ? Math.round((Number(amount * 10000n / totalAmountIn)) / 100)
        : 0,
    }))
    .filter((a) => a.amount > 0n);
}

function computePathOutput(
  pools: PoolEdge[],
  path: FoundPath,
  amountIn: bigint
): bigint {
  let currentAmount = amountIn;
  for (let i = 0; i < path.pools.length; i++) {
    const pool = pools[path.pools[i]];
    if (!pool) return 0n;
    const tokenIn = path.tokens[i];
    currentAmount = getAmountOut(pool, tokenIn, currentAmount);
    if (currentAmount === 0n) return 0n;
  }
  return currentAmount;
}

export function allocationsToRoutePaths(
  allocations: SplitAllocation[],
  paths: FoundPath[],
  pools: PoolEdge[],
  totalAmountIn: bigint
): RoutePath[] {
  const totalOutput = allocations.reduce((s, a) => s + a.expectedOutput, 0n);

  return allocations.map((alloc) => {
    const path = paths[alloc.pathIndex];
    return {
      path: path.tokens,
      protocols: path.pools.map((pi) => pools[pi]?.protocol ?? 'uniswap_v2'),
      pools: path.pools.map((pi) => pools[pi]?.address ?? ''),
      percentage: alloc.percentage,
      expectedOutput: alloc.expectedOutput.toString(),
      steps: path.pools.map((pi, idx) => {
        const stepAmount = idx === 0 ? alloc.amount.toString() : '0';
        console.log('[allocationsToRoutePaths] idx:', idx, 'alloc.amount:', alloc.amount.toString(), 'alloc.expectedOutput:', alloc.expectedOutput.toString(), 'stepAmount:', stepAmount);
        return {
          pool: pools[pi]?.address ?? '',
          adapter: '', // populated later with contract addresses
          tokenIn: path.tokens[idx],
          tokenOut: path.tokens[idx + 1],
          amount: stepAmount,
          extraData: encodeExtraData(pools[pi]),
        };
      }),
    };
  });
}

function encodeExtraData(pool: PoolEdge): string {
  if (pool.protocol === 'curve' && pool.extraData?.coinIndices) {
    // Encode as (int128,int128)
    const [i, j] = pool.extraData.coinIndices;
    // Simple ABI encoding for (int128,int128)
    const iHex = BigInt(i).toString(16).padStart(64, '0');
    const jHex = BigInt(j).toString(16).padStart(64, '0');
    return `0x${iHex}${jHex}`;
  }
  return '0x';
}

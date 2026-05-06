import type { PoolEdge } from './types';
import { getAmountOut } from './pricing';
import { AdjacencyEntry, getPoolEdges } from './graph';

const MAX_HOPS = 4;
const TOP_K = 3;

interface PathStep {
  token: string;
  poolIndex: number;
}

export interface FoundPath {
  tokens: string[];
  pools: number[];
  output: bigint;
}

export function findPaths(
  pools: PoolEdge[],
  adj: Map<string, AdjacencyEntry[]>,
  srcToken: string,
  dstToken: string,
  amountIn: bigint
): FoundPath[] {
  const src = srcToken.toLowerCase();
  const dst = dstToken.toLowerCase();

  const dist = new Map<string, bigint>();
  const prev = new Map<string, PathStep[]>();

  for (const token of adj.keys()) {
    dist.set(token, 0n);
    prev.set(token, []);
  }
  dist.set(src, amountIn);

  // Bellman-Ford iterative relaxation
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const updated = new Map<string, bigint>();

    for (const [token, currentAmount] of dist) {
      if (currentAmount === 0n) continue;

      for (const edge of getPoolEdges(adj, token)) {
        const pool = pools[edge.poolIndex];
        if (!pool) continue;

        const out = getAmountOut(pool, token, currentAmount);
        if (out <= (updated.get(edge.neighbour) ?? 0n)) continue;

        updated.set(edge.neighbour, out);
        const steps = [
          ...(prev.get(token) ?? []),
          { token: edge.neighbour, poolIndex: edge.poolIndex },
        ];

        if (out > (dist.get(edge.neighbour) ?? 0n)) {
          dist.set(edge.neighbour, out);
          prev.set(edge.neighbour, steps);
        }
      }
    }

    if (updated.size === 0) break;
  }

  // Reconstruct paths to destination
  const allPaths: FoundPath[] = [];
  const dstPrev = prev.get(dst) ?? [];

  if (dstPrev.length > 0) {
    // Reconstruct single best path
    const tokens = [src];
    const poolIndices: number[] = [];
    for (const step of dstPrev) {
      tokens.push(step.token);
      poolIndices.push(step.poolIndex);
    }
    allPaths.push({
      tokens,
      pools: poolIndices,
      output: dist.get(dst) ?? 0n,
    });

    // Also find alternative paths by blocking used pools
    for (let k = 1; k < TOP_K && k < allPaths[0].pools.length; k++) {
      const altPath = findAlternativePath(
        pools,
        adj,
        src,
        dst,
        amountIn,
        allPaths.map((p) => p.pools)
      );
      if (altPath && altPath.output > 0n) {
        allPaths.push(altPath);
      } else {
        break;
      }
    }
  }

  return allPaths.filter((p) => p.output > 0n);
}

function findAlternativePath(
  pools: PoolEdge[],
  adj: Map<string, AdjacencyEntry[]>,
  src: string,
  dst: string,
  amountIn: bigint,
  blockedPoolSets: number[][]
): FoundPath | null {
  const blocked = new Set<number>();
  for (const set of blockedPoolSets) {
    for (const idx of set) blocked.add(idx);
  }

  const dist = new Map<string, bigint>();
  const prev = new Map<string, PathStep[]>();

  for (const token of adj.keys()) {
    dist.set(token, 0n);
    prev.set(token, []);
  }
  dist.set(src, amountIn);

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const updated = new Map<string, bigint>();

    for (const [token, currentAmount] of dist) {
      if (currentAmount === 0n) continue;

      for (const edge of getPoolEdges(adj, token)) {
        if (blocked.has(edge.poolIndex)) continue;
        const pool = pools[edge.poolIndex];
        if (!pool) continue;

        const out = getAmountOut(pool, token, currentAmount);
        if (out <= (updated.get(edge.neighbour) ?? 0n)) continue;

        updated.set(edge.neighbour, out);
        const steps = [
          ...(prev.get(token) ?? []),
          { token: edge.neighbour, poolIndex: edge.poolIndex },
        ];

        if (out > (dist.get(edge.neighbour) ?? 0n)) {
          dist.set(edge.neighbour, out);
          prev.set(edge.neighbour, steps);
        }
      }
    }

    if (updated.size === 0) break;
  }

  const dstPrev = prev.get(dst) ?? [];
  if (dstPrev.length === 0) return null;

  const tokens = [src];
  const poolIndices: number[] = [];
  for (const step of dstPrev) {
    tokens.push(step.token);
    poolIndices.push(step.poolIndex);
  }

  return {
    tokens,
    pools: poolIndices,
    output: dist.get(dst) ?? 0n,
  };
}

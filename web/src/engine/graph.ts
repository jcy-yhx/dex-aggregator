import type { PoolEdge } from './types';

export interface AdjacencyEntry {
  poolIndex: number;
  neighbour: string;
}

export function buildGraph(
  pools: PoolEdge[]
): Map<string, AdjacencyEntry[]> {
  const adj = new Map<string, AdjacencyEntry[]>();

  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    const t0 = pool.token0.toLowerCase();
    const t1 = pool.token1.toLowerCase();

    if (!adj.has(t0)) adj.set(t0, []);
    if (!adj.has(t1)) adj.set(t1, []);

    adj.get(t0)!.push({ poolIndex: i, neighbour: t1 });
    adj.get(t1)!.push({ poolIndex: i, neighbour: t0 });
  }

  return adj;
}

export function getPoolEdges(
  adj: Map<string, AdjacencyEntry[]>,
  token: string
): AdjacencyEntry[] {
  return adj.get(token.toLowerCase()) ?? [];
}

import type { QuoteRequest, QuoteResponse, PoolEdge } from './types';
import { POOLS, getTokenByAddress } from './pool-data-static';
import { buildGraph } from './graph';
import { findPaths } from './pathfinder';
import { allocateSplit, allocationsToRoutePaths } from './split-router';

export async function getQuote(
  req: QuoteRequest,
  pools?: PoolEdge[]
): Promise<QuoteResponse> {
  const activePools = pools ?? POOLS;

  const srcToken = getTokenByAddress(req.srcToken);
  const dstToken = getTokenByAddress(req.dstToken);

  if (!srcToken || !dstToken) {
    throw new Error('Unsupported token');
  }

  const amountIn = BigInt(req.amountIn);
  const adj = buildGraph(activePools);
  const paths = findPaths(
    activePools,
    adj,
    req.srcToken,
    req.dstToken,
    amountIn
  );

  if (paths.length === 0) {
    throw new Error('No route found between these tokens');
  }

  const allocations = allocateSplit(
    activePools,
    req.srcToken,
    req.dstToken,
    amountIn
  );

  const routes = allocationsToRoutePaths(allocations, paths, activePools, amountIn);
  const totalOutput = BigInt(
    allocations.reduce((sum, a) => sum + a.expectedOutput, 0n).toString()
  );

  // Price impact: how much worse than perfect rate
  const perfectRate = Number(amountIn);
  const actualRate = Number(totalOutput);
  const priceImpact =
    perfectRate > 0
      ? Math.max(0, ((perfectRate - actualRate) / perfectRate) * 100)
      : 0;

  return {
    routes,
    totalOutput: totalOutput.toString(),
    priceImpact: Math.round(priceImpact * 100) / 100,
  };
}

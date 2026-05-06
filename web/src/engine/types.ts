export interface TokenNode {
  address: string;
  symbol: string;
  decimals: number;
}

export type Protocol = 'uniswap_v2' | 'uniswap_v3' | 'curve';

export interface PoolEdge {
  address: string;
  protocol: Protocol;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  fee: number; // in basis points (30 = 0.3%)
  extraData?: {
    feeTier?: number; // V3 fee tier (e.g. 3000 = 0.3%)
    coinIndices?: [number, number]; // Curve coin indices
  };
}

export interface QuoteRequest {
  srcToken: string;
  dstToken: string;
  amountIn: string; // raw amount as string (bigint)
}

export interface RoutePath {
  path: string[];
  protocols: Protocol[];
  pools: string[];
  percentage: number; // 0-100
  expectedOutput: string;
  steps: RouteStepSerialized[];
}

export interface QuoteResponse {
  routes: RoutePath[];
  totalOutput: string;
  priceImpact: number;
}

export interface RouteStepSerialized {
  pool: string;
  adapter: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  extraData: string; // hex-encoded
}

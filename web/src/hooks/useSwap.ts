'use client';

import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useAccount,
} from 'wagmi';
import { AGGREGATION_ROUTER, ADAPTER_ADDRESS } from '@/lib/contracts';
import type { QuoteResponse } from '@/engine/types';

const WETH = (process.env.NEXT_PUBLIC_WETH_ADDRESS || '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14') as `0x${string}`;

export function useSwap() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<'idle' | 'approving' | 'swapping' | 'done' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeSwap = useCallback(
    async (quote: QuoteResponse, srcToken: `0x${string}`, amountIn: bigint, slippage: number) => {
      if (!address) return;

      setStatus('swapping');
      setError(null);

      try {
        const isNativeETH = srcToken.toLowerCase() === WETH.toLowerCase();

        // Build swap calldata
        const desc = {
          srcToken,
          dstToken: quote.routes[0].path[quote.routes[0].path.length - 1] as `0x${string}`,
          dstReceiver: address,
          amount: amountIn,
          minReturnAmount: BigInt(quote.totalOutput) * BigInt(10000 - Math.floor(slippage * 100)) / 10000n,
          flags: 0n,
          permit: '0x' as `0x${string}`,
        };

        const routes = quote.routes.map((route) =>
          route.steps.map((step, idx) => ({
            pool: step.pool as `0x${string}`,
            adapter: ADAPTER_ADDRESS[route.protocols[idx]],
            tokenIn: step.tokenIn as `0x${string}`,
            tokenOut: step.tokenOut as `0x${string}`,
            amount: BigInt(step.amount),
            extraData: step.extraData as `0x${string}`,
          }))
        );

        const hash = await writeContractAsync({
          address: AGGREGATION_ROUTER.address,
          abi: AGGREGATION_ROUTER.abi,
          functionName: 'swap',
          args: [desc, routes],
          value: isNativeETH ? amountIn : 0n,
          gas: 5_000_000n,
        });

        setTxHash(hash);
        setStatus('done');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Swap failed');
        setStatus('error');
      }
    },
    [address, writeContractAsync]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return { status, txHash, error, executeSwap, reset };
}

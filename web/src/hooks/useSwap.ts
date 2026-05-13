'use client';

import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useAccount,
} from 'wagmi';
import { AGGREGATION_ROUTER, ADAPTER_ADDRESS, ERC20_ABI } from '@/lib/contracts';
import type { QuoteResponse } from '@/engine/types';
import { maxUint256 } from 'viem';

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

      setError(null);

      try {
        const isNativeETH = srcToken.toLowerCase() === WETH.toLowerCase();

        // If not using native ETH, check and handle token approval
        if (!isNativeETH) {
          setStatus('approving');
          const allowance = await fetchAllowance(srcToken, address, AGGREGATION_ROUTER.address);
          if (allowance < amountIn) {
            const hash = await writeContractAsync({
              address: srcToken,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [AGGREGATION_ROUTER.address, maxUint256],
              gas: 100_000n,
            });
            setTxHash(hash);
          }
        }

        setStatus('swapping');

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

async function fetchAllowance(
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`
): Promise<bigint> {
  try {
    const { createPublicClient, http } = await import('viem');
    const { sepolia } = await import('viem/chains');
    const client = createPublicClient({
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    });
    const allowance = await client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    });
    return allowance as bigint;
  } catch {
    return 0n;
  }
}

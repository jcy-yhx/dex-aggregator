'use client';

import { useReadContract, useAccount } from 'wagmi';
import { ERC20_ABI } from '@/lib/contracts';
import { getTokenByAddress } from '@/lib/tokens';
import { formatAmount } from '@/lib/utils';
import { formatUnits } from 'viem';

export function useTokenBalances(tokenAddress: string | null) {
  const { address } = useAccount();

  const { data: rawBalance, isLoading } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });

  const token = tokenAddress ? getTokenByAddress(tokenAddress) : null;

  const balance =
    rawBalance && token
      ? formatAmount(rawBalance.toString(), token.decimals)
      : null;

  return { balance, loading: isLoading };
}

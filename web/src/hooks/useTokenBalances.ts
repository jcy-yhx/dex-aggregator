'use client';

import { useReadContract, useBalance, useAccount } from 'wagmi';
import { ERC20_ABI } from '@/lib/contracts';
import { getTokenByAddress } from '@/lib/tokens';
import { formatAmount } from '@/lib/utils';

const WETH = (process.env.NEXT_PUBLIC_WETH_ADDRESS || '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14') as `0x${string}`;

export function useTokenBalances(tokenAddress: string | null) {
  const { address } = useAccount();

  const { data: rawBalance, isLoading: erc20Loading } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!tokenAddress && !!address },
  });

  // For WETH, also fetch native ETH balance since users hold ETH (not WETH)
  const isWeth = tokenAddress?.toLowerCase() === WETH.toLowerCase();
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: isWeth && !!address },
  });

  const token = tokenAddress ? getTokenByAddress(tokenAddress) : null;

  if (!token) return { balance: null, loading: erc20Loading };

  let balance: string | null = null;
  if (isWeth) {
    // Show native ETH as WETH balance (since the Router auto-wraps ETH)
    const wethRaw = (rawBalance as bigint | undefined) ?? 0n;
    const ethRaw = ethBalance?.value ?? 0n;
    const total = wethRaw + ethRaw;
    balance = formatAmount(total.toString(), token.decimals);
  } else if (rawBalance) {
    balance = formatAmount(rawBalance.toString(), token.decimals);
  }

  return { balance, loading: erc20Loading };
}

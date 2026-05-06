'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { TokenSelect } from './TokenSelect';
import { RouteDisplay } from './RouteDisplay';
import { SlippageSettings } from './SlippageSettings';
import { useQuote } from '@/hooks/useQuote';
import { useSwap } from '@/hooks/useSwap';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import type { TokenInfo } from '@/lib/tokens';
import { parseAmount, formatAmount } from '@/lib/utils';

export function SwapForm() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [srcToken, setSrcToken] = useState<TokenInfo | null>(null);
  const [dstToken, setDstToken] = useState<TokenInfo | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  const amountInRaw =
    srcToken && amountInput ? parseAmount(amountInput, srcToken.decimals).toString() : '0';

  const { quote, loading: quoteLoading } = useQuote(
    srcToken?.address ?? null,
    dstToken?.address ?? null,
    amountInRaw
  );

  const { balance: srcBalance } = useTokenBalances(srcToken?.address ?? null);

  const { status, txHash, error: swapError, executeSwap, reset } = useSwap();

  const handleSwapTokens = useCallback(() => {
    setSrcToken(dstToken);
    setDstToken(srcToken);
    setAmountInput('');
  }, [srcToken, dstToken]);

  const handleSwap = useCallback(async () => {
    if (!quote || !srcToken) return;
    reset();
    const amountIn = parseAmount(amountInput, srcToken.decimals);
    await executeSwap(quote, srcToken.address as `0x${string}`, amountIn, slippage);
  }, [quote, srcToken, amountInput, slippage, executeSwap, reset]);

  const expectedOutput =
    quote && dstToken ? formatAmount(quote.totalOutput, dstToken.decimals) : '';

  // Show connect prompt until client-side hydration completes
  if (!mounted || !isConnected) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-5 shadow-lg shadow-violet-500/25">
            DA
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">DEX Aggregator</h2>
          <p className="text-slate-500 mb-7 leading-relaxed">
            Connect your wallet to get the best swap rates aggregated across multiple DEXs.
          </p>
          <div className="flex justify-center">
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-xl font-bold text-slate-800">Swap</h2>
          <SlippageSettings slippage={slippage} onSlippageChange={setSlippage} />
        </div>

        <div className="px-5 pb-1">
          {/* Source token */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-all focus-within:border-blue-300 focus-within:shadow-sm">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-500 font-medium">You pay</span>
              {srcBalance && (
                <button
                  type="button"
                  onClick={() => {
                    if (srcToken) {
                      const val = Number(srcBalance) * 0.99;
                      setAmountInput(val > 0 ? val.toFixed(srcToken.decimals > 8 ? 6 : 2) : '');
                    }
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                >
                  Balance: {srcBalance.slice(0, 12)}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="0.0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="flex-1 bg-transparent text-3xl font-semibold outline-none text-slate-800 placeholder:text-slate-300"
              />
              <TokenSelect selected={srcToken} onSelect={setSrcToken} label="Pay with" />
            </div>
          </div>

          {/* Swap direction toggle */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="bg-white border border-slate-200 rounded-xl p-2.5 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100 transition-all duration-200 group"
            >
              <svg
                className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </button>
          </div>

          {/* Destination token */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-500 font-medium">You receive</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-3xl font-semibold text-slate-800 min-h-[2.25rem]">
                {quoteLoading ? (
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : expectedOutput ? (
                  expectedOutput.slice(0, 14)
                ) : (
                  <span className="text-slate-300">0.0</span>
                )}
              </div>
              <TokenSelect selected={dstToken} onSelect={setDstToken} label="Receive" />
            </div>
          </div>
        </div>

        {/* Route display */}
        {quote && (
          <div className="px-5">
            <RouteDisplay quote={quote} />
          </div>
        )}

        {/* Error */}
        {swapError && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {swapError}
          </div>
        )}

        {/* Swap button */}
        <div className="p-5">
          <button
            onClick={handleSwap}
            disabled={!quote || !srcToken || !dstToken || !amountInput || status === 'swapping'}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg shadow-violet-500/20 disabled:shadow-none active:scale-[0.99]"
          >
            {status === 'idle' && 'Swap'}
            {status === 'swapping' && (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirming...
              </span>
            )}
            {status === 'done' && '✓ Swapped'}
            {status === 'error' && 'Try Again'}
          </button>

          {txHash && (
            <p className="mt-2 text-xs text-center text-slate-400 truncate font-mono">
              {txHash.slice(0, 20)}...{txHash.slice(-8)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

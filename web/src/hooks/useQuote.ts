'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuoteResponse } from '@/engine/types';

export function useQuote(
  srcToken: string | null,
  dstToken: string | null,
  amountIn: string
) {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!srcToken || !dstToken || !amountIn || amountIn === '0') {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ srcToken, dstToken, amountIn }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get quote');
      }

      const data: QuoteResponse = await res.json();
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [srcToken, dstToken, amountIn]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 300);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  return { quote, loading, error, refetch: fetchQuote };
}

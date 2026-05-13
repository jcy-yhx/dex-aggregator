import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/engine';
import { POOLS } from '@/engine/pool-data-static';
import { getPools } from '@/engine/pool-fetcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { srcToken, dstToken, amountIn } = body;

    if (!srcToken || !dstToken || !amountIn) {
      return NextResponse.json(
        { error: 'Missing required fields: srcToken, dstToken, amountIn' },
        { status: 400 }
      );
    }

    // Fetch live on-chain pool data, fall back to static data on failure
    let pools;
    try {
      pools = await getPools();
    } catch {
      pools = POOLS;
    }
    const quote = await getQuote({ srcToken, dstToken, amountIn }, pools);

    // DEBUG: log step amounts
    console.log('[quote] srcToken:', srcToken, 'dstToken:', dstToken, 'amountIn:', amountIn);
    console.log('[quote] totalOutput:', quote.totalOutput);
    for (const r of quote.routes) {
      console.log('[quote] route expectedOutput:', r.expectedOutput, 'steps:');
      for (const s of r.steps) {
        console.log('  step amount:', s.amount, 'tokenIn:', s.tokenIn, 'tokenOut:', s.tokenOut);
      }
    }

    return NextResponse.json(quote);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

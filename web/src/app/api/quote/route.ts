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
    return NextResponse.json(quote);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

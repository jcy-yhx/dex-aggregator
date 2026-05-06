'use client';

import type { QuoteResponse } from '@/engine/types';

interface RouteDisplayProps {
  quote: QuoteResponse;
}

const protocolBadge: Record<string, { color: string; label: string }> = {
  uniswap_v2: { color: 'bg-pink-100 text-pink-700 border-pink-200', label: 'V2' },
  uniswap_v3: { color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'V3' },
  curve: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Curve' },
};

export function RouteDisplay({ quote }: RouteDisplayProps) {
  return (
    <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Route</h3>
        {quote.routes.length > 1 && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
            {quote.routes.length} routes
          </span>
        )}
      </div>

      {quote.routes.map((route, i) => (
        <div key={i} className="mb-3 last:mb-0">
          {quote.routes.length > 1 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500 w-12">Route {i + 1}</span>
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-violet-500 rounded-full transition-all"
                  style={{ width: `${Math.max(route.percentage, 3)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600 w-10 text-right">
                {route.percentage}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {route.path.map((token, j) => (
              <span key={j} className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-200">
                  {token.slice(0, 5)}...{token.slice(-3)}
                </span>
                {j < route.protocols.length && (
                  <>
                    <svg className="w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                    </svg>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                        protocolBadge[route.protocols[j]]?.color || 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {protocolBadge[route.protocols[j]]?.label || route.protocols[j]}
                    </span>
                    <svg className="w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                    </svg>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm">
        <span className="text-slate-500">Price Impact</span>
        <span
          className={`font-semibold tabular-nums ${
            quote.priceImpact < 1
              ? 'text-emerald-600'
              : quote.priceImpact < 3
                ? 'text-amber-600'
                : 'text-red-600'
          }`}
        >
          {quote.priceImpact < 0.01 ? '<0.01' : quote.priceImpact}%
        </span>
      </div>
    </div>
  );
}

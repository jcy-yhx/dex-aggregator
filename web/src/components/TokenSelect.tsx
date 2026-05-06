'use client';

import { useState, useMemo } from 'react';
import type { TokenInfo } from '@/lib/tokens';
import { TOKEN_LIST } from '@/lib/tokens';

interface TokenSelectProps {
  selected: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  label: string;
}

const tokenColors: Record<string, string> = {
  WETH: 'from-purple-500 to-indigo-600',
  USDC: 'from-blue-500 to-cyan-500',
  USDT: 'from-emerald-500 to-teal-600',
};

const tokenIcons: Record<string, string> = {
  WETH: 'Ξ',
  USDC: '$',
  USDT: '₮',
};

export function TokenSelect({ selected, onSelect, label }: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return TOKEN_LIST;
    const q = search.toLowerCase();
    return TOKEN_LIST.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    );
  }, [search]);

  const color = selected ? tokenColors[selected.symbol] || 'from-slate-500 to-slate-600' : '';
  const icon = selected ? tokenIcons[selected.symbol] || selected.symbol[0] : '';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white hover:bg-slate-50 rounded-2xl px-3 py-2.5 border border-slate-200 hover:border-slate-300 shadow-sm transition-all duration-200"
      >
        {selected ? (
          <>
            <div
              className={`w-7 h-7 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
            >
              {icon}
            </div>
            <span className="font-semibold text-slate-800">{selected.symbol}</span>
          </>
        ) : (
          <span className="text-slate-400 font-medium">{label}</span>
        )}
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/60 w-80 max-h-96 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-3 border-b border-slate-100">
              <input
                type="text"
                placeholder="Search token..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 text-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none border border-slate-100 focus:border-blue-300 transition-colors placeholder:text-slate-400"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-64">
              {filtered.map((token) => {
                const tc = tokenColors[token.symbol] || 'from-slate-500 to-slate-600';
                const ti = tokenIcons[token.symbol] || token.symbol[0];
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => {
                      onSelect(token);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tc} flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0`}
                    >
                      {ti}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{token.symbol}</div>
                      <div className="text-xs text-slate-400">{token.name}</div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm">No tokens found</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

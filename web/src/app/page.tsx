'use client';

import { SwapForm } from '@/components/SwapForm';
import { WalletButton } from '@/components/WalletButton';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/25">
              DA
            </div>
            <div>
              <span className="font-bold text-lg text-slate-800">DEX Aggregator</span>
              <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                Sepolia
              </span>
            </div>
          </div>
          <WalletButton />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 pt-16 pb-24">
        <SwapForm />
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">How it works</h3>
          <div className="grid gap-4">
            {[
              {
                step: '1',
                title: 'Pathfinder',
                desc: 'Bellman-Ford algorithm builds a liquidity graph across Uniswap V2 & V3 pools to discover the most efficient swap routes.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                step: '2',
                title: 'Split Router',
                desc: 'Greedy marginal-rate optimization splits your trade across multiple routes to minimize price impact.',
                color: 'from-violet-500 to-purple-500',
              },
              {
                step: '3',
                title: 'AggregationRouter',
                desc: 'Single atomic transaction executes all routes via delegatecall with slippage protection enforced on-chain.',
                color: 'from-fuchsia-500 to-pink-500',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 items-start">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md`}
                >
                  {item.step}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          Sepolia Testnet · For demonstration purposes only
        </p>
      </footer>
    </div>
  );
}

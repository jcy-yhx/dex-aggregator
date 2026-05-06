'use client';

interface SlippageSettingsProps {
  slippage: number;
  onSlippageChange: (value: number) => void;
}

const PRESETS = [0.1, 0.5, 1.0];

export function SlippageSettings({ slippage, onSlippageChange }: SlippageSettingsProps) {
  const isCustom = !PRESETS.includes(slippage);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400 text-xs font-medium">Slippage</span>
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSlippageChange(p)}
            className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
              slippage === p
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p}%
          </button>
        ))}
        <input
          type="number"
          value={isCustom ? slippage : ''}
          placeholder="Custom"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onSlippageChange(v);
          }}
          className={`w-14 px-2 py-1 rounded-[10px] text-xs font-medium outline-none transition-all duration-200 ${
            isCustom
              ? 'bg-white text-slate-800 shadow-sm'
              : 'bg-transparent text-slate-400 placeholder:text-slate-400'
          }`}
          min="0.01"
          step="0.1"
        />
      </div>
    </div>
  );
}

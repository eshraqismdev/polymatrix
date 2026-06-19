"use client";

import { useTradingStore } from "@/lib/store";

const LAYERS = [
  { key: "showSMC", label: "SMC" },
  { key: "showFVG", label: "FVG" },
  { key: "showOB", label: "OB" },
  { key: "showLiquidity", label: "LIQ" },
  { key: "showVolume", label: "VOL" },
  { key: "showOrderflow", label: "OFLW" },
] as const;

export default function LayerControl() {
  const store = useTradingStore();
  return (
    <div className="matrix-panel h-7 flex items-center gap-1 px-2">
      <span className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest mr-1">LAYERS:</span>
      {LAYERS.map((l) => {
        const active = store[l.key];
        return (
          <button
            key={l.key}
            onClick={() => store.toggleLayer(l.key)}
            className={`px-1.5 py-0.5 text-[9px] font-bold tracking-widest ${
              active
                ? "bg-[var(--matrix-green)] text-black"
                : "text-[var(--matrix-green-dim)] border border-[rgba(0,255,127,0.2)]"
            }`}
            style={active ? { boxShadow: "0 0 4px rgba(0,255,127,0.5)" } : {}}
          >
            {l.label}
          </button>
        );
      })}
      <span className="mx-2 text-[var(--matrix-green-dim)]">|</span>
      <button
        onClick={() => store.toggleMatrixRain()}
        className={`px-1.5 py-0.5 text-[9px] font-bold tracking-widest ${
          store.showMatrixRain
            ? "bg-[var(--matrix-cyan)] text-black"
            : "text-[var(--matrix-green-dim)] border border-[rgba(0,255,127,0.2)]"
        }`}
      >
        RAIN
      </button>
    </div>
  );
}

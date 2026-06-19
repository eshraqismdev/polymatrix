"use client";

import { useMemo } from "react";
import { useTradingStore } from "@/lib/store";
import { analyzeSMC } from "@/lib/smc";
import { fmtPrice, fmtTime } from "@/lib/format";
import type { Structure } from "@/lib/types";

function StructureRow({ s }: { s: Structure }) {
  const cfg: Record<string, { color: string; icon: string }> = {
    BOS_BULL: { color: "var(--matrix-green)", icon: "↑" },
    BOS_BEAR: { color: "var(--matrix-red)", icon: "↓" },
    CHoCH_BULL: { color: "var(--matrix-green)", icon: "↑★" },
    CHoCH_BEAR: { color: "var(--matrix-red)", icon: "↓★" },
    FVG_BULL: { color: "var(--matrix-green)", icon: "▭" },
    FVG_BEAR: { color: "var(--matrix-red)", icon: "▭" },
    OB_BULL: { color: "var(--matrix-green)", icon: "▦" },
    OB_BEAR: { color: "var(--matrix-red)", icon: "▦" },
    LIQ_BSL: { color: "var(--matrix-amber)", icon: "≡" },
    LIQ_SSL: { color: "var(--matrix-cyan)", icon: "≡" },
    SWEEP_BSL: { color: "var(--matrix-magenta)", icon: "◉" },
    SWEEP_SSL: { color: "var(--matrix-magenta)", icon: "◉" },
    EQH: { color: "var(--matrix-amber)", icon: "=" },
    EQL: { color: "var(--matrix-cyan)", icon: "=" },
  };
  const c = cfg[s.kind] ?? { color: "var(--matrix-green)", icon: "•" };
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 border-b border-[rgba(0,255,127,0.06)] hover:bg-[rgba(0,255,127,0.04)] text-[10px]"
      style={{ fontFamily: "var(--font-jetbrains), monospace" }}
    >
      <span style={{ color: c.color, textShadow: `0 0 4px ${c.color}` }} className="font-bold">
        {c.icon}
      </span>
      <span style={{ color: c.color }} className="font-bold tracking-wider min-w-[78px]">
        {s.label}
      </span>
      <span className="text-[var(--matrix-green-dim)] tabular-nums">
        {s.price ? fmtPrice(s.price) : `${fmtPrice(s.bottom)}–${fmtPrice(s.top)}`}
      </span>
      <span className="ml-auto text-[var(--matrix-green-dim)] tabular-nums text-[9px]">
        {fmtTime(s.t)}
      </span>
    </div>
  );
}

export default function SMCPanel() {
  const { candlesByTf, activeTimeframe, livePrice } = useTradingStore();
  const candles = candlesByTf[activeTimeframe] ?? [];

  const analysis = useMemo(() => {
    if (candles.length < 30) return null;
    return analyzeSMC(candles);
  }, [candles]);

  if (!analysis) {
    return (
      <div className="matrix-panel flex flex-col h-full">
        <div className="matrix-header"><span>◈ SMC STRUCTURES</span></div>
        <div className="p-4 text-xs matrix-text-dim">{"// AWAITING DATA..."}</div>
      </div>
    );
  }

  // Combine structures + sort by time desc
  const allStructures = [
    ...analysis.structures,
    ...analysis.fvgs,
    ...analysis.orderBlocks,
    ...analysis.liquidity,
  ].sort((a, b) => b.t - a.t);

  // Active structures only (un-mitigated, within range)
  const activeStructures = allStructures.filter((s) => {
    if (s.mitigated) return false;
    if (s.price) {
      return Math.abs(s.price - livePrice) / livePrice < 0.05; // within 5%
    }
    return true;
  }).slice(0, 25);

  // Stats
  const stats = {
    bos: analysis.structures.filter((s) => s.kind.includes("BOS")).length,
    choch: analysis.structures.filter((s) => s.kind.includes("CHoCH")).length,
    fvg: analysis.fvgs.filter((f) => !f.mitigated).length,
    ob: analysis.orderBlocks.filter((o) => !o.mitigated).length,
    liq: analysis.liquidity.filter((l) => l.kind.startsWith("LIQ") || l.kind.startsWith("EQ")).length,
    sweep: analysis.liquidity.filter((l) => l.kind.startsWith("SWEEP")).length,
  };

  return (
    <div className="matrix-panel flex flex-col h-full">
      <div className="matrix-header">
        <span>◈ SMC STRUCTURES [SMART MONEY]</span>
        <span className="text-[var(--matrix-green-dim)]">{activeTimeframe}</span>
      </div>

      {/* Trend + counts */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-2">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-[var(--matrix-green-dim)] tracking-widest">TREND BIAS</span>
          <span
            className="font-bold text-[11px] tracking-widest"
            style={{
              color: analysis.trendBias === "BULL" ? "var(--matrix-green)" : analysis.trendBias === "BEAR" ? "var(--matrix-red)" : "var(--matrix-amber)",
            }}
          >
            {analysis.trendBias === "BULL" ? "▲ BULLISH" : analysis.trendBias === "BEAR" ? "▼ BEARISH" : "≈ RANGE"}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-px bg-[rgba(0,255,127,0.08)]">
          {[
            { l: "BOS", v: stats.bos, c: "var(--matrix-green)" },
            { l: "CHoCH", v: stats.choch, c: "var(--matrix-magenta)" },
            { l: "FVG", v: stats.fvg, c: "var(--matrix-cyan)" },
            { l: "OB", v: stats.ob, c: "var(--matrix-amber)" },
            { l: "LIQ", v: stats.liq, c: "var(--matrix-green)" },
            { l: "SWP", v: stats.sweep, c: "var(--matrix-magenta)" },
          ].map((s) => (
            <div key={s.l} className="bg-[#020803] px-1 py-1 text-center">
              <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">{s.l}</div>
              <div className="text-[11px] font-bold tabular-nums" style={{ color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active structures list */}
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll">
        <div className="px-2 py-1 text-[8px] text-[var(--matrix-green-dim)] tracking-widest sticky top-0 bg-[#020803] border-b border-[rgba(0,255,127,0.08)]">
          ACTIVE STRUCTURES
        </div>
        {activeStructures.length === 0 ? (
          <div className="px-3 py-4 text-[10px] matrix-text-dim">{"// NO ACTIVE STRUCTURES"}</div>
        ) : (
          activeStructures.map((s) => <StructureRow key={s.id} s={s} />)
        )}
      </div>

      {/* Footer — nearest liquidity */}
      <div className="border-t border-[rgba(0,255,127,0.12)] p-2 grid grid-cols-2 gap-2 text-[9px]">
        <div>
          <div className="text-[var(--matrix-green-dim)] tracking-widest text-[8px]">NEAREST BSL</div>
          <div className="matrix-text-amber font-bold tabular-nums">
            {(() => {
              const above = analysis.liquidity
                .filter((l) => (l.kind === "LIQ_BSL" || l.kind === "EQH") && l.price && l.price > livePrice)
                .map((l) => l.price!)
                .sort((a, b) => a - b);
              return above[0] ? fmtPrice(above[0]) : "—";
            })()}
          </div>
        </div>
        <div>
          <div className="text-[var(--matrix-green-dim)] tracking-widest text-[8px]">NEAREST SSL</div>
          <div className="matrix-text-cyan font-bold tabular-nums">
            {(() => {
              const below = analysis.liquidity
                .filter((l) => (l.kind === "LIQ_SSL" || l.kind === "EQL") && l.price && l.price < livePrice)
                .map((l) => l.price!)
                .sort((a, b) => b - a);
              return below[0] ? fmtPrice(below[0]) : "—";
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

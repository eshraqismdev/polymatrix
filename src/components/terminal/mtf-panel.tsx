"use client";

import { useTradingStore } from "@/lib/store";
import type { MTFBias } from "@/lib/types";
import { fmtPrice } from "@/lib/format";

function BiasBar({ bias }: { bias: number }) {
  // bias is -100..100, 0 = neutral
  const pct = (bias + 100) / 2; // 0..100
  const color = bias > 15 ? "var(--matrix-green)" : bias < -15 ? "var(--matrix-red)" : "var(--matrix-amber)";
  return (
    <div className="relative h-1.5 w-full bg-[rgba(0,255,127,0.06)] mt-1">
      <div className="absolute top-0 left-1/2 h-full w-px bg-[rgba(255,255,255,0.4)]" />
      <div
        className="absolute top-0 h-full"
        style={{
          left: bias >= 0 ? "50%" : `${pct}%`,
          width: `${Math.abs(bias) / 2}%`,
          background: color,
          boxShadow: `0 0 4px ${color}`,
        }}
      />
    </div>
  );
}

function TrendBadge({ trend }: { trend: "BULL" | "BEAR" | "RANGE" }) {
  const cfg = {
    BULL: { c: "var(--matrix-green)", lbl: "↑ BULL", bg: "rgba(0,255,127,0.12)" },
    BEAR: { c: "var(--matrix-red)", lbl: "↓ BEAR", bg: "rgba(255,59,59,0.12)" },
    RANGE: { c: "var(--matrix-amber)", lbl: "≈ RNG", bg: "rgba(255,176,0,0.10)" },
  }[trend];
  return (
    <span
      className="inline-block px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
      style={{ color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.c}33` }}
    >
      {cfg.lbl}
    </span>
  );
}

export default function MTFPanel() {
  const mtf = useTradingStore((s) => s.mtfBias);
  const livePrice = useTradingStore((s) => s.livePrice);

  // Count aligned timeframes
  const bullCount = mtf.filter((m) => m.trend === "BULL").length;
  const bearCount = mtf.filter((m) => m.trend === "BEAR").length;
  const rangeCount = mtf.filter((m) => m.trend === "RANGE").length;
  const aligned = Math.max(bullCount, bearCount);
  const alignmentScore = mtf.length > 0 ? (aligned / mtf.length) * 100 : 0;

  // Aggregate bias
  const aggBias = mtf.length > 0 ? mtf.reduce((s, m) => s + m.bias, 0) / mtf.length : 0;

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>◎ MTF CONFIRM</span>
        <span className="text-[var(--matrix-green-dim)]">{mtf.length}/6</span>
      </div>

      {/* Aggregate */}
      <div className="px-1.5 py-1 border-b border-[rgba(0,255,127,0.12)] flex-none">
        <div className="flex items-center justify-between text-[8px]">
          <span className="text-[var(--matrix-green-dim)]">AGGREGATE BIAS</span>
          <span
            className="font-bold"
            style={{
              color: aggBias > 15 ? "var(--matrix-green)" : aggBias < -15 ? "var(--matrix-red)" : "var(--matrix-amber)",
            }}
          >
            {aggBias > 15 ? "BULLISH" : aggBias < -15 ? "BEARISH" : "NEUTRAL"} ({aggBias.toFixed(0)})
          </span>
        </div>
        <BiasBar bias={aggBias} />
        <div className="flex items-center justify-between mt-1 text-[9px]">
          <span className="text-[var(--matrix-green-dim)]">
            ALIGN: <span className="matrix-text-bright">{alignmentScore.toFixed(0)}%</span>
          </span>
          <span className="text-[var(--matrix-green-dim)]">
            B:<span className="matrix-text">{bullCount}</span> S:<span className="matrix-text-red">{bearCount}</span> R:<span className="matrix-text-amber">{rangeCount}</span>
          </span>
        </div>
      </div>

      {/* Per-TF rows */}
      <div className="flex-1 overflow-y-auto matrix-scroll">
        <table className="w-full text-[10px]" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
          <thead className="sticky top-0 bg-[#020803]">
            <tr className="text-[var(--matrix-green-dim)] text-[8px] tracking-widest">
              <th className="text-left px-2 py-1">TF</th>
              <th className="text-left py-1">TRND</th>
              <th className="text-right py-1">BIAS</th>
              <th className="text-right px-2 py-1">LIQ↑/↓</th>
            </tr>
          </thead>
          <tbody>
            {mtf.map((m: MTFBias) => {
              const liqAboveDist = m.liquidityAbove && livePrice ? ((m.liquidityAbove - livePrice) / livePrice) * 100 : null;
              const liqBelowDist = m.liquidityBelow && livePrice ? ((livePrice - m.liquidityBelow) / livePrice) * 100 : null;
              return (
                <tr key={m.timeframe} className="border-t border-[rgba(0,255,127,0.08)] hover:bg-[rgba(0,255,127,0.04)]">
                  <td className="px-2 py-1.5 font-bold matrix-text-bright">{m.timeframe}</td>
                  <td className="py-1.5"><TrendBadge trend={m.trend} /></td>
                  <td className="py-1.5">
                    <div className="flex flex-col items-end">
                      <span
                        className="font-bold tabular-nums"
                        style={{
                          color: m.bias > 15 ? "var(--matrix-green)" : m.bias < -15 ? "var(--matrix-red)" : "var(--matrix-amber)",
                        }}
                      >
                        {m.bias > 0 ? "+" : ""}{m.bias.toFixed(0)}
                      </span>
                      <div className="w-16"><BiasBar bias={m.bias} /></div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="matrix-text-amber text-[9px] tabular-nums">
                        {liqAboveDist !== null ? `+${liqAboveDist.toFixed(2)}%` : "—"}
                      </span>
                      <span className="matrix-text-cyan text-[9px] tabular-nums">
                        {liqBelowDist !== null ? `-${liqBelowDist.toFixed(2)}%` : "—"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {mtf.length === 0 && (
              <tr>
                  <td colSpan={4} className="px-2 py-4 text-center matrix-text-dim">
                    {"// AWAITING DATA..."}
                  </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — last structure */}
      <div className="border-t border-[rgba(0,255,127,0.12)] px-2 py-1 text-[8px] text-[var(--matrix-green-dim)]">
        <div className="flex justify-between">
          <span>NEAREST BSL:</span>
          <span className="matrix-text-amber">
            {(() => {
              const all = mtf.map((m) => m.liquidityAbove).filter(Boolean) as number[];
              const above = all.filter((p) => p > livePrice).sort((a, b) => a - b);
              return above[0] ? fmtPrice(above[0]) : "—";
            })()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>NEAREST SSL:</span>
          <span className="matrix-text-cyan">
            {(() => {
              const all = mtf.map((m) => m.liquidityBelow).filter(Boolean) as number[];
              const below = all.filter((p) => p < livePrice).sort((a, b) => b - a);
              return below[0] ? fmtPrice(below[0]) : "—";
            })()}
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTradingStore } from "@/lib/store";

function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-[8px] leading-tight">
      <span className="text-[var(--matrix-green-dim)] tracking-widest">{label}</span>
      <span
        className="tabular-nums font-bold"
        style={{ color: color ?? "var(--matrix-green)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function StreamInfoPanel() {
  const { connection, mtfBias, livePrice, symbol, activeTimeframe } = useTradingStore();
  const [uptime, setUptime] = useState("00:00:00");
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      setUptime(`${pad(h)}:${pad(m)}:${pad(s)}`);
    }, 1000);
    return () => clearInterval(t);
  }, [startTime]);

  // Aggregate bias from MTF
  const bullCount = mtfBias.filter((m) => m.trend === "BULL").length;
  const bearCount = mtfBias.filter((m) => m.trend === "BEAR").length;
  const rangeCount = mtfBias.filter((m) => m.trend === "RANGE").length;
  const aggBias = mtfBias.length > 0 ? mtfBias.reduce((s, m) => s + m.bias, 0) / mtfBias.length : 0;
  const biasLabel = aggBias > 15 ? "BULLISH" : aggBias < -15 ? "BEARISH" : "NEUTRAL";
  const biasColor = aggBias > 15 ? "var(--matrix-green)" : aggBias < -15 ? "var(--matrix-red)" : "var(--matrix-amber)";
  const alignment = mtfBias.length > 0 ? (Math.max(bullCount, bearCount) / mtfBias.length) * 100 : 0;

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>📡 STREAM INFO</span>
        <span className="matrix-blink text-[var(--matrix-red)]">● ON AIR</span>
      </div>

      {/* On-air banner */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-widest matrix-text-bright matrix-pulse">
            ▶ LIVE ANALYSIS
          </span>
          <span className="text-[8px] text-[var(--matrix-green-dim)] tabular-nums">
            {uptime}
          </span>
        </div>
        <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mt-0.5">
          {symbol} • {activeTimeframe} • {livePrice > 0 ? livePrice.toFixed(2) : "---"}
        </div>
      </div>

      {/* Aggregate bias */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">AGGREGATE BIAS</span>
          <span className="text-[10px] font-bold tracking-widest" style={{ color: biasColor, textShadow: `0 0 4px ${biasColor}` }}>
            {biasLabel}
          </span>
        </div>
        {/* Bias bar */}
        <div className="relative h-1.5 bg-[rgba(0,255,127,0.06)] mb-1">
          <div className="absolute top-0 left-1/2 h-full w-px bg-white/40" />
          <div
            className="absolute top-0 h-full"
            style={{
              left: aggBias >= 0 ? "50%" : `${50 + aggBias / 2}%`,
              width: `${Math.abs(aggBias) / 2}%`,
              background: biasColor,
              boxShadow: `0 0 4px ${biasColor}`,
            }}
          />
        </div>
        <div className="flex justify-between text-[7px] tabular-nums">
          <span className="matrix-text">B:{bullCount}</span>
          <span className="matrix-text-amber">R:{rangeCount}</span>
          <span className="matrix-text-red">S:{bearCount}</span>
        </div>
      </div>

      {/* Stream stats */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none space-y-0.5">
        <StatLine label="ALIGN" value={`${alignment.toFixed(0)}%`} color="var(--matrix-amber)" />
        <StatLine label="MTF TFs" value={`${mtfBias.length}/6`} />
        <StatLine
          label="FEED"
          value={connection === "LIVE" ? "REAL-TIME" : connection}
          color={connection === "LIVE" ? "var(--matrix-green)" : "var(--matrix-amber)"}
        />
        <StatLine label="SOURCE" value="HYPERLIQUID" color="var(--matrix-cyan)" />
      </div>

      {/* Educational disclaimer — prominent for YouTube compliance */}
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll p-1.5">
        <div className="border border-[rgba(255,176,0,0.4)] bg-[rgba(255,176,0,0.06)] p-1.5 mb-1">
          <div className="text-[8px] font-bold tracking-widest matrix-text-amber mb-0.5">
            ⚠ EDUCATIONAL ONLY
          </div>
          <div className="text-[7px] text-[var(--matrix-green)] leading-tight">
            This stream is for educational and informational purposes only. NOT financial advice. No trade
            recommendations are being made. Always do your own research.
          </div>
        </div>
        <div className="text-[7px] text-[var(--matrix-green-dim)] leading-tight space-y-0.5">
          <div>• SMC + Orderflow analysis</div>
          <div>• Multi-timeframe liquidity map</div>
          <div>• Real-time market structure detection</div>
          <div>• Hyperliquid DEX data feed</div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[rgba(0,255,127,0.12)] px-1.5 py-0.5 flex-none">
        <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest text-center">
          NEO//LIQUID • ANALYTICS TERMINAL
        </div>
      </div>
    </div>
  );
}

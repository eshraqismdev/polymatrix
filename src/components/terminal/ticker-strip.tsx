"use client";

import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtPct, fmtCompact } from "@/lib/format";

interface TickerItem {
  label: string;
  value: string;
  color?: string;
}

export default function TickerStrip() {
  const { ticker } = useTradingStore();

  if (!ticker) {
    return (
        <div className="matrix-panel h-7 flex items-center px-3 text-[9px] matrix-text-dim">
          {"// LOADING MARKET DATA..."}
        </div>
    );
  }

  // 24h range position
  const rangePos = ticker.high24h > ticker.low24h
    ? ((ticker.price - ticker.low24h) / (ticker.high24h - ticker.low24h)) * 100
    : 50;
  // Premium
  const premium = ticker.oraclePrice > 0
    ? ((ticker.markPrice - ticker.oraclePrice) / ticker.oraclePrice) * 100
    : 0;

  const items: TickerItem[] = [
    { label: "LAST", value: fmtPrice(ticker.price), color: ticker.changePct24h >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" },
    { label: "24H CHG", value: fmtPct(ticker.changePct24h), color: ticker.changePct24h >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" },
    { label: "24H HIGH", value: fmtPrice(ticker.high24h), color: "var(--matrix-green)" },
    { label: "24H LOW", value: fmtPrice(ticker.low24h), color: "var(--matrix-red)" },
    { label: "RANGE POS", value: `${rangePos.toFixed(1)}%`, color: "var(--matrix-amber)" },
    { label: "24H VOL", value: `$${fmtCompact(ticker.volume24h)}`, color: "var(--matrix-cyan)" },
    { label: "FUNDING", value: `${(ticker.fundingRate * 100).toFixed(4)}%`, color: "var(--matrix-amber)" },
    { label: "MARK", value: fmtPrice(ticker.markPrice), color: "var(--matrix-cyan)" },
    { label: "ORACLE", value: fmtPrice(ticker.oraclePrice), color: "var(--matrix-green-dim)" },
    { label: "PREMIUM", value: `${premium >= 0 ? "+" : ""}${premium.toFixed(3)}%`, color: premium >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" },
    { label: "OPEN INT", value: ticker.openInterest > 0 ? fmtCompact(ticker.openInterest) : "—", color: "var(--matrix-magenta)" },
    { label: "FEED", value: "HYPERLIQUID", color: "var(--matrix-cyan)" },
  ];

  return (
    <div className="matrix-panel h-7 overflow-hidden">
      <div className="ticker-track h-full items-center text-[10px]" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
        {[...items, ...items, ...items].map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-3 border-r border-[rgba(0,255,127,0.1)] h-full">
            <span className="text-[var(--matrix-green-dim)] tracking-widest text-[8px]">{it.label}:</span>
            <span
              className="font-bold tabular-nums"
              style={{ color: it.color ?? "var(--matrix-green)", textShadow: `0 0 3px ${it.color ?? "var(--matrix-green)"}` }}
            >
              {it.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

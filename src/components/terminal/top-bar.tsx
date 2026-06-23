"use client";

import { useEffect, useState } from "react";
import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtPct } from "@/lib/format";
import { ALL_TF, type Timeframe } from "@/lib/format";
import type { ConnectionState } from "@/lib/types";

const SYMBOLS = [
  { v: "BTCUSDT", label: "BTC/USDT" },
  { v: "ETHUSDT", label: "ETH/USDT" },
  { v: "SOLUSDT", label: "SOL/USDT" },
  { v: "ARBUSDT", label: "ARB/USDT" },
  { v: "OPUSDT", label: "OP/USDT" },
  { v: "AVAXUSDT", label: "AVAX/USDT" },
  { v: "LINKUSDT", label: "LINK/USDT" },
  { v: "DOGEUSDT", label: "DOGE/USDT" },
];

function StatusDot({ state }: { state: ConnectionState }) {
  const cfg: Record<ConnectionState, { c: string; lbl: string; blink?: boolean }> = {
    LIVE: { c: "var(--matrix-green)", lbl: "LIVE" },
    CONNECTING: { c: "var(--matrix-amber)", lbl: "CONNECTING", blink: true },
    RECONNECTING: { c: "var(--matrix-amber)", lbl: "RECONNECT", blink: true },
    OFFLINE: { c: "var(--matrix-red)", lbl: "OFFLINE", blink: true },
  };
  const s = cfg[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] tracking-widest">
      <span
        className={`inline-block h-2 w-2 rounded-full ${s.blink ? "matrix-blink" : ""}`}
        style={{
          background: s.c,
          boxShadow: `0 0 8px ${s.c}`,
        }}
      />
      <span style={{ color: s.c, textShadow: `0 0 4px ${s.c}` }}>{s.lbl}</span>
    </span>
  );
}

export default function TopBar() {
  const {
    symbol,
    setSymbol,
    activeTimeframe,
    setActiveTimeframe,
    livePrice,
    prevPrice,
    ticker,
    connection,
    dexName,
  } = useTradingStore();

  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      const pad = (x: number) => x.toString().padStart(2, "0");
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const priceUp = livePrice >= prevPrice;
  const priceColor = priceUp ? "var(--matrix-green)" : "var(--matrix-red)";
  const change24h = ticker?.changePct24h ?? 0;
  const funding = ticker?.fundingRate ?? 0;
  const volume24h = ticker?.volume24h ?? 0;

  return (
    <header
      className="matrix-panel relative z-10 flex h-12 items-stretch gap-0 border-b border-[rgba(0,255,127,0.25)] bg-[#020905]"
      style={{ fontFamily: "var(--font-jetbrains), monospace" }}
    >
      {/* Logo / brand */}
      <div className="flex items-center gap-2 px-2 md:px-4 border-r border-[rgba(0,255,127,0.18)] flex-none">
        <span
          className="text-sm md:text-base font-bold tracking-tight matrix-text-bright matrix-pulse"
          style={{ letterSpacing: "-0.02em" }}
        >
          NEO//LIQUID
        </span>
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest hidden lg:inline">
          v3.0
        </span>
      </div>

      {/* LIVE STREAM indicator */}
      <div className="flex items-center gap-2 px-2 md:px-3 border-r border-[rgba(0,255,127,0.18)] flex-none">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] md:text-[10px] font-bold tracking-widest bg-[var(--matrix-red)] text-black matrix-blink"
          style={{ boxShadow: "0 0 8px rgba(255,59,59,0.6)" }}
        >
          ● LIVE STREAM
        </span>
      </div>

      {/* Symbol selector */}
      <div className="flex items-center gap-2 px-2 md:px-3 border-r border-[rgba(0,255,127,0.18)] flex-none">
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest hidden sm:inline">SYM:</span>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-transparent text-xs matrix-text-bright outline-none cursor-pointer"
          style={{ textShadow: "var(--phosphor-glow)" }}
        >
          {SYMBOLS.map((s) => (
            <option key={s.v} value={s.v} className="bg-[#020803] text-[var(--matrix-green)]">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price ticker */}
      <div className="hidden md:flex items-center gap-3 px-3 lg:px-4 border-r border-[rgba(0,255,127,0.18)] min-w-0 lg:min-w-[230px] flex-none">
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">PRICE</span>
          <span
            className="text-base font-bold tabular-nums"
            style={{ color: priceColor, textShadow: `0 0 6px ${priceColor}` }}
          >
            {fmtPrice(livePrice, livePrice < 10 ? 4 : 2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">24H</span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: change24h >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" }}
          >
            {fmtPct(change24h)}
          </span>
        </div>
        <div className="hidden lg:flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">FUND</span>
          <span className="text-xs font-semibold tabular-nums matrix-text-amber">
            {(funding * 100).toFixed(4)}%
          </span>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex items-center gap-1 px-2 md:px-3 border-r border-[rgba(0,255,127,0.18)] flex-none">
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest mr-1 hidden sm:inline">TF:</span>
        {ALL_TF.map((tf: Timeframe) => {
          const active = tf === activeTimeframe;
          return (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-1.5 md:px-2 py-1 text-[10px] md:text-[11px] font-bold tracking-wider transition-all ${
                active
                  ? "bg-[var(--matrix-green)] text-[#021006]"
                  : "text-[var(--matrix-green-dim)] hover:text-[var(--matrix-green)] hover:bg-[rgba(0,255,127,0.1)]"
              }`}
              style={active ? { boxShadow: "0 0 8px rgba(0,255,127,0.6)" } : {}}
            >
              {tf}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0" />

      {/* 24h volume — streaming-relevant stat */}
      <div className="hidden lg:flex items-center gap-3 px-3 border-l border-[rgba(0,255,127,0.18)] flex-none">
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">24H VOL</span>
          <span className="text-xs font-bold tabular-nums matrix-text-cyan">
            ${(volume24h / 1e6).toFixed(1)}M
          </span>
        </div>
        <div className="hidden xl:flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">OI</span>
          <span className="text-xs font-bold tabular-nums matrix-text-amber">
            {(ticker?.openInterest ?? 0).toFixed(1)}
          </span>
        </div>
      </div>

      {/* DEX status */}
      <div className="flex flex-col items-end justify-center px-2 md:px-3 border-l border-[rgba(0,255,127,0.18)] flex-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest hidden sm:inline">DEX</span>
          <span className="text-[9px] md:text-[10px] font-bold matrix-text-cyan">{dexName}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusDot state={connection} />
          <span className="text-[8px] md:text-[9px] text-[var(--matrix-green-dim)] tabular-nums">{clock}</span>
        </div>
      </div>
    </header>
  );
}

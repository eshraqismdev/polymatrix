"use client";

import { useEffect, useState } from "react";
import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtPct, fmtCompact } from "@/lib/format";
import { ALL_TF, type Timeframe } from "@/lib/format";
import type { TradingMode, ConnectionState } from "@/lib/types";

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
    mode,
    setMode,
    autoExecute,
    toggleAutoExecute,
    pnl,
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

  return (
    <header
      className="matrix-panel relative z-10 flex h-12 items-stretch gap-0 border-b border-[rgba(0,255,127,0.25)] bg-[#020905]"
      style={{ fontFamily: "var(--font-jetbrains), monospace" }}
    >
      {/* Logo / brand */}
      <div className="flex items-center gap-2 px-4 border-r border-[rgba(0,255,127,0.18)]">
        <span
          className="text-base font-bold tracking-tight matrix-text-bright matrix-pulse"
          style={{ letterSpacing: "-0.02em" }}
        >
          NEO//LIQUID
        </span>
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest hidden md:inline">
          v2.7.1
        </span>
      </div>

      {/* Symbol selector */}
      <div className="flex items-center gap-2 px-3 border-r border-[rgba(0,255,127,0.18)]">
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">SYM:</span>
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
      <div className="hidden md:flex items-center gap-3 px-4 border-r border-[rgba(0,255,127,0.18)] min-w-[230px]">
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
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">FUND</span>
          <span className="text-xs font-semibold tabular-nums matrix-text-amber">
            {(funding * 100).toFixed(4)}%
          </span>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex items-center gap-1 px-3 border-r border-[rgba(0,255,127,0.18)]">
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest mr-1">TF:</span>
        {ALL_TF.map((tf: Timeframe) => {
          const active = tf === activeTimeframe;
          return (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-2 py-1 text-[11px] font-bold tracking-wider transition-all ${
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

      <div className="flex-1" />

      {/* PnL mini-summary */}
      <div className="hidden lg:flex items-center gap-4 px-4 border-l border-[rgba(0,255,127,0.18)]">
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">EQUITY</span>
          <span className="text-xs font-bold tabular-nums matrix-text">
            ${pnl.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">uPnL</span>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: pnl.unrealized >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" }}
          >
            {pnl.unrealized >= 0 ? "+" : "-"}${Math.abs(pnl.unrealized).toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">WR</span>
          <span className="text-xs font-bold tabular-nums matrix-text-amber">
            {pnl.trades > 0 ? `${pnl.winRate.toFixed(1)}%` : "—"}
          </span>
        </div>
      </div>

      {/* Auto-execute */}
      <div className="flex items-center gap-2 px-3 border-l border-[rgba(0,255,127,0.18)]">
        <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">AUTO</span>
        <button
          onClick={toggleAutoExecute}
          className={`px-2 py-1 text-[10px] font-bold tracking-wider ${
            autoExecute
              ? "bg-[var(--matrix-amber)] text-black"
              : "text-[var(--matrix-green-dim)] border border-[rgba(0,255,127,0.3)]"
          }`}
          style={autoExecute ? { boxShadow: "0 0 8px rgba(255,176,0,0.6)" } : {}}
          title="When ON, AI signals are auto-executed in current mode"
        >
          {autoExecute ? "ARMED" : "OFF"}
        </button>
      </div>

      {/* Mode toggle PAPER / REAL */}
      <div className="flex items-center gap-0 border-l border-[rgba(0,255,127,0.18)]">
        {(["PAPER", "REAL"] as TradingMode[]).map((m) => {
          const active = mode === m;
          const color = m === "REAL" ? "var(--matrix-red)" : "var(--matrix-green)";
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-[11px] font-bold tracking-widest transition-all ${
                active ? "" : "text-[var(--matrix-green-dim)] hover:text-[var(--matrix-green)]"
              }`}
              style={
                active
                  ? {
                      background: color,
                      color: "#000",
                      boxShadow: `0 0 8px ${color}`,
                    }
                  : {}
              }
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* DEX status */}
      <div className="flex flex-col items-end justify-center px-3 border-l border-[rgba(0,255,127,0.18)] min-w-[140px]">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[var(--matrix-green-dim)] tracking-widest">DEX</span>
          <span className="text-[10px] font-bold matrix-text-cyan">{dexName}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusDot state={connection} />
          <span className="text-[9px] text-[var(--matrix-green-dim)] tabular-nums">{clock}</span>
        </div>
      </div>
    </header>
  );
}

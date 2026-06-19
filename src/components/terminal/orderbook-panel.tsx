"use client";

import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtCompact } from "@/lib/format";
import type { OrderBookLevel } from "@/lib/types";

function BookRow({ lvl, maxTotal, side }: { lvl: OrderBookLevel; maxTotal: number; side: "bid" | "ask" }) {
  const pct = (lvl.size / maxTotal) * 100;
  const color = side === "bid" ? "var(--matrix-green)" : "var(--matrix-red)";
  const fillColor = side === "bid" ? "rgba(0,255,127,0.10)" : "rgba(255,59,59,0.10)";
  return (
    <div className="relative px-2 py-0.5 text-[9px] tabular-nums flex justify-between border-b border-[rgba(0,255,127,0.04)]">
      <div
        className="absolute top-0 bottom-0 right-0"
        style={{ width: `${pct}%`, background: fillColor }}
      />
      <span className="relative z-10" style={{ color }}>
        {fmtPrice(lvl.price)}
      </span>
      <span className="relative z-10 text-[var(--matrix-green-dim)]">
        {fmtCompact(lvl.size)}
      </span>
    </div>
  );
}

export default function OrderBookPanel() {
  const { orderbook, livePrice } = useTradingStore();

  const bids = orderbook?.bids ?? [];
  const asks = orderbook?.asks ?? [];
  const maxTotal = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size),
    1,
  );

  // Spread
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestAsk - bestBid;
  const spreadPct = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  // Imbalance
  const bidVol = bids.slice(0, 10).reduce((s, b) => s + b.size, 0);
  const askVol = asks.slice(0, 10).reduce((s, a) => s + a.size, 0);
  const totalVol = bidVol + askVol;
  const imbalance = totalVol > 0 ? ((bidVol - askVol) / totalVol) * 100 : 0;

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>⊞ DEX BOOK</span>
        <span className="text-[var(--matrix-green-dim)]">L2</span>
      </div>

      {/* Header row */}
      <div className="flex justify-between px-1.5 py-0.5 text-[7px] text-[var(--matrix-green-dim)] tracking-widest border-b border-[rgba(0,255,127,0.12)] flex-none">
        <span>PRICE</span>
        <span>SIZE</span>
      </div>

      {/* Asks (reversed so best is at bottom near spread) */}
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll">
        <div className="flex flex-col-reverse">
          {asks.slice(0, 12).map((a, i) => (
            <BookRow key={`ask_${i}`} lvl={a} maxTotal={maxTotal} side="ask" />
          ))}
        </div>

        {/* Spread / mid */}
        <div className="px-2 py-1 my-1 border-y border-[rgba(0,255,127,0.15)] bg-[rgba(0,255,127,0.04)]">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[var(--matrix-green-dim)]">MID</span>
            <span
              className="font-bold tabular-nums"
              style={{ color: livePrice >= 0 ? "var(--matrix-green)" : "var(--matrix-red)", textShadow: "0 0 4px currentColor" }}
            >
              {fmtPrice(livePrice || (bestBid + bestAsk) / 2)}
            </span>
            <span className="text-[8px] text-[var(--matrix-green-dim)]">
              spr {spread.toFixed(2)} ({spreadPct.toFixed(3)}%)
            </span>
          </div>
        </div>

        {/* Bids */}
        <div className="flex flex-col">
          {bids.slice(0, 12).map((b, i) => (
            <BookRow key={`bid_${i}`} lvl={b} maxTotal={maxTotal} side="bid" />
          ))}
        </div>
      </div>

      {/* Imbalance footer */}
      <div className="border-t border-[rgba(0,255,127,0.12)] p-2">
        <div className="flex justify-between text-[8px] text-[var(--matrix-green-dim)] tracking-widest mb-1">
          <span>BID IMBALANCE</span>
          <span style={{ color: imbalance >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" }}>
            {imbalance >= 0 ? "+" : ""}{imbalance.toFixed(1)}%
          </span>
        </div>
        <div className="relative h-1.5 bg-[rgba(255,59,59,0.15)]">
          <div className="absolute top-0 left-1/2 h-full w-px bg-white/40" />
          <div
            className="absolute top-0 h-full bg-[var(--matrix-green)]"
            style={{
              left: imbalance >= 0 ? "50%" : `${50 + imbalance}%`,
              width: `${Math.abs(imbalance) / 2}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[8px]">
          <span className="matrix-text-red">ASK: {fmtCompact(askVol)}</span>
          <span className="matrix-text">BID: {fmtCompact(bidVol)}</span>
        </div>
      </div>
    </div>
  );
}

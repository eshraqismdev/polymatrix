"use client";

import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtTime } from "@/lib/format";
import type { TradeSignal } from "@/lib/types";

function FeedRow({ s }: { s: TradeSignal }) {
  const cfg: Record<TradeSignal["type"], { color: string; icon: string }> = {
    ENTRY: { color: "var(--matrix-cyan)", icon: "▶" },
    STOP: { color: "var(--matrix-red)", icon: "■" },
    TP1: { color: "var(--matrix-green)", icon: "✓" },
    TP2: { color: "var(--matrix-green)", icon: "✓" },
    TP3: { color: "var(--matrix-amber)", icon: "★" },
    CANCEL: { color: "var(--matrix-green-dim)", icon: "✕" },
    INFO: { color: "var(--matrix-green)", icon: "i" },
    ALERT: { color: "var(--matrix-amber)", icon: "!" },
  };
  const c = cfg[s.type];
  const sideColor = s.side === "LONG" ? "var(--matrix-green)" : "var(--matrix-red)";
  return (
    <div
      className="flex items-start gap-2 px-2 py-1 border-b border-[rgba(0,255,127,0.06)] hover:bg-[rgba(0,255,127,0.04)] text-[9px]"
      style={{ fontFamily: "var(--font-jetbrains), monospace" }}
    >
      <span className="text-[var(--matrix-green-dim)] tabular-nums whitespace-nowrap">
        {fmtTime(s.ts)}
      </span>
      <span style={{ color: c.color, textShadow: `0 0 4px ${c.color}` }} className="font-bold w-3 text-center">
        {c.icon}
      </span>
      <span style={{ color: sideColor }} className="font-bold w-9 tracking-wider">
        {s.side}
      </span>
      <span className="matrix-text-bright tabular-nums w-16">
        {fmtPrice(s.price)}
      </span>
      <span className="text-[var(--matrix-green-dim)] flex-1 truncate" title={s.note}>
        {s.note}
      </span>
      {s.confidence ? (
        <span className="matrix-text-amber tabular-nums">{s.confidence.toFixed(0)}%</span>
      ) : null}
    </div>
  );
}

export default function SignalFeed() {
  const feed = useTradingStore((s) => s.signalFeed);

  return (
    <div className="matrix-panel flex flex-col h-full">
      <div className="matrix-header">
        <span>⊞ SIGNAL / EVENT LOG</span>
        <span className="text-[var(--matrix-green-dim)]">{feed.length} EVT</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll">
        {feed.length === 0 ? (
          <div className="p-4 text-[10px] matrix-text-dim">
            {"// AWAITING SIGNALS..."}<br />
            <span className="text-[8px] text-[var(--matrix-green-dim)]">
              AI signals, executions, SL/TP fills will appear here.
            </span>
          </div>
        ) : (
          feed.map((s) => <FeedRow key={s.id} s={s} />)
        )}
      </div>
    </div>
  );
}

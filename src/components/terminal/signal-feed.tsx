"use client";

import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtTime } from "@/lib/format";
import type { MarketEvent } from "@/lib/types";

const TYPE_CFG: Record<MarketEvent["type"], { color: string; icon: string; lbl: string }> = {
  STRUCTURE: { color: "var(--matrix-green)", icon: "▸", lbl: "BOS/CHoCH" },
  SWEEP: { color: "var(--matrix-magenta)", icon: "◉", lbl: "SWEEP" },
  FVG: { color: "var(--matrix-cyan)", icon: "▭", lbl: "FVG" },
  OB: { color: "var(--matrix-amber)", icon: "▦", lbl: "OB" },
  LIQUIDITY: { color: "var(--matrix-amber)", icon: "≡", lbl: "LIQ" },
  ABSORPTION: { color: "var(--matrix-magenta)", icon: "■", lbl: "ABS" },
  BIAS_SHIFT: { color: "var(--matrix-cyan)", icon: "↻", lbl: "SHIFT" },
  INFO: { color: "var(--matrix-green)", icon: "i", lbl: "INFO" },
};

function EventRow({ ev }: { ev: MarketEvent }) {
  const cfg = TYPE_CFG[ev.type];
  const sideColor = ev.side === "BULL" ? "var(--matrix-green)" : ev.side === "BEAR" ? "var(--matrix-red)" : "var(--matrix-amber)";
  return (
    <div
      className="flex items-start gap-2 px-2 py-1 border-b border-[rgba(0,255,127,0.06)] hover:bg-[rgba(0,255,127,0.04)] text-[9px]"
      style={{ fontFamily: "var(--font-jetbrains), monospace" }}
    >
      <span className="text-[var(--matrix-green-dim)] tabular-nums whitespace-nowrap">
        {fmtTime(ev.ts)}
      </span>
      <span style={{ color: cfg.color, textShadow: `0 0 4px ${cfg.color}` }} className="font-bold w-3 text-center">
        {cfg.icon}
      </span>
      <span style={{ color: sideColor }} className="font-bold w-9 tracking-wider">
        {ev.side}
      </span>
      <span
        className="px-1 text-[7px] font-bold tracking-widest border"
        style={{
          color: cfg.color,
          borderColor: `${cfg.color}55`,
          background: `${cfg.color}11`,
        }}
      >
        {cfg.lbl}
      </span>
      <span className="matrix-text-bright tabular-nums whitespace-nowrap">
        {fmtPrice(ev.price)}
      </span>
      <span className="text-[var(--matrix-green-dim)] flex-1 truncate" title={ev.detail}>
        {ev.detail}
      </span>
    </div>
  );
}

export default function SignalFeed() {
  const events = useTradingStore((s) => s.events);
  const clearEvents = useTradingStore((s) => s.clearEvents);

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>₪ MARKET EVENTS LOG</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--matrix-green-dim)]">{events.length} EVT</span>
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              className="text-[8px] text-[var(--matrix-red)] hover:underline"
              title="Clear log"
            >
              [CLR]
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll">
        {events.length === 0 ? (
          <div className="p-4 text-[10px] matrix-text-dim">
            {"// AWAITING MARKET EVENTS..."}<br />
            <span className="text-[8px] text-[var(--matrix-green-dim)]">
              SMC structure breaks, liquidity sweeps, FVG/OB formations, and bias shifts will appear here in real-time.
            </span>
          </div>
        ) : (
          events.map((ev) => <EventRow key={ev.id} ev={ev} />)
        )}
      </div>
    </div>
  );
}

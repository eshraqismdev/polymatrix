"use client";

import { useTradingStore, openPosition, closePosition } from "@/lib/store";
import type { AISignal } from "@/lib/types";
import { fmtPrice, fmtTime } from "@/lib/format";

function ConfidenceRing({ value }: { value: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const off = circ - (value / 100) * circ;
  const color = value >= 75 ? "var(--matrix-green)" : value >= 50 ? "var(--matrix-amber)" : "var(--matrix-red)";
  return (
    <div className="relative w-10 h-10">
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(0,255,127,0.1)" strokeWidth="2" />
        <circle
          cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})`, transition: "stroke-dashoffset 0.6s" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
        style={{ color, textShadow: `0 0 4px ${color}` }}
      >
        {value.toFixed(0)}
      </div>
    </div>
  );
}

export default function AISignalPanel() {
  const { aiSignal, livePrice, position, mode, pushSignal } = useTradingStore();

  if (!aiSignal) {
    return (
      <div className="matrix-panel flex flex-col h-full">
        <div className="matrix-header">
          <span>⚡ AI SIGNAL ENGINE</span>
          <span className="matrix-blink text-[var(--matrix-amber)]">STANDBY</span>
        </div>
        <div className="p-4 text-xs matrix-text-dim">
          <div>{"// AWAITING INFERENCE..."}</div>
          <div className="mt-2 text-[9px] text-[var(--matrix-green-dim)]">
            Neural net analyzing SMC + orderflow + MTF bias...
          </div>
        </div>
      </div>
    );
  }

  const s: AISignal = aiSignal;
  const isNeutral = s.side === "NEUTRAL";
  const sideColor = s.side === "LONG" ? "var(--matrix-green)" : s.side === "SHORT" ? "var(--matrix-red)" : "var(--matrix-amber)";
  const isExpired = Date.now() - s.ts > s.validityMs;
  const canExecute = !isNeutral && position.status === "FLAT" && !isExpired && s.confidence >= 40;

  // Risk calculations
  const risk = Math.abs(s.entry - s.stop);
  const reward1 = Math.abs(s.tp1 - s.entry);
  const rr = risk > 0 ? reward1 / risk : 0;

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>⚡ AI SIGNAL</span>
        <span className="flex items-center gap-1">
          <span
            className="px-1 py-0.5 text-[7px] font-bold tracking-widest"
            style={{
              color: aiSignal.source === "AI" ? "var(--matrix-cyan)" : "var(--matrix-amber)",
              border: `1px solid ${aiSignal.source === "AI" ? "var(--matrix-cyan)" : "var(--matrix-amber)"}55`,
              background: aiSignal.source === "AI" ? "rgba(0,255,224,0.08)" : "rgba(255,176,0,0.08)",
            }}
          >
            {aiSignal.source === "AI" ? "● LLM" : "● SMC"}
          </span>
          <span className={`text-[8px] ${isExpired ? "text-[var(--matrix-red)]" : "matrix-text-cyan"}`}>
            {isExpired ? "EXP" : "ACT"}
          </span>
        </span>
      </div>

      {/* Top: side + confidence + validity — compact */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none">
        <div className="flex items-center gap-2">
          <ConfidenceRing value={s.confidence} />
          <div className="flex-1 min-w-0">
            <div
              className="text-sm font-bold tracking-widest leading-tight truncate"
              style={{ color: sideColor, textShadow: `0 0 4px ${sideColor}` }}
            >
              {isNeutral ? "● NEUTRAL" : s.side === "LONG" ? "▲ LONG" : "▼ SHORT"}
            </div>
            <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest truncate">
              B:<span style={{ color: sideColor }}>{s.bias}</span>
              {" "}R:<span className="matrix-text-amber">{s.rr.toFixed(2)}</span>
              {" "}E:<span className={isExpired ? "matrix-text-red" : "matrix-text"}>{fmtTime(s.ts + s.validityMs)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trade plan grid — compact */}
      <div className="grid grid-cols-2 gap-px bg-[rgba(0,255,127,0.08)] border-b border-[rgba(0,255,127,0.12)] flex-none">
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">ENTRY</div>
          <div className="text-[11px] font-bold tabular-nums matrix-text-cyan leading-tight">{fmtPrice(s.entry)}</div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">STOP</div>
          <div className="text-[11px] font-bold tabular-nums matrix-text-red leading-tight">{fmtPrice(s.stop)}</div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">TP1</div>
          <div className="text-[11px] font-bold tabular-nums matrix-text leading-tight">{fmtPrice(s.tp1)}</div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">TP2/3</div>
          <div className="text-[11px] font-bold tabular-nums matrix-text-amber leading-tight truncate">
            {fmtPrice(s.tp2)} / {fmtPrice(s.tp3)}
          </div>
        </div>
      </div>

      {/* Reasoning + Confluences + Invalidation — scrollable region */}
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll">
        <div className="p-1.5 border-b border-[rgba(0,255,127,0.08)]">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-0.5">REASONING</div>
          <ul className="space-y-0.5">
            {s.reasoning.map((r, i) => (
              <li key={i} className="text-[8px] matrix-text flex gap-1 leading-tight">
                <span className="matrix-text-amber flex-none">▸</span>
                <span className="break-words">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {s.confluences.length > 0 && (
          <div className="p-1.5 border-b border-[rgba(0,255,127,0.08)]">
            <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-0.5">CONFLUENCES</div>
            <div className="flex flex-wrap gap-0.5">
              {s.confluences.map((c, i) => (
                <span
                  key={i}
                  className="text-[7px] px-1 py-0.5 border border-[rgba(0,255,127,0.3)] matrix-text leading-tight"
                  style={{ background: "rgba(0,255,127,0.05)" }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-1.5">
          <div className="text-[7px] text-[var(--matrix-red)] tracking-widest mb-0.5">INVALIDATION</div>
          <div className="text-[8px] matrix-text-dim leading-tight">{s.invalidation}</div>
        </div>
      </div>

      {/* Action buttons — compact */}
      <div className="p-1.5 mt-auto flex-none">
        {position.status === "IN_POSITION" ? (
          <button
            onClick={() => closePosition("MANUAL CLOSE", livePrice)}
            className="w-full py-1.5 text-[10px] font-bold tracking-widest bg-[var(--matrix-red)] text-black hover:opacity-80"
            style={{ boxShadow: "0 0 6px rgba(255,59,59,0.5)" }}
          >
            ✕ CLOSE @ MKT
          </button>
        ) : canExecute ? (
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => {
                openPosition(s.side as "LONG" | "SHORT", s.entry, s.stop, s.tp1, s.tp2, s.tp3, 10, 1);
                pushSignal({
                  id: Math.random().toString(36).slice(2),
                  ts: Date.now(),
                  side: s.side as "LONG" | "SHORT",
                  type: "ENTRY",
                  price: s.entry,
                  note: `[MANUAL EXEC] AI ${s.side} conf=${s.confidence.toFixed(0)}% mode=${mode}`,
                  confidence: s.confidence,
                });
              }}
              className="py-1.5 text-[10px] font-bold tracking-widest bg-[var(--matrix-green)] text-black hover:bg-[var(--matrix-green-bright)]"
              style={{ boxShadow: "0 0 6px rgba(0,255,127,0.5)" }}
            >
              ▶ {s.side}
            </button>
            <button
              onClick={() => {
                useTradingStore.getState().setAiSignal(null);
              }}
              className="py-1.5 text-[10px] font-bold tracking-widest border border-[rgba(0,255,127,0.3)] text-[var(--matrix-green-dim)] hover:text-[var(--matrix-green)]"
            >
              ✕ SKIP
            </button>
          </div>
        ) : (
          <div className="w-full py-1.5 text-[10px] text-center matrix-text-dim border border-[rgba(0,255,127,0.15)]">
            {isNeutral ? "● NO EDGE" : isExpired ? "● EXPIRED" : position.status === "IN_POSITION" ? "● IN POS" : "● LOW CONF"}
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="matrix-panel flex flex-col h-full">
      <div className="matrix-header">
        <span>⚡ AI SIGNAL ENGINE</span>
        <span className={isExpired ? "text-[var(--matrix-red)]" : "matrix-text-cyan"}>
          {isExpired ? "EXPIRED" : "ACTIVE"}
        </span>
      </div>

      {/* Top: side + confidence + validity */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-2">
        <div className="flex items-center gap-3">
          <ConfidenceRing value={s.confidence} />
          <div className="flex-1">
            <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">SIGNAL SIDE</div>
            <div
              className="text-lg font-bold tracking-widest"
              style={{ color: sideColor, textShadow: `0 0 6px ${sideColor}` }}
            >
              {isNeutral ? "● NEUTRAL" : s.side === "LONG" ? "▲ LONG" : "▼ SHORT"}
            </div>
            <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">
              BIAS: <span style={{ color: sideColor }}>{s.bias}</span>
              {" • "}RR: <span className="matrix-text-amber">{s.rr.toFixed(2)}</span>
              {" • "}EXP: <span className={isExpired ? "matrix-text-red" : "matrix-text"}>{fmtTime(s.ts + s.validityMs)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trade plan grid */}
      <div className="grid grid-cols-2 gap-px bg-[rgba(0,255,127,0.08)] border-b border-[rgba(0,255,127,0.12)]">
        <div className="bg-[#020803] p-2">
          <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">ENTRY</div>
          <div className="text-sm font-bold tabular-nums matrix-text-cyan">{fmtPrice(s.entry)}</div>
          <div className="text-[8px] text-[var(--matrix-green-dim)] tabular-nums">
            {livePrice > 0 ? `${(((s.entry - livePrice) / livePrice) * 100).toFixed(3)}% from mkt` : ""}
          </div>
        </div>
        <div className="bg-[#020803] p-2">
          <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">STOP</div>
          <div className="text-sm font-bold tabular-nums matrix-text-red">{fmtPrice(s.stop)}</div>
          <div className="text-[8px] text-[var(--matrix-green-dim)] tabular-nums">risk: {fmtPrice(risk)}</div>
        </div>
        <div className="bg-[#020803] p-2">
          <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">TP1</div>
          <div className="text-sm font-bold tabular-nums matrix-text">{fmtPrice(s.tp1)}</div>
          <div className="text-[8px] text-[var(--matrix-green-dim)] tabular-nums">+{fmtPrice(reward1)} ({rr.toFixed(2)}R)</div>
        </div>
        <div className="bg-[#020803] p-2">
          <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">TP2</div>
          <div className="text-sm font-bold tabular-nums matrix-text">{fmtPrice(s.tp2)}</div>
          <div className="text-[8px] text-[var(--matrix-green-dim)] tabular-nums">+{fmtPrice(Math.abs(s.tp2 - s.entry))}</div>
        </div>
        <div className="bg-[#020803] p-2 col-span-2">
          <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">TP3 [EXTENSION]</div>
          <div className="text-sm font-bold tabular-nums matrix-text-amber">{fmtPrice(s.tp3)}</div>
          <div className="text-[8px] text-[var(--matrix-green-dim)] tabular-nums">+{fmtPrice(Math.abs(s.tp3 - s.entry))} ({risk > 0 ? (Math.abs(s.tp3 - s.entry) / risk).toFixed(2) : "0"}R)</div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-2 max-h-32 overflow-y-auto matrix-scroll">
        <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest mb-1">REASONING</div>
        <ul className="space-y-0.5">
          {s.reasoning.map((r, i) => (
            <li key={i} className="text-[9px] matrix-text flex gap-1">
              <span className="matrix-text-amber">▸</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Confluences */}
      {s.confluences.length > 0 && (
        <div className="border-b border-[rgba(0,255,127,0.12)] p-2 max-h-24 overflow-y-auto matrix-scroll">
          <div className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest mb-1">CONFLUENCES</div>
          <div className="flex flex-wrap gap-1">
            {s.confluences.map((c, i) => (
              <span
                key={i}
                className="text-[8px] px-1.5 py-0.5 border border-[rgba(0,255,127,0.3)] matrix-text"
                style={{ background: "rgba(0,255,127,0.05)" }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Invalidation */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-2">
        <div className="text-[8px] text-[var(--matrix-red)] tracking-widest mb-0.5">INVALIDATION</div>
        <div className="text-[9px] matrix-text-dim">{s.invalidation}</div>
      </div>

      {/* Action buttons */}
      <div className="p-2 mt-auto">
        {position.status === "IN_POSITION" ? (
          <button
            onClick={() => closePosition("MANUAL CLOSE", livePrice)}
            className="w-full py-2 text-xs font-bold tracking-widest bg-[var(--matrix-red)] text-black hover:opacity-80"
            style={{ boxShadow: "0 0 8px rgba(255,59,59,0.6)" }}
          >
            ✕ CLOSE POSITION @ MKT
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
              className="py-2 text-xs font-bold tracking-widest bg-[var(--matrix-green)] text-black hover:bg-[var(--matrix-green-bright)]"
              style={{ boxShadow: "0 0 8px rgba(0,255,127,0.6)" }}
            >
              ▶ EXEC {s.side}
            </button>
            <button
              onClick={() => {
                useTradingStore.getState().setAiSignal(null);
              }}
              className="py-2 text-xs font-bold tracking-widest border border-[rgba(0,255,127,0.3)] text-[var(--matrix-green-dim)] hover:text-[var(--matrix-green)]"
            >
              ✕ DISMISS
            </button>
          </div>
        ) : (
          <div className="w-full py-2 text-xs text-center matrix-text-dim border border-[rgba(0,255,127,0.15)]">
            {isNeutral ? "● NO HIGH-CONFIDENCE EDGE" : isExpired ? "● SIGNAL EXPIRED" : position.status === "IN_POSITION" ? "● IN POSITION" : "● LOW CONFIDENCE"}
          </div>
        )}
      </div>
    </div>
  );
}

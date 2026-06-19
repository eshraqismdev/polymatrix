"use client";

import { useTradingStore, closePosition } from "@/lib/store";
import { fmtPrice, fmtUsd, fmtPct } from "@/lib/format";

export default function PositionPanel() {
  const { position, pnl, livePrice, mode, resetPnl } = useTradingStore();

  const inPos = position.status === "IN_POSITION";
  const entry = position.entry ?? 0;
  const side = position.side;

  // PnL breakdown
  const uPnL = pnl.unrealized;
  const uPnLPct = entry > 0 && position.size > 0 ? (uPnL / (entry * position.size)) * 100 : 0;

  // Distance to SL/TP
  const distStop = position.stop && livePrice ? ((position.stop - livePrice) / livePrice) * 100 : null;
  const distTP1 = position.tp1 && livePrice ? ((position.tp1 - livePrice) / livePrice) * 100 : null;

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>▣ POSITION</span>
        <span className={mode === "REAL" ? "matrix-text-red matrix-blink" : "matrix-text"}>
          {mode}
        </span>
      </div>

      {/* Equity summary — compact */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none">
        <div className="grid grid-cols-4 gap-px bg-[rgba(0,255,127,0.08)]">
          <div className="bg-[#020803] px-1 py-1">
            <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">EQUITY</div>
            <div className="text-[10px] font-bold tabular-nums matrix-text-bright leading-tight truncate">
              {fmtUsd(pnl.equity)}
            </div>
          </div>
          <div className="bg-[#020803] px-1 py-1">
            <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">BAL</div>
            <div className="text-[10px] font-bold tabular-nums matrix-text leading-tight truncate">
              {fmtUsd(pnl.balance)}
            </div>
          </div>
          <div className="bg-[#020803] px-1 py-1">
            <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">uPnL</div>
            <div
              className="text-[10px] font-bold tabular-nums leading-tight truncate"
              style={{ color: uPnL >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" }}
            >
              {uPnL >= 0 ? "+" : "-"}{fmtUsd(Math.abs(uPnL))}
            </div>
          </div>
          <div className="bg-[#020803] px-1 py-1">
            <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">rPnL</div>
            <div
              className="text-[10px] font-bold tabular-nums leading-tight truncate"
              style={{ color: pnl.realized >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" }}
            >
              {pnl.realized >= 0 ? "+" : "-"}{fmtUsd(Math.abs(pnl.realized))}
            </div>
          </div>
        </div>

        {/* Win rate bar — compact */}
        <div className="mt-1">
          <div className="flex justify-between text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-0.5">
            <span>WIN RATE</span>
            <span className="matrix-text-amber">
              {pnl.trades > 0 ? `${pnl.winRate.toFixed(0)}% (${pnl.wins}/${pnl.losses})` : "—"}
            </span>
          </div>
          <div className="h-1 bg-[rgba(0,255,127,0.06)] flex">
            <div
              className="h-full bg-[var(--matrix-green)]"
              style={{ width: `${pnl.trades > 0 ? (pnl.wins / pnl.trades) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-[var(--matrix-red)]"
              style={{ width: `${pnl.trades > 0 ? (pnl.losses / pnl.trades) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active position — scrollable for overflow safety */}
      <div className="flex-1 min-h-0 overflow-y-auto matrix-scroll p-1.5">
        {inPos ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">OPEN</span>
              <span
                className="text-[10px] font-bold tracking-widest matrix-blink"
                style={{ color: side === "LONG" ? "var(--matrix-green)" : "var(--matrix-red)" }}
              >
                {side === "LONG" ? "▲ LONG" : "▼ SHORT"} {position.leverage}x
              </span>
            </div>

            <div className="grid grid-cols-2 gap-px bg-[rgba(0,255,127,0.08)] mb-1.5">
              <div className="bg-[#020803] px-1 py-1">
                <div className="text-[7px] text-[var(--matrix-green-dim)]">ENTRY</div>
                <div className="text-[10px] font-bold matrix-text-cyan tabular-nums leading-tight">{fmtPrice(entry)}</div>
              </div>
              <div className="bg-[#020803] px-1 py-1">
                <div className="text-[7px] text-[var(--matrix-green-dim)]">SIZE</div>
                <div className="text-[10px] font-bold matrix-text tabular-nums leading-tight">{position.size.toFixed(4)}</div>
              </div>
              <div className="bg-[#020803] px-1 py-1">
                <div className="text-[7px] text-[var(--matrix-green-dim)]">STOP</div>
                <div className="text-[10px] font-bold matrix-text-red tabular-nums leading-tight">{position.stop ? fmtPrice(position.stop) : "—"}</div>
                {distStop !== null && (
                  <div className="text-[7px] text-[var(--matrix-green-dim)] tabular-nums">{distStop.toFixed(2)}%</div>
                )}
              </div>
              <div className="bg-[#020803] px-1 py-1">
                <div className="text-[7px] text-[var(--matrix-green-dim)]">TP1</div>
                <div className="text-[10px] font-bold matrix-text tabular-nums leading-tight">{position.tp1 ? fmtPrice(position.tp1) : "—"}</div>
                {distTP1 !== null && (
                  <div className="text-[7px] text-[var(--matrix-green-dim)] tabular-nums">{distTP1.toFixed(2)}%</div>
                )}
              </div>
              <div className="bg-[#020803] px-1 py-1">
                <div className="text-[7px] text-[var(--matrix-green-dim)]">MARGIN</div>
                <div className="text-[10px] font-bold matrix-text tabular-nums leading-tight">{position.marginUsed ? fmtUsd(position.marginUsed) : "—"}</div>
              </div>
              <div className="bg-[#020803] px-1 py-1">
                <div className="text-[7px] text-[var(--matrix-green-dim)]">LIQ</div>
                <div className="text-[10px] font-bold matrix-text-red tabular-nums leading-tight">{position.liquidation ? fmtPrice(position.liquidation) : "—"}</div>
              </div>
            </div>

            {/* Unrealized PnL bar */}
            <div className="mb-1.5">
              <div className="flex justify-between text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-0.5">
                <span>uPnL</span>
                <span style={{ color: uPnL >= 0 ? "var(--matrix-green)" : "var(--matrix-red)" }}>
                  {uPnL >= 0 ? "+" : "-"}{fmtUsd(Math.abs(uPnL))} ({fmtPct(uPnLPct)})
                </span>
              </div>
              <div className="relative h-1.5 bg-[rgba(0,255,127,0.06)]">
                <div className="absolute top-0 left-1/2 h-full w-px bg-[rgba(255,255,255,0.4)]" />
                <div
                  className="absolute top-0 h-full"
                  style={{
                    left: uPnL >= 0 ? "50%" : `${50 - Math.min(50, Math.abs(uPnLPct))}%`,
                    width: `${Math.min(50, Math.abs(uPnLPct))}%`,
                    background: uPnL >= 0 ? "var(--matrix-green)" : "var(--matrix-red)",
                    boxShadow: `0 0 4px ${uPnL >= 0 ? "var(--matrix-green)" : "var(--matrix-red)"}`,
                  }}
                />
              </div>
            </div>

            {/* Close buttons */}
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => closePosition("MANUAL", livePrice)}
                className="py-1.5 text-[10px] font-bold tracking-widest bg-[var(--matrix-red)] text-black hover:opacity-80"
                style={{ boxShadow: "0 0 6px rgba(255,59,59,0.5)" }}
              >
                ✕ CLOSE
              </button>
              <button
                onClick={() => {
                  if (position.stop && livePrice) closePosition("PARTIAL TP1", position.tp1 ?? livePrice);
                }}
                className="py-1.5 text-[10px] font-bold tracking-widest border border-[rgba(0,255,127,0.3)] text-[var(--matrix-green)] hover:bg-[rgba(0,255,127,0.1)]"
              >
                ✓ TP
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-xl matrix-text-dim mb-1">∅</div>
            <div className="text-[9px] matrix-text-dim tracking-widest">FLAT</div>
            <div className="text-[7px] text-[var(--matrix-green-dim)] mt-1 leading-tight">
              Execute AI signal<br />or wait for auto-exec
            </div>
          </div>
        )}
      </div>

      {/* Footer reset — compact */}
      <div className="border-t border-[rgba(0,255,127,0.12)] px-1.5 py-0.5 flex justify-between items-center flex-none">
        <span className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">
          SESSION: {pnl.trades}T
        </span>
        <button
          onClick={resetPnl}
          className="text-[8px] text-[var(--matrix-red)] hover:underline"
        >
          [RESET]
        </button>
      </div>
    </div>
  );
}

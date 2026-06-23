"use client";

import { useTradingStore } from "@/lib/store";
import { fmtPrice, fmtPct, fmtCompact } from "@/lib/format";

export default function MarketStatsPanel() {
  const { ticker, livePrice, prevPrice } = useTradingStore();

  if (!ticker) {
    return (
      <div className="matrix-panel flex flex-col h-full overflow-hidden">
        <div className="matrix-header flex-none">
          <span>📊 MARKET STATS</span>
        </div>
        <div className="p-4 text-xs matrix-text-dim">{"// LOADING..."}</div>
      </div>
    );
  }

  const priceUp = livePrice >= prevPrice;
  const priceColor = priceUp ? "var(--matrix-green)" : "var(--matrix-red)";
  const changeColor = ticker.changePct24h >= 0 ? "var(--matrix-green)" : "var(--matrix-red)";
  const fundingColor = ticker.fundingRate >= 0 ? "var(--matrix-green)" : "var(--matrix-red)";
  const oiChange = ticker.openInterest > 0 ? ticker.openInterest : 0;

  // Distance from 24h high/low
  const distFromHigh = ticker.high24h > 0 ? ((livePrice - ticker.high24h) / ticker.high24h) * 100 : 0;
  const distFromLow = ticker.low24h > 0 ? ((livePrice - ticker.low24h) / ticker.low24h) * 100 : 0;
  // Position in 24h range (0 = at low, 100 = at high)
  const rangePos = ticker.high24h > ticker.low24h
    ? ((livePrice - ticker.low24h) / (ticker.high24h - ticker.low24h)) * 100
    : 50;

  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>📊 MARKET STATS</span>
        <span className="text-[var(--matrix-green-dim)]">24H</span>
      </div>

      {/* Live price + change */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none">
        <div className="flex items-baseline justify-between">
          <span
            className="text-lg font-bold tabular-nums leading-tight"
            style={{ color: priceColor, textShadow: `0 0 4px ${priceColor}` }}
          >
            {fmtPrice(livePrice, livePrice < 10 ? 4 : 2)}
          </span>
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color: changeColor }}
          >
            {fmtPct(ticker.changePct24h)}
          </span>
        </div>
        <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mt-0.5">
          MARK PRICE
        </div>
      </div>

      {/* 24h range bar */}
      <div className="border-b border-[rgba(0,255,127,0.12)] p-1.5 flex-none">
        <div className="flex justify-between text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-1">
          <span>24H RANGE</span>
          <span className="matrix-text-amber">{rangePos.toFixed(0)}%</span>
        </div>
        <div className="relative h-1.5 bg-[rgba(0,255,127,0.06)]">
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-[var(--matrix-red)] to-[var(--matrix-green)]"
            style={{ width: `${Math.max(0, Math.min(100, rangePos))}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-white"
            style={{ left: `${Math.max(0, Math.min(100, rangePos))}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5 text-[7px] tabular-nums">
          <span className="matrix-text-red">L: {fmtPrice(ticker.low24h)}</span>
          <span className="matrix-text">H: {fmtPrice(ticker.high24h)}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-[rgba(0,255,127,0.08)] flex-none">
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">MARK</div>
          <div className="text-[10px] font-bold tabular-nums matrix-text-cyan leading-tight">
            {fmtPrice(ticker.markPrice)}
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">ORACLE</div>
          <div className="text-[10px] font-bold tabular-nums matrix-text leading-tight">
            {fmtPrice(ticker.oraclePrice)}
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">FUNDING</div>
          <div
            className="text-[10px] font-bold tabular-nums leading-tight"
            style={{ color: fundingColor }}
          >
            {(ticker.fundingRate * 100).toFixed(4)}%
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">OPEN INT</div>
          <div className="text-[10px] font-bold tabular-nums matrix-text-amber leading-tight">
            {fmtCompact(oiChange)}
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1 col-span-2">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">24H VOLUME</div>
          <div className="text-[11px] font-bold tabular-nums matrix-text-bright leading-tight">
            ${fmtCompact(ticker.volume24h)}
          </div>
        </div>
      </div>

      {/* Distance to high/low */}
      <div className="border-t border-[rgba(0,255,127,0.12)] p-1.5 flex-1 min-h-0 overflow-y-auto matrix-scroll">
        <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-1">DISTANCE</div>
        <div className="space-y-1">
          <div className="flex justify-between text-[8px]">
            <span className="text-[var(--matrix-green-dim)]">from 24H HIGH</span>
            <span className="matrix-text-red tabular-nums">{distFromHigh.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-[8px]">
            <span className="text-[var(--matrix-green-dim)]">from 24H LOW</span>
            <span className="matrix-text tabular-nums">+{distFromLow.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-[8px]">
            <span className="text-[var(--matrix-green-dim)]">24H CHANGE</span>
            <span style={{ color: changeColor }} className="tabular-nums">
              {ticker.change24h >= 0 ? "+" : "-"}${Math.abs(ticker.change24h).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Premium (mark vs oracle) */}
        <div className="mt-2 pt-1.5 border-t border-[rgba(0,255,127,0.08)]">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-1">PREMIUM</div>
          <div className="flex justify-between text-[8px]">
            <span className="text-[var(--matrix-green-dim)]">MARK vs ORACLE</span>
            <span
              className="tabular-nums font-bold"
              style={{
                color: ticker.markPrice >= ticker.oraclePrice ? "var(--matrix-green)" : "var(--matrix-red)",
              }}
            >
              {((ticker.markPrice - ticker.oraclePrice) / ticker.oraclePrice * 100).toFixed(3)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

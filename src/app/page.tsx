"use client";

import dynamic from "next/dynamic";
import { useTradingStore } from "@/lib/store";
import { useDataEngine } from "@/hooks/use-data-engine";
import TopBar from "@/components/terminal/top-bar";
import TickerStrip from "@/components/terminal/ticker-strip";
import LayerControl from "@/components/terminal/layer-control";
import MTFPanel from "@/components/terminal/mtf-panel";
import OrderflowPanel from "@/components/terminal/orderflow-panel";
import SMCPanel from "@/components/terminal/smc-panel";
import AISignalPanel from "@/components/terminal/ai-signal-panel";
import PositionPanel from "@/components/terminal/position-panel";
import OrderBookPanel from "@/components/terminal/orderbook-panel";
import SignalFeed from "@/components/terminal/signal-feed";
import MatrixRain from "@/components/terminal/matrix-rain";
import { fmtTimeUTC } from "@/lib/format";

const TradingChart = dynamic(() => import("@/components/terminal/trading-chart"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full matrix-text matrix-pulse text-sm">
      {"// INITIALIZING CHART ENGINE..."}
    </div>
  ),
});

export default function Home() {
  useDataEngine();
  const showRain = useTradingStore((s) => s.showMatrixRain);
  const connection = useTradingStore((s) => s.connection);
  const lastTick = useTradingStore((s) => s.lastTickAt);

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto md:overflow-hidden bg-[#020803] text-[var(--matrix-green)] flex flex-col"
      style={{ fontFamily: "var(--font-jetbrains), var(--font-geist-mono), monospace" }}
    >
      {/* Matrix rain background */}
      {showRain && (
        <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.5 }}>
          <MatrixRain opacity={0.12} fontSize={14} speed={70} />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex-none">
        <TopBar />
      </div>

      {/* Ticker strip */}
      <div className="relative z-10 flex-none">
        <TickerStrip />
      </div>

      {/*
        Main content — responsive layout
        - XL (≥1280px): chart 62% height, 6 panels in 6-col row, signal feed at bottom
        - LG (1024-1279px): chart 58% height, 6 panels in 6-col row
        - MD (768-1023px): chart 55% height, 6 panels in 3-col x 2-row grid
        - SM (<768px): chart 50% height, 2-col grid for panels, signal feed hidden into a tab
      */}
      <main className="relative z-10 flex-1 flex flex-col gap-1 p-1 min-h-0 md:min-h-0">
        {/* === FULL-WIDTH CHART ON TOP === */}
        <section
          className="matrix-panel relative min-h-0 flex-none overflow-hidden"
          style={{ height: "clamp(240px, 48vh, 65vh)" }}
        >
          <div className="matrix-header">
            <span className="truncate">▣ PROFESSIONAL CHART — BTCUSDT SCALP MATRIX</span>
            <div className="flex items-center gap-2 flex-none">
              <div className="hidden md:block">
                <LayerControl />
              </div>
              <span className="text-[var(--matrix-green-dim)] text-[9px] md:text-[10px] whitespace-nowrap">
                TICK: <span className="matrix-text">{lastTick ? fmtTimeUTC(lastTick) : "--:--:-- UTC"}</span>
              </span>
            </div>
          </div>
          <div className="absolute inset-0 top-7">
            <TradingChart height={400} />
          </div>
        </section>

        {/*
          === ANALYTICS PANELS GRID — RESPONSIVE ===
          XL/LG (≥1024px): 6 cols x 1 row, fixed height
          MD (768-1023px): 3 cols x 2 rows, fixed height
          SM (<768px): 2 cols x 3 rows, panel min-height enforced, section grows
          Responsive rules in globals.css under .analytics-grid
        */}
        <section
          className="analytics-grid grid gap-1 min-h-0 flex-none"
          style={{
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          }}
        >
          {/* Orderflow */}
          <div className="col-span-6 sm:col-span-3 md:col-span-2 lg:col-span-1 min-h-0 min-w-0">
            <OrderflowPanel />
          </div>
          {/* Order book */}
          <div className="col-span-6 sm:col-span-3 md:col-span-2 lg:col-span-1 min-h-0 min-w-0">
            <OrderBookPanel />
          </div>
          {/* MTF confirmation */}
          <div className="col-span-6 sm:col-span-3 md:col-span-2 lg:col-span-1 min-h-0 min-w-0">
            <MTFPanel />
          </div>
          {/* SMC structures */}
          <div className="col-span-6 sm:col-span-3 md:col-span-2 lg:col-span-1 min-h-0 min-w-0">
            <SMCPanel />
          </div>
          {/* AI signal */}
          <div className="col-span-6 sm:col-span-3 md:col-span-2 lg:col-span-1 min-h-0 min-w-0">
            <AISignalPanel />
          </div>
          {/* Position manager */}
          <div className="col-span-6 sm:col-span-3 md:col-span-2 lg:col-span-1 min-h-0 min-w-0">
            <PositionPanel />
          </div>
        </section>

        {/* === SIGNAL FEED — full-width strip at very bottom === */}
        <section className="flex-none" style={{ height: "clamp(70px, 10vh, 130px)" }}>
          <SignalFeed />
        </section>
      </main>

      {/* Footer status bar — compact on small screens */}
      <footer
        className="relative z-10 matrix-panel border-t border-[rgba(0,255,127,0.25)] flex items-center justify-between px-2 md:px-3 py-1 text-[8px] md:text-[9px] text-[var(--matrix-green-dim)] tracking-widest flex-none"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <span className="matrix-text-bright flex-none">NEO//LIQUID</span>
          <span className="hidden sm:inline flex-none">v2.7.1</span>
          <span className="hidden md:inline">DEX: HYPERLIQUID</span>
          <span className="hidden lg:inline">|</span>
          <span className="hidden lg:inline">AI: GLM-4 + SMC-FALLBACK</span>
          <span className="hidden xl:inline">|</span>
          <span className="hidden xl:inline">DATA: HL-API + BINANCE</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-none">
          <span className={connection === "LIVE" ? "matrix-text" : "matrix-text-amber"}>
            ● {connection}
          </span>
          <span className="hidden sm:inline">SCALP MATRIX</span>
        </div>
      </footer>
    </div>
  );
}

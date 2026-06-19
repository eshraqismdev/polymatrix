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
      className="relative h-screen w-screen overflow-hidden bg-[#020803] text-[var(--matrix-green)] flex flex-col"
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

      {/* Main content — chart full width on top, panels below */}
      <main className="relative z-10 flex-1 flex flex-col gap-1 p-1 min-h-0">
        {/* === FULL-WIDTH CHART ON TOP === */}
        <section className="matrix-panel relative min-h-0 flex-none" style={{ height: "62%" }}>
          <div className="matrix-header">
            <span>▣ PROFESSIONAL CHART — BTCUSDT SCALP MATRIX</span>
            <div className="flex items-center gap-3">
              <LayerControl />
              <span className="text-[var(--matrix-green-dim)]">
                TICK: <span className="matrix-text">{lastTick ? fmtTimeUTC(lastTick) : "--:--:-- UTC"}</span>
              </span>
            </div>
          </div>
          <div className="absolute inset-0 top-7">
            <TradingChart height={460} />
          </div>
        </section>

        {/* === ALL OTHER PANELS BELOW — HORIZONTAL GRID === */}
        <section className="grid grid-cols-12 gap-1 min-h-0 flex-1" style={{ height: "38%" }}>
          {/* Orderflow */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2 min-h-0">
            <OrderflowPanel />
          </div>
          {/* Order book */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2 min-h-0">
            <OrderBookPanel />
          </div>
          {/* MTF confirmation */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2 min-h-0">
            <MTFPanel />
          </div>
          {/* SMC structures */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2 min-h-0">
            <SMCPanel />
          </div>
          {/* AI signal */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2 min-h-0">
            <AISignalPanel />
          </div>
          {/* Position manager */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2 min-h-0">
            <PositionPanel />
          </div>
        </section>

        {/* === SIGNAL FEED — full-width strip at very bottom === */}
        <section className="flex-none" style={{ height: "120px" }}>
          <SignalFeed />
        </section>
      </main>

      {/* Footer status bar */}
      <footer
        className="relative z-10 matrix-panel border-t border-[rgba(0,255,127,0.25)] flex items-center justify-between px-3 py-1 text-[9px] text-[var(--matrix-green-dim)] tracking-widest flex-none"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        <div className="flex items-center gap-4">
          <span className="matrix-text-bright">NEO//LIQUID</span>
          <span>v2.7.1</span>
          <span className="hidden md:inline">DEX: HYPERLIQUID</span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">AI: GLM-4 + SMC-FALLBACK ENGINE</span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">DATA: HL-API + BINANCE-FALLBACK</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={connection === "LIVE" ? "matrix-text" : "matrix-text-amber"}>
            ● {connection}
          </span>
          <span>SCALP MATRIX TERMINAL — PAPER & REAL</span>
        </div>
      </footer>
    </div>
  );
}

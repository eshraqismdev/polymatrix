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
      <div className="relative z-10">
        <TopBar />
      </div>

      {/* Ticker strip */}
      <div className="relative z-10">
        <TickerStrip />
      </div>

      {/* Main grid */}
      <main className="relative z-10 flex-1 grid grid-cols-12 gap-1 p-1 min-h-0">
        {/* Left column: Orderflow + Orderbook */}
        <aside className="col-span-12 lg:col-span-2 grid grid-rows-2 gap-1 min-h-0 hidden lg:grid">
          <div className="min-h-0">
            <OrderflowPanel />
          </div>
          <div className="min-h-0">
            <OrderBookPanel />
          </div>
        </aside>

        {/* Center: Chart + MTF + SMC */}
        <section className="col-span-12 lg:col-span-7 grid grid-rows-[1fr_180px] gap-1 min-h-0">
          {/* Chart */}
          <div className="matrix-panel relative min-h-0 overflow-hidden">
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
              <TradingChart height={520} />
            </div>
          </div>

          {/* Bottom row under chart: MTF + SMC + Signal feed */}
          <div className="grid grid-cols-3 gap-1 min-h-0">
            <MTFPanel />
            <SMCPanel />
            <SignalFeed />
          </div>
        </section>

        {/* Right column: AI signal + Position */}
        <aside className="col-span-12 lg:col-span-3 grid grid-rows-2 gap-1 min-h-0 hidden lg:grid">
          <div className="min-h-0">
            <AISignalPanel />
          </div>
          <div className="min-h-0">
            <PositionPanel />
          </div>
        </aside>
      </main>

      {/* Footer status bar */}
      <footer
        className="relative z-10 matrix-panel border-t border-[rgba(0,255,127,0.25)] flex items-center justify-between px-3 py-1 text-[9px] text-[var(--matrix-green-dim)] tracking-widest"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        <div className="flex items-center gap-4">
          <span className="matrix-text-bright">NEO//LIQUID</span>
          <span>v2.7.1</span>
          <span className="hidden md:inline">DEX: HYPERLIQUID</span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">AI: GLM-4 SMC-ENGINE</span>
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

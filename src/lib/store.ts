"use client";

import { create } from "zustand";
import type {
  Candle,
  OrderBookSnapshot,
  Timeframe,
  MTFBias,
  ConnectionState,
  TickerStat,
  MarketEvent,
} from "./types";

interface TradingState {
  // connection
  connection: ConnectionState;
  dexName: string;
  lastTickAt: number;

  // market
  symbol: string;
  activeTimeframe: Timeframe;
  livePrice: number;
  prevPrice: number;
  ticker: TickerStat | null;
  candlesByTf: Partial<Record<Timeframe, Candle[]>>;
  orderbook: OrderBookSnapshot | null;

  // analysis
  mtfBias: MTFBias[];
  events: MarketEvent[];

  // ui
  showMatrixRain: boolean;
  showSMC: boolean;
  showOrderflow: boolean;
  showLiquidity: boolean;
  showFVG: boolean;
  showOB: boolean;
  showVolume: boolean;

  // setters
  setConnection: (c: ConnectionState) => void;
  setLastTick: (t: number) => void;
  setSymbol: (s: string) => void;
  setActiveTimeframe: (tf: Timeframe) => void;
  setLivePrice: (p: number) => void;
  setTicker: (t: TickerStat) => void;
  setCandles: (tf: Timeframe, c: Candle[]) => void;
  setOrderbook: (o: OrderBookSnapshot) => void;
  setMtfBias: (m: MTFBias[]) => void;
  pushEvent: (e: MarketEvent) => void;
  toggleMatrixRain: () => void;
  toggleLayer: (k: "showSMC" | "showOrderflow" | "showLiquidity" | "showFVG" | "showOB" | "showVolume") => void;
  clearEvents: () => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  connection: "CONNECTING",
  dexName: "HYPERLIQUID",
  lastTickAt: 0,

  symbol: "BTCUSDT",
  activeTimeframe: "5m",
  livePrice: 0,
  prevPrice: 0,
  ticker: null,
  candlesByTf: {},
  orderbook: null,

  mtfBias: [],
  events: [],

  showMatrixRain: true,
  showSMC: true,
  showOrderflow: true,
  showLiquidity: true,
  showFVG: true,
  showOB: true,
  showVolume: true,

  setConnection: (c) => set({ connection: c }),
  setLastTick: (t) => set({ lastTickAt: t }),
  setSymbol: (s) => set({ symbol: s }),
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  setLivePrice: (p) => set((st) => ({ livePrice: p, prevPrice: st.livePrice || p })),
  setTicker: (t) => set({ ticker: t }),
  setCandles: (tf, c) =>
    set((st) => ({ candlesByTf: { ...st.candlesByTf, [tf]: c } })),
  setOrderbook: (o) => set({ orderbook: o }),
  setMtfBias: (m) => set({ mtfBias: m }),
  pushEvent: (e) =>
    set((st) => ({ events: [e, ...st.events].slice(0, 80) })),
  toggleMatrixRain: () => set((st) => ({ showMatrixRain: !st.showMatrixRain })),
  toggleLayer: (k) => set((st) => ({ [k]: !st[k] }) as any),
  clearEvents: () => set({ events: [] }),
}));

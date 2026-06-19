"use client";

import { create } from "zustand";
import type {
  Candle,
  OrderBookSnapshot,
  Timeframe,
  TradingMode,
  Position,
  PnLState,
  TradeSignal,
  AISignal,
  MTFBias,
  ConnectionState,
  TickerStat,
} from "./types";
import { uid } from "./format";

interface TradingState {
  // connection
  connection: ConnectionState;
  dexName: string;
  walletAddress: string;
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
  aiSignal: AISignal | null;
  signalFeed: TradeSignal[];

  // mode & position
  mode: TradingMode;
  position: Position;
  pnl: PnLState;

  // ui
  showMatrixRain: boolean;
  showSMC: boolean;
  showOrderflow: boolean;
  showLiquidity: boolean;
  showFVG: boolean;
  showOB: boolean;
  showVolume: boolean;
  autoExecute: boolean;

  // setters
  setConnection: (c: ConnectionState) => void;
  setWalletAddress: (w: string) => void;
  setLastTick: (t: number) => void;
  setSymbol: (s: string) => void;
  setActiveTimeframe: (tf: Timeframe) => void;
  setLivePrice: (p: number) => void;
  setTicker: (t: TickerStat) => void;
  setCandles: (tf: Timeframe, c: Candle[]) => void;
  setOrderbook: (o: OrderBookSnapshot) => void;
  setMtfBias: (m: MTFBias[]) => void;
  setAiSignal: (s: AISignal | null) => void;
  pushSignal: (s: TradeSignal) => void;
  setMode: (m: TradingMode) => void;
  setPosition: (p: Position) => void;
  setPnl: (p: Partial<PnLState>) => void;
  toggleMatrixRain: () => void;
  toggleLayer: (k: "showSMC" | "showOrderflow" | "showLiquidity" | "showFVG" | "showOB" | "showVolume") => void;
  toggleAutoExecute: () => void;
  resetPnl: () => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  connection: "CONNECTING",
  dexName: "HYPERLIQUID",
  walletAddress: "0xNEO//LIQUID::TERMINAL",
  lastTickAt: 0,

  symbol: "BTCUSDT",
  activeTimeframe: "5m",
  livePrice: 0,
  prevPrice: 0,
  ticker: null,
  candlesByTf: {},
  orderbook: null,

  mtfBias: [],
  aiSignal: null,
  signalFeed: [],

  mode: "PAPER",
  position: {
    status: "FLAT",
    side: null,
    entry: null,
    stop: null,
    tp1: null,
    tp2: null,
    tp3: null,
    size: 0,
    leverage: 10,
    openedAt: null,
    liquidation: null,
    marginUsed: null,
  },
  pnl: {
    realized: 0,
    unrealized: 0,
    equity: 10_000,
    balance: 10_000,
    winRate: 0,
    trades: 0,
    wins: 0,
    losses: 0,
  },

  showMatrixRain: true,
  showSMC: true,
  showOrderflow: true,
  showLiquidity: true,
  showFVG: true,
  showOB: true,
  showVolume: true,
  autoExecute: false,

  setConnection: (c) => set({ connection: c }),
  setWalletAddress: (w) => set({ walletAddress: w }),
  setLastTick: (t) => set({ lastTickAt: t }),
  setSymbol: (s) => set({ symbol: s }),
  setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
  setLivePrice: (p) => set((st) => ({ livePrice: p, prevPrice: st.livePrice || p })),
  setTicker: (t) => set({ ticker: t }),
  setCandles: (tf, c) =>
    set((st) => ({ candlesByTf: { ...st.candlesByTf, [tf]: c } })),
  setOrderbook: (o) => set({ orderbook: o }),
  setMtfBias: (m) => set({ mtfBias: m }),
  setAiSignal: (s) => set({ aiSignal: s }),
  pushSignal: (s) =>
    set((st) => ({ signalFeed: [s, ...st.signalFeed].slice(0, 80) })),
  setMode: (m) => set({ mode: m }),
  setPosition: (p) => set({ position: p }),
  setPnl: (p) => set((st) => ({ pnl: { ...st.pnl, ...p } })),
  toggleMatrixRain: () => set((st) => ({ showMatrixRain: !st.showMatrixRain })),
  toggleLayer: (k) => set((st) => ({ [k]: !st[k] }) as any),
  toggleAutoExecute: () => set((st) => ({ autoExecute: !st.autoExecute })),
  resetPnl: () =>
    set({
      pnl: {
        realized: 0,
        unrealized: 0,
        equity: 10_000,
        balance: 10_000,
        winRate: 0,
        trades: 0,
        wins: 0,
        losses: 0,
      },
      signalFeed: [],
      position: {
        status: "FLAT",
        side: null,
        entry: null,
        stop: null,
        tp1: null,
        tp2: null,
        tp3: null,
        size: 0,
        leverage: 10,
        openedAt: null,
        liquidation: null,
        marginUsed: null,
      },
    }),
}));

// Helper: open a paper position
export function openPosition(
  side: "LONG" | "SHORT",
  entry: number,
  stop: number,
  tp1: number,
  tp2: number,
  tp3: number,
  leverage: number,
  riskPct: number,
) {
  const st = useTradingStore.getState();
  const balance = st.pnl.balance;
  const riskAmount = balance * (riskPct / 100);
  const stopDist = Math.abs(entry - stop);
  if (stopDist <= 0) return null;
  const size = riskAmount / stopDist;
  const marginUsed = (size * entry) / leverage;
  const liquidation =
    side === "LONG"
      ? entry - (entry / leverage) * 0.95
      : entry + (entry / leverage) * 0.95;

  const pos: Position = {
    status: "IN_POSITION",
    side,
    entry,
    stop,
    tp1,
    tp2,
    tp3,
    size,
    leverage,
    openedAt: Date.now(),
    liquidation,
    marginUsed,
  };
  useTradingStore.getState().setPosition(pos);
  useTradingStore.getState().pushSignal({
    id: uid(),
    ts: Date.now(),
    side,
    type: "ENTRY",
    price: entry,
    size,
    note: `${st.mode} ${side} opened | lev=${leverage}x size=${size.toFixed(4)} stop=${stop.toFixed(2)}`,
    confidence: 0,
  });
  return pos;
}

// Helper: close position
export function closePosition(reason: string, price: number) {
  const st = useTradingStore.getState();
  const pos = st.position;
  if (pos.status !== "IN_POSITION" || !pos.entry || !pos.side) return;

  const pnl =
    pos.side === "LONG"
      ? (price - pos.entry) * pos.size
      : (pos.entry - price) * pos.size;

  const wins = pnl > 0 ? st.pnl.wins + 1 : st.pnl.wins;
  const losses = pnl < 0 ? st.pnl.losses + 1 : st.pnl.losses;
  const trades = st.pnl.trades + 1;
  const balance = st.pnl.balance + pnl;
  const winRate = (wins / trades) * 100;

  useTradingStore.getState().setPnl({
    realized: st.pnl.realized + pnl,
    balance,
    equity: balance,
    wins,
    losses,
    trades,
    winRate,
  });
  useTradingStore.getState().pushSignal({
    id: uid(),
    ts: Date.now(),
    side: pos.side,
    type: pnl >= 0 ? "TP1" : "STOP",
    price,
    size: pos.size,
    note: `${reason} ${pnl >= 0 ? "[WIN]" : "[LOSS]"} PnL=${pnl.toFixed(2)} USD`,
  });
  useTradingStore.getState().setPosition({
    status: "FLAT",
    side: null,
    entry: null,
    stop: null,
    tp1: null,
    tp2: null,
    tp3: null,
    size: 0,
    leverage: 10,
    openedAt: null,
    liquidation: null,
    marginUsed: null,
  });
}

// Check if position should be auto-closed
export function checkPosition(price: number) {
  const st = useTradingStore.getState();
  const pos = st.position;
  if (pos.status !== "IN_POSITION" || !pos.entry || !pos.side || !pos.stop) return;

  const unrealized =
    pos.side === "LONG"
      ? (price - pos.entry) * pos.size
      : (pos.entry - price) * pos.size;

  useTradingStore.getState().setPnl({ unrealized, equity: st.pnl.balance + unrealized });

  // Stop loss hit
  if (pos.side === "LONG" && price <= pos.stop) {
    closePosition("STOP-LOSS", pos.stop);
    return;
  }
  if (pos.side === "SHORT" && price >= pos.stop) {
    closePosition("STOP-LOSS", pos.stop);
    return;
  }
  // TP1 hit → close half (sim: close all at TP1, partial TP2/3 in real mode)
  if (pos.side === "LONG" && pos.tp1 && price >= pos.tp1) {
    closePosition("TP1", pos.tp1);
    return;
  }
  if (pos.side === "SHORT" && pos.tp1 && price <= pos.tp1) {
    closePosition("TP1", pos.tp1);
    return;
  }
}

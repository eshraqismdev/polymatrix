// Core types for NEO//LIQUID market analytics terminal (educational / streaming)

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4H" | "1D" | "1W";

export interface Candle {
  t: number; // open time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // base volume
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  ts: number;
}

// SMC structures
export type StructureKind =
  | "BOS_BULL"
  | "BOS_BEAR"
  | "CHoCH_BULL"
  | "CHoCH_BEAR"
  | "FVG_BULL"
  | "FVG_BEAR"
  | "OB_BULL"
  | "OB_BEAR"
  | "LIQ_BSL"
  | "LIQ_SSL"
  | "SWEEP_BSL"
  | "SWEEP_SSL"
  | "EQH"
  | "EQL";

export interface SwingPoint {
  index: number;
  price: number;
  t: number;
  kind: "HIGH" | "LOW";
  strength: number;
}

export interface Structure {
  id: string;
  kind: StructureKind;
  t: number;
  index: number;
  top: number;
  bottom: number;
  label: string;
  price?: number;
  mitigated?: boolean;
}

export interface MTFBias {
  timeframe: Timeframe;
  trend: "BULL" | "BEAR" | "RANGE";
  bias: number; // -100..100
  lastStructure: StructureKind | null;
  liquidityAbove: number | null;
  liquidityBelow: number | null;
  price: number;
}

export interface OrderflowStats {
  cvd: number;
  delta: number;
  deltaEMA: number;
  buyPressure: number;
  sellPressure: number;
  absorption: "BUY" | "SELL" | "NONE";
  volumeNode: { price: number; volume: number }[];
  poc: number;
  vah: number;
  val: number;
}

// Market event log entry — replaces trade signals for streaming
export type MarketEventType =
  | "STRUCTURE"
  | "SWEEP"
  | "FVG"
  | "OB"
  | "LIQUIDITY"
  | "ABSORPTION"
  | "BIAS_SHIFT"
  | "INFO";

export interface MarketEvent {
  id: string;
  ts: number;
  type: MarketEventType;
  side: "BULL" | "BEAR" | "NEUTRAL";
  price: number;
  label: string;
  detail: string;
}

export interface TickerStat {
  symbol: string;
  price: number;
  change24h: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  fundingRate: number;
  openInterest: number;
  markPrice: number;
  oraclePrice: number;
}

export type ConnectionState =
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "OFFLINE";

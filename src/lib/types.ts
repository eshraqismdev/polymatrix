// Core trading types for NEO//LIQUID terminal

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W";

export type TradingMode = "PAPER" | "REAL";

export type Side = "LONG" | "SHORT";

export type PositionStatus = "FLAT" | "IN_POSITION" | "PENDING";

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
  strength: number; // number of bars confirmed
}

export interface Structure {
  id: string;
  kind: StructureKind;
  t: number;
  index: number;
  top: number;
  bottom: number;
  label: string;
  // optional reference price level
  price?: number;
  // is this structure still valid (un-mitigated)
  mitigated?: boolean;
}

export interface MTFBias {
  timeframe: Timeframe;
  trend: "BULL" | "BEAR" | "RANGE";
  bias: number; // -100..100, positive=bull
  lastStructure: StructureKind | null;
  liquidityAbove: number | null;
  liquidityBelow: number | null;
  price: number;
}

export interface OrderflowStats {
  cvd: number;          // cumulative volume delta
  delta: number;        // current candle delta
  deltaEMA: number;     // smoothed delta
  buyPressure: number;  // 0..1
  sellPressure: number; // 0..1
  absorption: "BUY" | "SELL" | "NONE";
  volumeNode: { price: number; volume: number }[];
  poc: number; // point of control
  vah: number; // value area high
  val: number; // value area low
}

export interface TradeSignal {
  id: string;
  ts: number;
  side: Side;
  type: "ENTRY" | "STOP" | "TP1" | "TP2" | "TP3" | "CANCEL" | "INFO" | "ALERT";
  price: number;
  size?: number;
  note: string;
  confidence?: number;
}

export interface AISignal {
  id: string;
  ts: number;
  side: Side | "NEUTRAL";
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr: number; // risk-reward ratio
  confidence: number; // 0..100
  bias: "BULL" | "BEAR" | "NEUTRAL";
  reasoning: string[];
  confluences: string[];
  invalidation: string;
  validityMs: number;
  source?: "AI" | "FALLBACK";
}

export interface Position {
  status: PositionStatus;
  side: Side | null;
  entry: number | null;
  stop: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  size: number;        // in base currency
  leverage: number;
  openedAt: number | null;
  liquidation: number | null;
  marginUsed: number | null;
}

export interface PnLState {
  realized: number;
  unrealized: number;
  equity: number;
  balance: number;
  winRate: number;
  trades: number;
  wins: number;
  losses: number;
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

"use client";

import { useEffect, useRef } from "react";
import { useTradingStore, checkPosition } from "@/lib/store";
import { analyzeSMC, analyzeOrderflow, buildTradePlan, buildMTFBias } from "@/lib/smc";
import { ALL_TF } from "@/lib/format";
import type { Candle, Timeframe, MTFBias, AISignal, TradeSignal } from "@/lib/types";

interface CandlesResponse {
  source: string;
  symbol: string;
  tf: Timeframe;
  candles: Candle[];
}

interface TickerResponse {
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

interface OrderbookResponse {
  source: string;
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  ts: number;
}

// Fetch candles for a single timeframe
async function fetchCandles(symbol: string, tf: Timeframe, limit = 300): Promise<CandlesResponse | null> {
  try {
    const r = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=${limit}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchTicker(symbol: string): Promise<TickerResponse | null> {
  try {
    const r = await fetch(`/api/ticker?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchOrderbook(symbol: string): Promise<OrderbookResponse | null> {
  try {
    const r = await fetch(`/api/orderbook?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchAISignal(payload: any): Promise<AISignal | null> {
  try {
    const r = await fetch(`/api/ai-signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function useDataEngine() {
  const store = useTradingStore();
  const lastAiFetchRef = useRef<number>(0);
  const lastTickerRef = useRef<number>(0);
  const lastOBRef = useRef<number>(0);
  const lastMtfRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);

  // === Initial connection + candles for all timeframes ===
  useEffect(() => {
    mountedRef.current = true;
    store.setConnection("CONNECTING");

    async function bootstrap() {
      // Fetch ticker first
      const t = await fetchTicker(store.symbol);
      if (!t || !mountedRef.current) {
        store.setConnection("RECONNECTING");
        return;
      }
      store.setTicker(t);
      store.setLivePrice(t.price);
      store.setConnection("LIVE");

      // Fetch all timeframes in parallel
      const results = await Promise.all(
        ALL_TF.map((tf) => fetchCandles(store.symbol, tf, tf === "1W" ? 200 : tf === "1D" ? 250 : 300)),
      );
      if (!mountedRef.current) return;
      results.forEach((r, i) => {
        if (r && r.candles.length > 0) {
          store.setCandles(ALL_TF[i], r.candles);
        }
      });

      // Orderbook
      const ob = await fetchOrderbook(store.symbol);
      if (ob && mountedRef.current) {
        store.setOrderbook({ bids: ob.bids, asks: ob.asks, ts: ob.ts });
      }
    }

    bootstrap();

    return () => {
      mountedRef.current = false;
    };
  }, [store.symbol]);

  // === Polling loops ===
  useEffect(() => {
    if (!mountedRef.current) return;

    // Ticker poll: every 5s
    const tickerTimer = setInterval(async () => {
      const t = await fetchTicker(store.symbol);
      if (t && mountedRef.current) {
        store.setTicker(t);
        store.setLivePrice(t.price);
        store.setLastTick(Date.now());
        store.setConnection("LIVE");
        // Check position against new price
        checkPosition(t.price);
      }
    }, 5000);

    // Active TF candle poll: every 8s
    const candleTimer = setInterval(async () => {
      const r = await fetchCandles(store.symbol, store.activeTimeframe, 300);
      if (r && mountedRef.current && r.candles.length > 0) {
        store.setCandles(store.activeTimeframe, r.candles);
        // Also fetch 1m for fresh orderflow
        if (store.activeTimeframe !== "1m") {
          const r1m = await fetchCandles(store.symbol, "1m", 200);
          if (r1m && mountedRef.current) store.setCandles("1m", r1m.candles);
        }
      }
    }, 8000);

    // Orderbook poll: every 2s
    const obTimer = setInterval(async () => {
      const ob = await fetchOrderbook(store.symbol);
      if (ob && mountedRef.current) {
        store.setOrderbook({ bids: ob.bids, asks: ob.asks, ts: ob.ts });
      }
    }, 2000);

    return () => {
      clearInterval(tickerTimer);
      clearInterval(candleTimer);
      clearInterval(obTimer);
    };
  }, [store.symbol, store.activeTimeframe]);

  // === Compute MTF bias + AI signal when data updates ===
  useEffect(() => {
    if (!mountedRef.current) return;
    const candlesByTf = store.candlesByTf;
    const live = store.livePrice;
    if (!live || live <= 0) return;

    // Recompute MTF every 5s
    const now = Date.now();
    if (now - lastMtfRef.current < 4000) return;
    lastMtfRef.current = now;

    const allTfReady = ALL_TF.every((tf) => (candlesByTf[tf]?.length ?? 0) > 30);
    if (!allTfReady) return;

    try {
      const mtf: MTFBias[] = buildMTFBias(candlesByTf as Record<Timeframe, Candle[]>, live);
      store.setMtfBias(mtf);
    } catch (e) {
      console.error("MTF error", e);
    }
  }, [store.candlesByTf, store.livePrice]);

  // === AI signal generation — every 25s ===
  useEffect(() => {
    if (!mountedRef.current) return;
    const candles = store.candlesByTf[store.activeTimeframe];
    if (!candles || candles.length < 30 || store.livePrice <= 0) return;

    const now = Date.now();
    if (now - lastAiFetchRef.current < 22000) return;
    lastAiFetchRef.current = now;

    let cancelled = false;

    async function generate() {
      try {
        const tfCandles = store.candlesByTf[store.activeTimeframe]!;
        const smc = analyzeSMC(tfCandles);
        const orderflow = analyzeOrderflow(tfCandles, 80);
        const plan = buildTradePlan(tfCandles, smc, orderflow, store.livePrice);

        const payload = {
          symbol: store.symbol,
          livePrice: store.livePrice,
          mode: store.mode,
          mtfBias: store.mtfBias.map((m) => ({
            timeframe: m.timeframe,
            trend: m.trend,
            bias: m.bias,
            lastStructure: m.lastStructure,
            liquidityAbove: m.liquidityAbove,
            liquidityBelow: m.liquidityBelow,
          })),
          smc: {
            trendBias: smc.trendBias,
            recentStructures: smc.structures.slice(-6).map((s) => s.label),
            fvgs: smc.fvgs.slice(-10).map((f) => ({ kind: f.kind, top: f.top, bottom: f.bottom, mitigated: !!f.mitigated })),
            orderBlocks: smc.orderBlocks.slice(-10).map((o) => ({ kind: o.kind, top: o.top, bottom: o.bottom, mitigated: !!o.mitigated })),
            liquidity: smc.liquidity.slice(-15).map((l) => ({ kind: l.kind, price: l.price ?? 0, label: l.label })),
          },
          orderflow: {
            cvd: orderflow.cvd,
            delta: orderflow.delta,
            deltaEMA: orderflow.deltaEMA,
            buyPressure: orderflow.buyPressure,
            sellPressure: orderflow.sellPressure,
            absorption: orderflow.absorption,
            poc: orderflow.poc,
            vah: orderflow.vah,
            val: orderflow.val,
          },
          plan: plan
            ? {
                side: plan.side,
                entry: plan.entry,
                stop: plan.stop,
                tp1: plan.tp1,
                tp2: plan.tp2,
                tp3: plan.tp3,
                rr: plan.rr,
                confidence: plan.confidence,
                reasons: plan.reasons,
              }
            : null,
        };

        const sig = await fetchAISignal(payload);
        if (cancelled || !sig) return;
        const prevSig = store.aiSignal;
        // Only update if signal side or key levels changed, or if expired
        const changed =
          !prevSig ||
          prevSig.side !== sig.side ||
          Math.abs(prevSig.entry - sig.entry) > sig.entry * 0.0005 ||
          Date.now() - prevSig.ts > prevSig.validityMs;
        if (changed) {
          store.setAiSignal(sig);
          // Push to feed if not neutral
          if (sig.side !== "NEUTRAL") {
            const feedSig: TradeSignal = {
              id: sig.id,
              ts: sig.ts,
              side: sig.side as "LONG" | "SHORT",
              type: "INFO",
              price: sig.entry,
              note: `AI ${sig.side} sig | entry=${sig.entry.toFixed(2)} stop=${sig.stop.toFixed(2)} tp1=${sig.tp1.toFixed(2)} conf=${sig.confidence.toFixed(0)}% rr=${sig.rr.toFixed(2)}`,
              confidence: sig.confidence,
            };
            store.pushSignal(feedSig);
          }
        }
      } catch (e) {
        console.error("AI signal error", e);
      }
    }
    generate();

    return () => {
      cancelled = true;
    };
  }, [store.candlesByTf, store.livePrice, store.mode, store.activeTimeframe]);
}

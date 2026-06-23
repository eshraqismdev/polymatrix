"use client";

import { useEffect, useRef } from "react";
import { useTradingStore } from "@/lib/store";
import { analyzeSMC, analyzeOrderflow, buildMTFBias } from "@/lib/smc";
import { ALL_TF, uid } from "@/lib/format";
import type { Candle, Timeframe, MTFBias, MarketEvent, Structure } from "@/lib/types";

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

// Detect new SMC structures and push them as market events for the streaming log
function detectNewStructures(
  prev: Structure[],
  curr: Structure[],
  livePrice: number,
): MarketEvent[] {
  const prevIds = new Set(prev.map((s) => s.id));
  const newOnes = curr.filter((s) => !prevIds.has(s.id));
  return newOnes.slice(-3).map((s) => {
    let type: MarketEvent["type"] = "STRUCTURE";
    if (s.kind.startsWith("SWEEP")) type = "SWEEP";
    else if (s.kind.startsWith("FVG")) type = "FVG";
    else if (s.kind.startsWith("OB")) type = "OB";
    else if (s.kind.startsWith("LIQ") || s.kind.startsWith("EQ")) type = "LIQUIDITY";

    const side: MarketEvent["side"] =
      s.kind.includes("BULL") || s.kind === "SWEEP_SSL" || s.kind === "LIQ_SSL" || s.kind === "EQL"
        ? "BULL"
        : s.kind.includes("BEAR") || s.kind === "SWEEP_BSL" || s.kind === "LIQ_BSL" || s.kind === "EQH"
        ? "BEAR"
        : "NEUTRAL";

    const detail =
      s.price != null
        ? `${s.label} @ ${s.price.toFixed(2)}`
        : `${s.label} ${s.bottom.toFixed(2)}–${s.top.toFixed(2)}`;

    return {
      id: uid(),
      ts: s.t,
      type,
      side,
      price: s.price ?? livePrice,
      label: s.label,
      detail,
    };
  });
}

export function useDataEngine() {
  const store = useTradingStore();
  const lastMtfRef = useRef<number>(0);
  const lastEventScanRef = useRef<number>(0);
  const prevStructuresRef = useRef<Structure[]>([]);
  const prevTrendRef = useRef<string>("");
  const mountedRef = useRef<boolean>(true);

  // === Initial connection + candles for all timeframes ===
  useEffect(() => {
    mountedRef.current = true;
    store.setConnection("CONNECTING");

    async function bootstrap() {
      const t = await fetchTicker(store.symbol);
      if (!t || !mountedRef.current) {
        store.setConnection("RECONNECTING");
        return;
      }
      store.setTicker(t);
      store.setLivePrice(t.price);
      store.setConnection("LIVE");

      const results = await Promise.all(
        ALL_TF.map((tf) => fetchCandles(store.symbol, tf, tf === "1W" ? 200 : tf === "1D" ? 250 : 300)),
      );
      if (!mountedRef.current) return;
      results.forEach((r, i) => {
        if (r && r.candles.length > 0) {
          store.setCandles(ALL_TF[i], r.candles);
        }
      });

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

    const tickerTimer = setInterval(async () => {
      const t = await fetchTicker(store.symbol);
      if (t && mountedRef.current) {
        store.setTicker(t);
        store.setLivePrice(t.price);
        store.setLastTick(Date.now());
        store.setConnection("LIVE");
      }
    }, 5000);

    const candleTimer = setInterval(async () => {
      const r = await fetchCandles(store.symbol, store.activeTimeframe, 300);
      if (r && mountedRef.current && r.candles.length > 0) {
        store.setCandles(store.activeTimeframe, r.candles);
        if (store.activeTimeframe !== "1m") {
          const r1m = await fetchCandles(store.symbol, "1m", 200);
          if (r1m && mountedRef.current) store.setCandles("1m", r1m.candles);
        }
      }
    }, 8000);

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

  // === Compute MTF bias ===
  useEffect(() => {
    if (!mountedRef.current) return;
    const candlesByTf = store.candlesByTf;
    const live = store.livePrice;
    if (!live || live <= 0) return;

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

  // === Scan for new SMC structures and push to event log ===
  useEffect(() => {
    if (!mountedRef.current) return;
    const candles = store.candlesByTf[store.activeTimeframe];
    if (!candles || candles.length < 30 || store.livePrice <= 0) return;

    const now = Date.now();
    if (now - lastEventScanRef.current < 6000) return;
    lastEventScanRef.current = now;

    try {
      const smc = analyzeSMC(candles);
      const allStructures = [
        ...smc.structures,
        ...smc.fvgs,
        ...smc.orderBlocks,
        ...smc.liquidity,
      ].sort((a, b) => b.t - a.t);

      const newEvents = detectNewStructures(prevStructuresRef.current, allStructures, store.livePrice);
      for (const ev of newEvents) {
        store.pushEvent(ev);
      }
      prevStructuresRef.current = allStructures;

      // Detect trend bias shift on active timeframe
      if (prevTrendRef.current && prevTrendRef.current !== smc.trendBias) {
        const side: MarketEvent["side"] =
          smc.trendBias === "BULL" ? "BULL" : smc.trendBias === "BEAR" ? "BEAR" : "NEUTRAL";
        const ev: MarketEvent = {
          id: uid(),
          ts: Date.now(),
          type: "BIAS_SHIFT",
          side,
          price: store.livePrice,
          label: `${prevTrendRef.current} → ${smc.trendBias}`,
          detail: `${store.activeTimeframe} bias shift to ${smc.trendBias}`,
        };
        store.pushEvent(ev);
      }
      prevTrendRef.current = smc.trendBias;
    } catch (e) {
      console.error("Event scan error", e);
    }
  }, [store.candlesByTf, store.livePrice, store.activeTimeframe]);

  // === Push orderflow absorption events ===
  const orderflowEventsRef = useRef<string>("");
  useEffect(() => {
    if (!mountedRef.current) return;
    const candles = store.candlesByTf[store.activeTimeframe];
    if (!candles || candles.length < 30) return;
    try {
      const of = analyzeOrderflow(candles, 80);
      if (of.absorption !== "NONE" && orderflowEventsRef.current !== of.absorption) {
        orderflowEventsRef.current = of.absorption;
        const ev: MarketEvent = {
          id: uid(),
          ts: Date.now(),
          type: "ABSORPTION",
          side: of.absorption === "BUY" ? "BULL" : "BEAR",
          price: store.livePrice,
          label: `${of.absorption} ABSORPTION`,
          detail: `${of.absorption}-side absorption at ${store.livePrice.toFixed(2)}`,
        };
        store.pushEvent(ev);
      } else if (of.absorption === "NONE") {
        orderflowEventsRef.current = "NONE";
      }
    } catch {
      // ignore
    }
  }, [store.candlesByTf, store.livePrice, store.activeTimeframe]);
}

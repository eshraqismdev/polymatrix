import { NextRequest, NextResponse } from "next/server";
import type { Candle, Timeframe } from "@/lib/types";
import { TF_TO_MS } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HL_BASE = "https://api.hyperliquid.xyz";

// Map our TF strings to Hyperliquid candle interval strings
const TF_HL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1W",
};

async function fetchHLCandles(
  coin: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const body = {
    type: "candles",
    coin,
    interval,
    startTime,
    endTime,
  };
  const res = await fetch(`${HL_BASE}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HL candles ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((c: any) => ({
    t: Number(c.t),
    o: Number(c.o),
    h: Number(c.h),
    l: Number(c.l),
    c: Number(c.c),
    v: Number(c.v),
  }));
}

async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<Candle[]> {
  // Binance is our fallback for BTCUSDT spot data (very reliable public API with CORS)
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = await res.json();
  return data.map((k: any[]) => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
}

// Binance interval mapping
const TF_BINANCE: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
};

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const symbolRaw = search.get("symbol") ?? "BTCUSDT";
  const tf = (search.get("tf") as Timeframe) ?? "5m";
  const limit = Math.min(parseInt(search.get("limit") ?? "300"), 1000);

  const coin = symbolRaw.replace(/USDT$/i, "").replace(/USD$/i, "");
  const hlInterval = TF_HL[tf];
  const binanceInterval = TF_BINANCE[tf];

  // Try Hyperliquid first (per the user's request to connect to a DEX)
  const now = Date.now();
  const startTime = now - TF_TO_MS[tf] * (limit + 50);

  try {
    let candles = await fetchHLCandles(coin, hlInterval, startTime, now);
    if (candles.length < 30) {
      // Fallback to Binance
      candles = await fetchBinanceKlines(symbolRaw, binanceInterval, limit);
    }
    if (candles.length === 0) {
      // Final fallback — synthesize from Binance
      candles = await fetchBinanceKlines("BTCUSDT", binanceInterval, limit);
    }
    return NextResponse.json({
      source: "HYPERLIQUID",
      symbol: symbolRaw,
      tf,
      candles: candles.slice(-limit),
    });
  } catch (e: any) {
    try {
      const candles = await fetchBinanceKlines(symbolRaw, binanceInterval, limit);
      return NextResponse.json({
        source: "BINANCE_FALLBACK",
        symbol: symbolRaw,
        tf,
        candles: candles.slice(-limit),
      });
    } catch (e2: any) {
      return NextResponse.json(
        { error: e2.message ?? "Failed to fetch candles" },
        { status: 500 },
      );
    }
  }
}

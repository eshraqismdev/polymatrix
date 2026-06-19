import { NextRequest, NextResponse } from "next/server";
import type { OrderBookSnapshot, OrderBookLevel } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HL_BASE = "https://api.hyperliquid.xyz";

async function fetchHLBook(coin: string): Promise<OrderBookSnapshot | null> {
  const body = { type: "l2Book", coin };
  const res = await fetch(`${HL_BASE}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  const bids: OrderBookLevel[] = (data.levels?.bids ?? []).slice(0, 30).map((l: any[]) => ({
    price: parseFloat(l[0]),
    size: parseFloat(l[1]),
  }));
  const asks: OrderBookLevel[] = (data.levels?.asks ?? []).slice(0, 30).map((l: any[]) => ({
    price: parseFloat(l[0]),
    size: parseFloat(l[1]),
  }));
  return { bids, asks, ts: Date.now() };
}

async function fetchBinanceOB(symbol: string): Promise<OrderBookSnapshot | null> {
  const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=50`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const bids: OrderBookLevel[] = (data.bids ?? []).slice(0, 30).map((l: any[]) => ({
    price: parseFloat(l[0]),
    size: parseFloat(l[1]),
  }));
  const asks: OrderBookLevel[] = (data.asks ?? []).slice(0, 30).map((l: any[]) => ({
    price: parseFloat(l[0]),
    size: parseFloat(l[1]),
  }));
  return { bids, asks, ts: Date.now() };
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const symbolRaw = search.get("symbol") ?? "BTCUSDT";
  const coin = symbolRaw.replace(/USDT$/i, "").replace(/USD$/i, "");

  try {
    let book = await fetchHLBook(coin);
    if (!book || (book.bids.length === 0 && book.asks.length === 0)) {
      book = await fetchBinanceOB(symbolRaw);
    }
    if (!book) {
      return NextResponse.json({ error: "No orderbook" }, { status: 502 });
    }
    return NextResponse.json({ source: "HYPERLIQUID", ...book });
  } catch (e: any) {
    const book = await fetchBinanceOB(symbolRaw);
    if (!book) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ source: "BINANCE_FALLBACK", ...book });
  }
}

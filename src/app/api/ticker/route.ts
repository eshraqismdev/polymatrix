import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HL_BASE = "https://api.hyperliquid.xyz";

async function fetchHLMeta(coin: string) {
  // Get allAssetCtxs and meta to derive funding, OI, mark price for our coin
  try {
    const res = await fetch(`${HL_BASE}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data[0] ?? {};
    const ctxs = data[1] ?? [];
    const idx = (meta.universe ?? []).findIndex(
      (u: any) => u.name.toUpperCase() === coin.toUpperCase(),
    );
    if (idx < 0) return null;
    const ctx = ctxs[idx];
    return {
      markPrice: parseFloat(ctx?.markPx ?? "0"),
      oraclePrice: parseFloat(ctx?.oraclePx ?? "0"),
      fundingRate: parseFloat(ctx?.funding ?? "0"),
      openInterest: parseFloat(ctx?.openInterest ?? "0"),
      prevDayPx: parseFloat(ctx?.prevDayPx ?? "0"),
    };
  } catch {
    return null;
  }
}

async function fetchBinanceTicker(symbol: string) {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const d = await res.json();
  return {
    price: parseFloat(d.lastPrice),
    change24h: parseFloat(d.priceChange),
    changePct24h: parseFloat(d.priceChangePercent),
    high24h: parseFloat(d.highPrice),
    low24h: parseFloat(d.lowPrice),
    volume24h: parseFloat(d.quoteVolume),
  };
}

async function fetchBinanceFunding(symbol: string) {
  try {
    const sym = symbol.replace(/USDT$/, "USDT");
    const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      fundingRate: parseFloat(d.lastFundingRate ?? "0"),
      markPrice: parseFloat(d.markPrice ?? "0"),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const symbol = search.get("symbol") ?? "BTCUSDT";
  const coin = symbol.replace(/USDT$/i, "").replace(/USD$/i, "");

  const binance = await fetchBinanceTicker(symbol);
  if (!binance) {
    return NextResponse.json({ error: "Ticker fetch failed" }, { status: 502 });
  }
  const funding = await fetchBinanceFunding(symbol);
  const hl = await fetchHLMeta(coin);

  return NextResponse.json({
    symbol,
    price: binance.price,
    change24h: binance.change24h,
    changePct24h: binance.changePct24h,
    high24h: binance.high24h,
    low24h: binance.low24h,
    volume24h: binance.volume24h,
    fundingRate: funding?.fundingRate ?? hl?.fundingRate ?? 0,
    openInterest: hl?.openInterest ?? 0,
    markPrice: funding?.markPrice ?? hl?.markPrice ?? binance.price,
    oraclePrice: hl?.oraclePrice ?? funding?.markPrice ?? binance.price,
  });
}

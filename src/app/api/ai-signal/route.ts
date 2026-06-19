import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface AnalysisInput {
  symbol: string;
  livePrice: number;
  mtfBias: Array<{
    timeframe: string;
    trend: string;
    bias: number;
    lastStructure: string | null;
    liquidityAbove: number | null;
    liquidityBelow: number | null;
  }>;
  smc: {
    trendBias: string;
    recentStructures: string[];
    fvgs: Array<{ kind: string; top: number; bottom: number; mitigated: boolean }>;
    orderBlocks: Array<{ kind: string; top: number; bottom: number; mitigated: boolean }>;
    liquidity: Array<{ kind: string; price: number; label: string }>;
  };
  orderflow: {
    cvd: number;
    delta: number;
    deltaEMA: number;
    buyPressure: number;
    sellPressure: number;
    absorption: string;
    poc: number;
    vah: number;
    val: number;
  };
  plan?: {
    side: string;
    entry: number;
    stop: number;
    tp1: number;
    tp2: number;
    tp3: number;
    rr: number;
    confidence: number;
    reasons: string[];
  } | null;
  mode: string;
}

export async function POST(req: NextRequest) {
  try {
    const input: AnalysisInput = await req.json();

    const prompt = `You are NEO//LIQUID, an elite institutional liquidity analyst AI specialized in Smart Money Concepts (SMC) and orderflow trading for crypto scalping. Your role is to provide a high-conviction trade plan based on the live market data below.

LIVE MARKET DATA — ${input.symbol} @ ${input.livePrice}

=== MULTI-TIMEFRAME BIAS ===
${input.mtfBias.map((m) => `${m.timeframe}: trend=${m.trend}, bias=${m.bias.toFixed(0)}, lastStruct=${m.lastStructure ?? "-"}, liqAbove=${m.liquidityAbove ?? "-"}, liqBelow=${m.liquidityBelow ?? "-"}`).join("\n")}

=== SMC STRUCTURE (entry TF) ===
Trend bias: ${input.smc.trendBias}
Recent structures: ${input.smc.recentStructures.join(", ") || "none"}
Active FVGs: ${input.smc.fvgs.filter(f => !f.mitigated).map(f => `${f.kind} ${f.bottom}-${f.top}`).join(", ") || "none"}
Active Order Blocks: ${input.smc.orderBlocks.filter(o => !o.mitigated).map(o => `${o.kind} ${o.bottom}-${o.top}`).join(", ") || "none"}
Liquidity pools: ${input.smc.liquidity.map(l => `${l.label}@${l.price}`).join(", ") || "none"}

=== ORDERFLOW ===
CVD: ${input.orderflow.cvd.toFixed(2)}
Delta (current): ${input.orderflow.delta.toFixed(2)}
Delta EMA: ${input.orderflow.deltaEMA.toFixed(2)}
Buy pressure: ${(input.orderflow.buyPressure * 100).toFixed(1)}%
Sell pressure: ${(input.orderflow.sellPressure * 100).toFixed(1)}%
Absorption: ${input.orderflow.absorption}
POC: ${input.orderflow.poc}
VAH: ${input.orderflow.vah}
VAL: ${input.orderflow.val}

=== SYSTEM-PROPOSED PLAN ===
${input.plan ? `Side: ${input.plan.side} | Entry: ${input.plan.entry} | Stop: ${input.plan.stop} | TP1: ${input.plan.tp1} | TP2: ${input.plan.tp2} | TP3: ${input.plan.tp3} | RR: ${input.plan.rr.toFixed(2)} | Confidence: ${input.plan.confidence}` : "No high-conviction plan found — provide your own or stay flat."}

Trading mode: ${input.mode}

Respond STRICTLY in JSON (no prose, no markdown fences) with this schema:
{
  "side": "LONG" | "SHORT" | "NEUTRAL",
  "entry": number,
  "stop": number,
  "tp1": number,
  "tp2": number,
  "tp3": number,
  "rr": number,
  "confidence": number (0-100),
  "bias": "BULL" | "BEAR" | "NEUTRAL",
  "reasoning": [string, ...],   // 3-6 bullets explaining the thesis
  "confluences": [string, ...], // list of aligned confluence factors
  "invalidation": string,       // what would invalidate this thesis
  "validityMs": number          // how long this signal is valid (15000-300000)
}

Rules:
- Only output LONG or SHORT if MTF bias aligns across at least 3 of 6 timeframes.
- If orderflow diverges from structure, reduce confidence by 20+.
- Stop must sit beyond a real liquidity pool, not just a round number.
- TP1 must target a real opposite liquidity pool, TP2 and TP3 extend further.
- If no edge, return NEUTRAL with entry = livePrice, stop/tp = livePrice.
- Be specific about which FVG/OB/liquidity you're using. Reference prices exactly.
- Keep reasoning bullets short (1 line each).`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a JSON-only trading signal generator. Always respond with valid JSON, no prose, no code fences." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });

    let raw = completion.choices?.[0]?.message?.content ?? "";
    raw = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    // Try to extract first JSON object
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(raw);
    // Ensure numeric fields
    const ensureNum = (v: any, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
    return NextResponse.json({
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      side: ["LONG", "SHORT", "NEUTRAL"].includes(parsed.side) ? parsed.side : "NEUTRAL",
      entry: ensureNum(parsed.entry, input.livePrice),
      stop: ensureNum(parsed.stop, input.livePrice),
      tp1: ensureNum(parsed.tp1, input.livePrice),
      tp2: ensureNum(parsed.tp2, input.livePrice),
      tp3: ensureNum(parsed.tp3, input.livePrice),
      rr: ensureNum(parsed.rr, 0),
      confidence: Math.max(0, Math.min(100, ensureNum(parsed.confidence, 0))),
      bias: ["BULL", "BEAR", "NEUTRAL"].includes(parsed.bias) ? parsed.bias : "NEUTRAL",
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 8) : [],
      confluences: Array.isArray(parsed.confluences) ? parsed.confluences.slice(0, 8) : [],
      invalidation: typeof parsed.invalidation === "string" ? parsed.invalidation : "—",
      validityMs: ensureNum(parsed.validityMs, 60000),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        id: `ai_err_${Date.now()}`,
        ts: Date.now(),
        side: "NEUTRAL",
        entry: 0,
        stop: 0,
        tp1: 0,
        tp2: 0,
        tp3: 0,
        rr: 0,
        confidence: 0,
        bias: "NEUTRAL",
        reasoning: [`AI inference error: ${e?.message ?? "unknown"}`],
        confluences: [],
        invalidation: "AI unavailable",
        validityMs: 30000,
      },
      { status: 200 },
    );
  }
}

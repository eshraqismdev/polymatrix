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

// ============================================================================
// LOCAL FALLBACK SIGNAL GENERATOR
// Produces a high-quality deterministic signal from SMC + orderflow + MTF
// data when the LLM API is rate-limited or unavailable. This ensures the
// signal engine ALWAYS returns a usable trade plan.
// ============================================================================
function buildLocalSignal(input: AnalysisInput, source: "AI" | "FALLBACK") {
  const live = input.livePrice;
  const mtf = input.mtfBias;
  const smc = input.smc;
  const of = input.orderflow;
  const plan = input.plan;

  // Use the system-proposed plan if available (it's already derived from
  // SMC + liquidity). Otherwise synthesize from MTF bias.
  const bullCount = mtf.filter((m) => m.trend === "BULL").length;
  const bearCount = mtf.filter((m) => m.trend === "BEAR").length;
  const aggBias = mtf.length > 0 ? mtf.reduce((s, m) => s + m.bias, 0) / mtf.length : 0;

  let side: "LONG" | "SHORT" | "NEUTRAL";
  let entry: number, stop: number, tp1: number, tp2: number, tp3: number;
  let rr: number;
  let confidence: number;
  let bias: "BULL" | "BEAR" | "NEUTRAL";
  const reasoning: string[] = [];
  const confluences: string[] = [];
  let invalidation: string;

  if (plan && plan.side !== "NEUTRAL" && plan.rr >= 1) {
    // Trust the system plan — it has real FVG/OB/liquidity levels
    side = plan.side as "LONG" | "SHORT";
    entry = plan.entry;
    stop = plan.stop;
    tp1 = plan.tp1;
    tp2 = plan.tp2;
    tp3 = plan.tp3;
    rr = plan.rr;
    confidence = Math.min(85, plan.confidence);
    bias = side === "LONG" ? "BULL" : "BEAR";

    reasoning.push(`Entry at ${entry.toFixed(2)} — ${plan.reasons[0] ?? "SMC-aligned zone"}`);
    if (smc.trendBias !== "RANGE") {
      reasoning.push(`${smc.trendBias} structure confirmed on entry timeframe`);
      confluences.push(`${smc.trendBias} Trend Structure`);
    }
    if (of.absorption !== "NONE") {
      reasoning.push(`${of.absorption}-side absorption detected at ${live.toFixed(2)}`);
      confluences.push(`${of.absorption} Absorption`);
    }
    if (side === "LONG" && of.buyPressure > 0.55) {
      reasoning.push(`Buy-side orderflow dominance (${(of.buyPressure * 100).toFixed(0)}%)`);
      confluences.push(`Bullish Orderflow`);
    }
    if (side === "SHORT" && of.sellPressure > 0.55) {
      reasoning.push(`Sell-side orderflow dominance (${(of.sellPressure * 100).toFixed(0)}%)`);
      confluences.push(`Bearish Orderflow`);
    }
    if (bullCount >= 4 || bearCount >= 4) {
      reasoning.push(`Strong MTF alignment: ${bullCount}B / ${bearCount}S across 6 timeframes`);
      confluences.push(`MTF Alignment ${Math.max(bullCount, bearCount)}/6`);
    }
    const sweeps = smc.liquidity.filter((l) => l.kind.startsWith("SWEEP"));
    if (sweeps.length > 0) {
      reasoning.push(`Liquidity sweep confirmation: ${sweeps.at(-1)!.label} @ ${sweeps.at(-1)!.price}`);
      confluences.push(`Liquidity Sweep`);
    }
    if (rr >= 2) {
      confluences.push(`RR ≥ 2.0 (${rr.toFixed(2)}R)`);
    }
    invalidation = `Price closes beyond stop at ${stop.toFixed(2)} (invalidates ${side.toLowerCase()} thesis)`;
  } else if (Math.abs(aggBias) >= 30 && Math.max(bullCount, bearCount) >= 4) {
    // No system plan but strong MTF alignment — synthesize from MTF
    side = aggBias > 0 ? "LONG" : "SHORT";
    bias = aggBias > 0 ? "BULL" : "BEAR";

    // Find liquidity levels from MTF
    const liqAbove = mtf.map((m) => m.liquidityAbove).filter(Boolean) as number[];
    const liqBelow = mtf.map((m) => m.liquidityBelow).filter(Boolean) as number[];
    const smcLiq = smc.liquidity;

    if (side === "LONG") {
      entry = live;
      const ssl = liqBelow.filter((p) => p < live).sort((a, b) => b - a)[0] ??
        smcLiq.filter((l) => (l.kind === "LIQ_SSL" || l.kind === "EQL") && l.price < live)
          .map((l) => l.price).sort((a, b) => b - a)[0] ??
        live * 0.99;
      stop = ssl - live * 0.001;
      const bsl = liqAbove.filter((p) => p > live).sort((a, b) => a - b)[0] ??
        smcLiq.filter((l) => (l.kind === "LIQ_BSL" || l.kind === "EQH") && l.price > live)
          .map((l) => l.price).sort((a, b) => a - b)[0] ??
        live * 1.015;
      tp1 = bsl;
      tp2 = bsl + (bsl - entry) * 0.6;
      tp3 = bsl + (bsl - entry) * 1.4;
    } else {
      entry = live;
      const bsl = liqAbove.filter((p) => p > live).sort((a, b) => a - b)[0] ??
        smcLiq.filter((l) => (l.kind === "LIQ_BSL" || l.kind === "EQH") && l.price > live)
          .map((l) => l.price).sort((a, b) => a - b)[0] ??
        live * 1.01;
      stop = bsl + live * 0.001;
      const ssl = liqBelow.filter((p) => p < live).sort((a, b) => b - a)[0] ??
        smcLiq.filter((l) => (l.kind === "LIQ_SSL" || l.kind === "EQL") && l.price < live)
          .map((l) => l.price).sort((a, b) => b - a)[0] ??
        live * 0.985;
      tp1 = ssl;
      tp2 = ssl - (entry - ssl) * 0.6;
      tp3 = ssl - (entry - ssl) * 1.4;
    }
    const risk = Math.abs(entry - stop);
    rr = Math.abs(tp1 - entry) / Math.max(risk, 1e-9);

    if (rr < 1) {
      // Insufficient RR — fall back to neutral
      side = "NEUTRAL";
      bias = "NEUTRAL";
      entry = live; stop = live; tp1 = live; tp2 = live; tp3 = live;
      rr = 0;
      confidence = 35;
      reasoning.push(`MTF alignment present (${bullCount}B / ${bearCount}S) but RR insufficient (${rr.toFixed(2)})`);
      reasoning.push(`No clean SMC entry zone (FVG/OB) within range — wait for pullback`);
      invalidation = `Wait for price to tap an unmitigated FVG or OB before engaging`;
    } else {
      confidence = Math.min(70, 45 + Math.max(bullCount, bearCount) * 4);
      reasoning.push(`${side} bias from ${Math.max(bullCount, bearCount)}/6 timeframe alignment (aggBias=${aggBias.toFixed(0)})`);
      reasoning.push(`Entry at market ${entry.toFixed(2)} — stop beyond ${side === "LONG" ? "SSL" : "BSL"} at ${stop.toFixed(2)}`);
      reasoning.push(`TP1 targets opposite liquidity at ${tp1.toFixed(2)} (RR=${rr.toFixed(2)})`);
      if (of.absorption !== "NONE") {
        reasoning.push(`${of.absorption} absorption at current price`);
        confluences.push(`${of.absorption} Absorption`);
      }
      confluences.push(`MTF Alignment ${Math.max(bullCount, bearCount)}/6`);
      confluences.push(`${smc.trendBias !== "RANGE" ? smc.trendBias + " Structure" : "Range Structure"}`);
      invalidation = `Price closes beyond stop at ${stop.toFixed(2)}`;
    }
  } else {
    // No edge — neutral
    side = "NEUTRAL";
    bias = "NEUTRAL";
    entry = live; stop = live; tp1 = live; tp2 = live; tp3 = live;
    rr = 0;
    confidence = 30;
    reasoning.push(`No high-conviction edge: MTF alignment only ${Math.max(bullCount, bearCount)}/6 (need ≥4)`);
    reasoning.push(`Aggregate bias ${aggBias.toFixed(0)} (need |bias| ≥ 30)`);
    reasoning.push(`Orderflow: CVD ${of.cvd.toFixed(1)}, buy pressure ${(of.buyPressure * 100).toFixed(0)}%, absorption ${of.absorption}`);
    reasoning.push(`Recommendation: WAIT for liquidity sweep + MTF alignment before engaging`);
    invalidation = `Wait for stronger setup — current conditions favor range trading`;
  }

  return {
    id: `${source.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    side,
    entry,
    stop,
    tp1,
    tp2,
    tp3,
    rr,
    confidence,
    bias,
    reasoning,
    confluences,
    invalidation,
    validityMs: side === "NEUTRAL" ? 30000 : 120000,
    source,
  };
}

export async function POST(req: NextRequest) {
  let input: AnalysisInput;
  try {
    input = await req.json();
  } catch (e: any) {
    return NextResponse.json(
      { error: "Invalid JSON input", detail: e?.message },
      { status: 400 },
    );
  }

  // === Build local fallback FIRST so we always have something to return ===
  const fallback = buildLocalSignal(input, "FALLBACK");

  // === Try LLM enhancement with short timeout ===
  try {
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
  "reasoning": [string, ...],
  "confluences": [string, ...],
  "invalidation": string,
  "validityMs": number (15000-300000)
}

Rules:
- Only output LONG or SHORT if MTF bias aligns across at least 3 of 6 timeframes.
- If orderflow diverges from structure, reduce confidence by 20+.
- Stop must sit beyond a real liquidity pool.
- TP1 must target a real opposite liquidity pool.
- If no edge, return NEUTRAL.
- Be specific. Reference prices exactly.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a JSON-only trading signal generator. Always respond with valid JSON, no prose, no code fences." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
      // @ts-ignore — abort signal isn't typed but supported
      signal: controller.signal,
    });
    clearTimeout(timeout);

    let raw = completion.choices?.[0]?.message?.content ?? "";
    raw = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(raw);
    const ensureNum = (v: any, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

    // Validate the AI response — if it's invalid or low-quality, use fallback
    const aiSide = ["LONG", "SHORT", "NEUTRAL"].includes(parsed.side) ? parsed.side : null;
    const aiEntry = ensureNum(parsed.entry, 0);
    const aiStop = ensureNum(parsed.stop, 0);
    const aiTp1 = ensureNum(parsed.tp1, 0);
    if (!aiSide || aiEntry <= 0 || aiStop <= 0 || aiTp1 <= 0) {
      // Invalid AI response — use fallback
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      side: aiSide,
      entry: aiEntry,
      stop: aiStop,
      tp1: aiTp1,
      tp2: ensureNum(parsed.tp2, aiTp1),
      tp3: ensureNum(parsed.tp3, aiTp1),
      rr: ensureNum(parsed.rr, 0),
      confidence: Math.max(0, Math.min(100, ensureNum(parsed.confidence, 0))),
      bias: ["BULL", "BEAR", "NEUTRAL"].includes(parsed.bias) ? parsed.bias : "NEUTRAL",
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 8) : fallback.reasoning,
      confluences: Array.isArray(parsed.confluences) ? parsed.confluences.slice(0, 8) : fallback.confluences,
      invalidation: typeof parsed.invalidation === "string" ? parsed.invalidation : fallback.invalidation,
      validityMs: ensureNum(parsed.validityMs, 120000),
      source: "AI",
    });
  } catch (e: any) {
    // Any error (rate limit, timeout, parse failure) → return the local fallback
    // This ensures the signal engine ALWAYS produces usable output.
    return NextResponse.json(fallback);
  }
}

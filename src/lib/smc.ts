import type {
  Candle,
  Structure,
  StructureKind,
  SwingPoint,
  MTFBias,
  OrderflowStats,
  Timeframe,
} from "./types";

// ============================================================================
// SWING POINT DETECTION
// ============================================================================
/**
 * Detect swing highs/lows using a fractal window of `lookback` bars on each side.
 * Strength = number of bars on each side that confirm the pivot.
 */
export function detectSwings(
  candles: Candle[],
  lookback = 3,
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    let highStrength = 0;
    let lowStrength = 0;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].h >= c.h) isHigh = false;
      if (candles[i + j].h >= c.h) isHigh = false;
      if (candles[i - j].l <= c.l) isLow = false;
      if (candles[i + j].l <= c.l) isLow = false;
      if (candles[i - j].h < c.h) highStrength++;
      if (candles[i + j].h < c.h) highStrength++;
      if (candles[i - j].l > c.l) lowStrength++;
      if (candles[i + j].l > c.l) lowStrength++;
    }

    if (isHigh) {
      swings.push({
        index: i,
        price: c.h,
        t: c.t,
        kind: "HIGH",
        strength: Math.min(highStrength, lookback * 2),
      });
    }
    if (isLow) {
      swings.push({
        index: i,
        price: c.l,
        t: c.t,
        kind: "LOW",
        strength: Math.min(lowStrength, lookback * 2),
      });
    }
  }

  return swings.sort((a, b) => a.index - b.index);
}

// ============================================================================
// BREAK OF STRUCTURE (BOS) & CHANGE OF CHARACTER (CHoCH)
// ============================================================================
export function detectStructure(
  candles: Candle[],
  swings: SwingPoint[],
): { structures: Structure[]; trendBias: "BULL" | "BEAR" | "RANGE" } {
  const structures: Structure[] = [];
  if (swings.length < 3) return { structures, trendBias: "RANGE" };

  // Track current trend based on swing sequence
  let trend: "BULL" | "BEAR" | "RANGE" = "RANGE";
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  for (let i = 1; i < swings.length; i++) {
    const s = swings[i];
    if (s.kind === "HIGH") lastSwingHigh = s;
    if (s.kind === "LOW") lastSwingLow = s;

    // Check break of last opposite swing
    if (s.kind === "HIGH" && lastSwingLow) {
      // We made a new swing high; check if subsequent price breaks last swing low (bearish)
      for (let k = s.index + 1; k < candles.length; k++) {
        if (candles[k].c < lastSwingLow.price) {
          const isCHoCH = trend === "BULL" || trend === "RANGE";
          const kind: StructureKind = isCHoCH ? "CHoCH_BEAR" : "BOS_BEAR";
          structures.push({
            id: `struct_${kind}_${k}_${lastSwingLow.price}`,
            kind,
            t: candles[k].t,
            index: k,
            top: lastSwingLow.price,
            bottom: candles[k].l,
            price: lastSwingLow.price,
            label: isCHoCH ? "CHoCH ↓" : "BOS ↓",
          });
          trend = "BEAR";
          lastSwingLow = null;
          break;
        }
      }
    }
    if (s.kind === "LOW" && lastSwingHigh) {
      for (let k = s.index + 1; k < candles.length; k++) {
        if (candles[k].c > lastSwingHigh.price) {
          const isCHoCH = trend === "BEAR" || trend === "RANGE";
          const kind: StructureKind = isCHoCH ? "CHoCH_BULL" : "BOS_BULL";
          structures.push({
            id: `struct_${kind}_${k}_${lastSwingHigh.price}`,
            kind,
            t: candles[k].t,
            index: k,
            top: candles[k].h,
            bottom: lastSwingHigh.price,
            price: lastSwingHigh.price,
            label: isCHoCH ? "CHoCH ↑" : "BOS ↑",
          });
          trend = "BULL";
          lastSwingHigh = null;
          break;
        }
      }
    }
  }

  return { structures: structures.slice(-30), trendBias: trend };
}

// ============================================================================
// FAIR VALUE GAPS (FVG)
// ============================================================================
export function detectFVG(candles: Candle[]): Structure[] {
  const fvgs: Structure[] = [];
  if (candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    // Bullish FVG: c1.high < c3.low → gap up
    if (c1.h < c3.l) {
      fvgs.push({
        id: `fvg_bull_${i}`,
        kind: "FVG_BULL",
        t: c3.t,
        index: i,
        top: c3.l,
        bottom: c1.h,
        label: "FVG↑",
      });
    }
    // Bearish FVG: c1.low > c3.high → gap down
    if (c1.l > c3.h) {
      fvgs.push({
        id: `fvg_bear_${i}`,
        kind: "FVG_BEAR",
        t: c3.t,
        index: i,
        top: c1.l,
        bottom: c3.h,
        label: "FVG↓",
      });
    }
  }

  // Mark mitigated FVGs (where price has since returned into the gap)
  for (const f of fvgs) {
    for (let k = f.index + 1; k < candles.length; k++) {
      const c = candles[k];
      const kind = f.kind;
      if (kind === "FVG_BULL" && c.l <= f.top) {
        f.mitigated = true;
        break;
      }
      if (kind === "FVG_BEAR" && c.h >= f.bottom) {
        f.mitigated = true;
        break;
      }
    }
  }

  // Return most recent un-mitigated FVGs first, last 20
  return fvgs.filter((f) => !f.mitigated).slice(-20).concat(fvgs.filter((f) => f.mitigated).slice(-10));
}

// ============================================================================
// ORDER BLOCKS (OB)
// ============================================================================
export function detectOrderBlocks(candles: Candle[]): Structure[] {
  const obs: Structure[] = [];
  if (candles.length < 5) return obs;

  for (let i = 4; i < candles.length - 1; i++) {
    const c = candles[i];
    // Bullish OB: last bearish candle before a strong bullish move
    if (c.c < c.o && candles[i + 1].c > candles[i + 1].o) {
      const move = candles[i + 1].c - candles[i + 1].o;
      const avgBody =
        candles.slice(i - 3, i).reduce((s, x) => s + Math.abs(x.c - x.o), 0) / 3;
      if (move > avgBody * 1.4) {
        obs.push({
          id: `ob_bull_${i}`,
          kind: "OB_BULL",
          t: c.t,
          index: i,
          top: Math.max(c.o, c.c),
          bottom: c.l,
          label: "OB↑",
        });
      }
    }
    // Bearish OB: last bullish candle before a strong bearish move
    if (c.c > c.o && candles[i + 1].c < candles[i + 1].o) {
      const move = candles[i + 1].o - candles[i + 1].c;
      const avgBody =
        candles.slice(i - 3, i).reduce((s, x) => s + Math.abs(x.c - x.o), 0) / 3;
      if (move > avgBody * 1.4) {
        obs.push({
          id: `ob_bear_${i}`,
          kind: "OB_BEAR",
          t: c.t,
          index: i,
          top: c.h,
          bottom: Math.min(c.o, c.c),
          label: "OB↓",
        });
      }
    }
  }

  // Mark mitigated OBs
  for (const ob of obs) {
    for (let k = ob.index + 2; k < candles.length; k++) {
      const c = candles[k];
      if (ob.kind === "OB_BULL" && c.l <= ob.bottom) {
        ob.mitigated = true;
        break;
      }
      if (ob.kind === "OB_BEAR" && c.h >= ob.top) {
        ob.mitigated = true;
        break;
      }
    }
  }

  return obs.filter((f) => !f.mitigated).slice(-10).concat(obs.filter((f) => f.mitigated).slice(-5));
}

// ============================================================================
// LIQUIDITY POOLS — Equal Highs / Equal Lows + Swing Liquidity
// ============================================================================
export function detectLiquidity(
  candles: Candle[],
  swings: SwingPoint[],
): Structure[] {
  const out: Structure[] = [];
  const tolerance = (candles.at(-1)?.c ?? 1) * 0.0015; // 0.15%

  // Equal highs (BSL = buy-side liquidity above)
  const highs = swings.filter((s) => s.kind === "HIGH").slice(-15);
  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) < tolerance) {
        const price = Math.max(highs[i].price, highs[j].price);
        out.push({
          id: `eqh_${i}_${j}`,
          kind: "EQH",
          t: highs[j].t,
          index: highs[j].index,
          top: price * 1.001,
          bottom: price * 0.999,
          price,
          label: "EQH/BSL",
        });
        break;
      }
    }
  }

  // Equal lows (SSL = sell-side liquidity below)
  const lows = swings.filter((s) => s.kind === "LOW").slice(-15);
  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i].price - lows[j].price) < tolerance) {
        const price = Math.min(lows[i].price, lows[j].price);
        out.push({
          id: `eql_${i}_${j}`,
          kind: "EQL",
          t: lows[j].t,
          index: lows[j].index,
          top: price * 1.001,
          bottom: price * 0.999,
          price,
          label: "EQL/SSL",
        });
        break;
      }
    }
  }

  // Major swing liquidity (BSL above strong swing high, SSL below strong swing low)
  const strongHighs = highs.filter((h) => h.strength >= 4).slice(-3);
  for (const h of strongHighs) {
    if (!out.some((o) => o.kind === "LIQ_BSL" && Math.abs((o.price ?? 0) - h.price) < tolerance)) {
      out.push({
        id: `liq_bsl_${h.index}`,
        kind: "LIQ_BSL",
        t: h.t,
        index: h.index,
        top: h.price * 1.0015,
        bottom: h.price * 0.9985,
        price: h.price,
        label: "BSL",
      });
    }
  }
  const strongLows = lows.filter((l) => l.strength >= 4).slice(-3);
  for (const l of strongLows) {
    if (!out.some((o) => o.kind === "LIQ_SSL" && Math.abs((o.price ?? 0) - l.price) < tolerance)) {
      out.push({
        id: `liq_ssl_${l.index}`,
        kind: "LIQ_SSL",
        t: l.t,
        index: l.index,
        top: l.price * 1.0015,
        bottom: l.price * 0.9985,
        price: l.price,
        label: "SSL",
      });
    }
  }

  // Detect sweeps: when a candle wicks beyond a liquidity pool but closes back inside
  const allLiq = out.filter((o) => o.price);
  for (const liq of allLiq) {
    for (let i = liq.index + 1; i < candles.length; i++) {
      const c = candles[i];
      const isBSL = liq.kind === "LIQ_BSL" || liq.kind === "EQH";
      const isSSL = liq.kind === "LIQ_SSL" || liq.kind === "EQL";
      if (isBSL && c.h > (liq.price ?? 0) && c.c < (liq.price ?? 0)) {
        out.push({
          id: `sweep_bsl_${i}_${liq.id}`,
          kind: "SWEEP_BSL",
          t: c.t,
          index: i,
          top: c.h,
          bottom: c.c,
          price: liq.price,
          label: "SWEEP BSL",
        });
        break;
      }
      if (isSSL && c.l < (liq.price ?? 0) && c.c > (liq.price ?? 0)) {
        out.push({
          id: `sweep_ssl_${i}_${liq.id}`,
          kind: "SWEEP_SSL",
          t: c.t,
          index: i,
          top: c.c,
          bottom: c.l,
          price: liq.price,
          label: "SWEEP SSL",
        });
        break;
      }
    }
  }

  return out.slice(-25);
}

// ============================================================================
// FULL SMC ANALYSIS
// ============================================================================
export interface SMCAnalysis {
  swings: SwingPoint[];
  structures: Structure[];
  fvgs: Structure[];
  orderBlocks: Structure[];
  liquidity: Structure[];
  trendBias: "BULL" | "BEAR" | "RANGE";
}

export function analyzeSMC(candles: Candle[]): SMCAnalysis {
  const swings = detectSwings(candles, 3);
  const { structures, trendBias } = detectStructure(candles, swings);
  const fvgs = detectFVG(candles);
  const orderBlocks = detectOrderBlocks(candles);
  const liquidity = detectLiquidity(candles, swings);

  return { swings, structures, fvgs, orderBlocks, liquidity, trendBias };
}

// ============================================================================
// ORDERFLOW ANALYSIS — synthetic from candle data (no tick data available)
// ============================================================================
export function analyzeOrderflow(
  candles: Candle[],
  lookback = 60,
): OrderflowStats {
  const recent = candles.slice(-lookback);
  if (recent.length === 0) {
    return {
      cvd: 0,
      delta: 0,
      deltaEMA: 0,
      buyPressure: 0.5,
      sellPressure: 0.5,
      absorption: "NONE",
      volumeNode: [],
      poc: 0,
      vah: 0,
      val: 0,
    };
  }

  // Estimate buy/sell volume per candle using body position in range
  const deltas: number[] = [];
  let cvd = 0;
  const priceVolMap = new Map<number, { price: number; vol: number }>();

  for (const c of recent) {
    const range = Math.max(c.h - c.l, 1e-9);
    const body = c.c - c.o;
    const bodyRatio = Math.abs(body) / range;
    // Wick-driven reversal suggests absorption
    const upperWick = c.h - Math.max(c.o, c.c);
    const lowerWick = Math.min(c.o, c.c) - c.l;

    // Approximation: bullish → 60-80% buy, bearish → 60-80% sell, plus wick dampener
    const bullShare = body >= 0
      ? 0.55 + bodyRatio * 0.35 - (upperWick / range) * 0.15
      : 0.45 - bodyRatio * 0.35 + (lowerWick / range) * 0.15;
    const clamped = Math.max(0.1, Math.min(0.9, bullShare));

    const buyVol = c.v * clamped;
    const sellVol = c.v * (1 - clamped);
    const delta = buyVol - sellVol;
    deltas.push(delta);
    cvd += delta;

    // Volume profile: distribute candle volume across its range by trapezoidal weight
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const p = c.l + (range * (s + 0.5)) / steps;
      const key = Math.round(p);
      const weight = 1 - Math.abs((s + 0.5) / steps - 0.5) * 1.5;
      const w = Math.max(0.1, weight) * (c.v / steps);
      const prev = priceVolMap.get(key);
      if (prev) {
        prev.vol += w;
      } else {
        priceVolMap.set(key, { price: p, vol: w });
      }
    }
  }

  const volumeNode = Array.from(priceVolMap.values()).sort((a, b) => a.price - b.price);
  // Find POC, VAH, VAL (70% value area)
  const totalVol = volumeNode.reduce((s, n) => s + n.vol, 0);
  const pocNode = volumeNode.reduce(
    (best, n) => (n.vol > (best?.vol ?? 0) ? n : best),
    volumeNode[0],
  );
  const poc = pocNode?.price ?? 0;

  // Value area: expand around POC until we cover 70% of volume
  let vah = poc;
  let val = poc;
  if (pocNode) {
    const pocIdx = volumeNode.indexOf(pocNode);
    let covered = pocNode.vol;
    let hi = pocIdx;
    let lo = pocIdx;
    while (covered < totalVol * 0.7 && (hi < volumeNode.length - 1 || lo > 0)) {
      const upVol = hi < volumeNode.length - 1 ? volumeNode[hi + 1].vol : -1;
      const dnVol = lo > 0 ? volumeNode[lo - 1].vol : -1;
      if (upVol >= dnVol && upVol > 0) {
        hi++;
        covered += upVol;
      } else if (dnVol > 0) {
        lo--;
        covered += dnVol;
      } else break;
    }
    vah = volumeNode[hi]?.price ?? poc;
    val = volumeNode[lo]?.price ?? poc;
  }

  // Delta EMA (span=12)
  const alpha = 2 / (12 + 1);
  let deltaEMA = deltas[0] ?? 0;
  for (let i = 1; i < deltas.length; i++) {
    deltaEMA = alpha * deltas[i] + (1 - alpha) * deltaEMA;
  }
  const lastDelta = deltas.at(-1) ?? 0;

  // Buy/sell pressure
  const totalDelta = deltas.reduce((s, d) => s + Math.abs(d), 0);
  const posDelta = deltas.reduce((s, d) => s + (d > 0 ? d : 0), 0);
  const negDelta = totalDelta - posDelta;
  const buyPressure = totalDelta > 0 ? posDelta / totalDelta : 0.5;
  const sellPressure = 1 - buyPressure;

  // Absorption: large volume, small body, opposite delta sign relative to range direction
  const last = recent.at(-1)!;
  const range = Math.max(last.h - last.l, 1e-9);
  const body = Math.abs(last.c - last.o);
  const bodyRatio = body / range;
  const lastWickUp = last.h - Math.max(last.o, last.c);
  const lastWickDn = Math.min(last.o, last.c) - last.l;
  let absorption: OrderflowStats["absorption"] = "NONE";
  if (last.v > (recent.reduce((s, c) => s + c.v, 0) / recent.length) * 1.5 && bodyRatio < 0.35) {
    absorption = lastWickUp > lastWickDn ? "SELL" : "BUY";
  }

  return {
    cvd,
    delta: lastDelta,
    deltaEMA,
    buyPressure,
    sellPressure,
    absorption,
    volumeNode,
    poc,
    vah,
    val,
  };
}

// ============================================================================
// MULTI-TIMEFRAME BIAS BUILDER
// ============================================================================
export function buildMTFBias(
  tfCandles: Record<Timeframe, Candle[]>,
  livePrice: number,
): MTFBias[] {
  const order: Timeframe[] = ["1W", "1D", "4H", "15m", "5m", "1m"];
  return order
    .map((tf) => {
      const candles = tfCandles[tf];
      if (!candles || candles.length < 30) {
        return {
          timeframe: tf,
          trend: "RANGE" as const,
          bias: 0,
          lastStructure: null,
          liquidityAbove: null,
          liquidityBelow: null,
          price: livePrice,
        };
      }
      const smc = analyzeSMC(candles);
      const orderflow = analyzeOrderflow(candles, 60);
      const trend = smc.trendBias;

      // Bias score: combination of structure trend, CVD slope, distance from POC
      let bias = 0;
      if (trend === "BULL") bias += 35;
      if (trend === "BEAR") bias -= 35;
      bias += Math.max(-30, Math.min(30, (orderflow.cvd / Math.max(1, Math.abs(orderflow.deltaEMA * 10))) * 30));
      if (livePrice > orderflow.poc) bias += 15;
      else bias -= 15;
      bias += (orderflow.buyPressure - 0.5) * 40;
      bias = Math.max(-100, Math.min(100, bias));

      const lastStruct = smc.structures.at(-1)?.kind ?? null;
      const highs = smc.liquidity.filter((l) => l.kind === "LIQ_BSL" || l.kind === "EQH").map((l) => l.price!);
      const lows = smc.liquidity.filter((l) => l.kind === "LIQ_SSL" || l.kind === "EQL").map((l) => l.price!);
      const liquidityAbove = highs.length ? Math.min(...highs.filter((p) => p > livePrice)) ?? null : null;
      const liquidityBelow = lows.length ? Math.max(...lows.filter((p) => p < livePrice)) ?? null : null;

      return {
        timeframe: tf,
        trend: trend === "RANGE" ? "RANGE" as const : trend,
        bias,
        lastStructure: lastStruct,
        liquidityAbove: liquidityAbove ?? null,
        liquidityBelow: liquidityBelow ?? null,
        price: livePrice,
      };
    });
}

// ============================================================================
// TRADE PLAN BUILDER — derives entry / SL / TP from SMC + liquidity
// ============================================================================
export interface TradePlan {
  side: "LONG" | "SHORT";
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr: number;
  confidence: number;
  reasons: string[];
}

export function buildTradePlan(
  candles: Candle[],
  smc: SMCAnalysis,
  orderflow: OrderflowStats,
  livePrice: number,
): TradePlan | null {
  if (candles.length < 30) return null;

  const { trendBias, liquidity, fvgs, orderBlocks } = smc;
  if (trendBias === "RANGE" && orderflow.absorption === "NONE") return null;

  // Direction: align trend + CVD + absorption
  let dirScore = 0;
  if (trendBias === "BULL") dirScore += 2;
  if (trendBias === "BEAR") dirScore -= 2;
  if (orderflow.cvd > 0) dirScore += 1;
  if (orderflow.cvd < 0) dirScore -= 1;
  if (orderflow.buyPressure > 0.55) dirScore += 1;
  if (orderflow.buyPressure < 0.45) dirScore -= 1;
  if (orderflow.absorption === "SELL") dirScore -= 1; // sell-side absorption = bullish reversal
  if (orderflow.absorption === "BUY") dirScore += 1;

  const side: "LONG" | "SHORT" = dirScore >= 0 ? "LONG" : "SHORT";
  if (Math.abs(dirScore) < 1) return null;

  // Entry: nearest unmitigated FVG or OB in trend direction
  let entry: number | null = null;
  let entryReason = "";
  const candidateFVGs = fvgs.filter((f) => !f.mitigated);
  const candidateOBs = orderBlocks.filter((o) => !o.mitigated);

  if (side === "LONG") {
    // Look for bullish FVG or OB below price
    const bullFVG = candidateFVGs
      .filter((f) => f.kind === "FVG_BULL" && f.top < livePrice)
      .sort((a, b) => b.top - a.top)[0];
    const bullOB = candidateOBs
      .filter((o) => o.kind === "OB_BULL" && o.top < livePrice)
      .sort((a, b) => b.top - a.top)[0];
    if (bullFVG && (!bullOB || bullFVG.top > bullOB.bottom)) {
      entry = (bullFVG.top + bullFVG.bottom) / 2;
      entryReason = `Fill bullish FVG @ ${entry.toFixed(2)}`;
    } else if (bullOB) {
      entry = (bullOB.top + bullOB.bottom) / 2;
      entryReason = `Tap bullish OB @ ${entry.toFixed(2)}`;
    } else {
      entry = livePrice;
      entryReason = `Market entry (no OB/FVG)`;
    }
  } else {
    const bearFVG = candidateFVGs
      .filter((f) => f.kind === "FVG_BEAR" && f.bottom > livePrice)
      .sort((a, b) => a.bottom - b.bottom)[0];
    const bearOB = candidateOBs
      .filter((o) => o.kind === "OB_BEAR" && o.bottom > livePrice)
      .sort((a, b) => a.bottom - b.bottom)[0];
    if (bearFVG && (!bearOB || bearFVG.bottom < bearOB.top)) {
      entry = (bearFVG.top + bearFVG.bottom) / 2;
      entryReason = `Fill bearish FVG @ ${entry.toFixed(2)}`;
    } else if (bearOB) {
      entry = (bearOB.top + bearOB.bottom) / 2;
      entryReason = `Tap bearish OB @ ${entry.toFixed(2)}`;
    } else {
      entry = livePrice;
      entryReason = `Market entry (no OB/FVG)`;
    }
  }

  // Stop: beyond nearest opposite liquidity pool
  let stop: number | null = null;
  if (side === "LONG") {
    const ssl = liquidity
      .filter((l) => (l.kind === "LIQ_SSL" || l.kind === "EQL") && (l.price ?? 0) < entry)
      .map((l) => l.price!)
      .sort((a, b) => b - a)[0];
    stop = (ssl ?? entry * 0.985) - entry * 0.002;
  } else {
    const bsl = liquidity
      .filter((l) => (l.kind === "LIQ_BSL" || l.kind === "EQH") && (l.price ?? 0) > entry)
      .map((l) => l.price!)
      .sort((a, b) => a - b)[0];
    stop = (bsl ?? entry * 1.015) + entry * 0.002;
  }

  // TP: opposite liquidity pools (further ones = TP2, TP3)
  const risk = Math.abs(entry - stop);
  let tp1: number, tp2: number, tp3: number;
  if (side === "LONG") {
    const targets = liquidity
      .filter((l) => (l.kind === "LIQ_BSL" || l.kind === "EQH") && (l.price ?? 0) > entry)
      .map((l) => l.price!)
      .sort((a, b) => a - b);
    tp1 = targets[0] ?? entry + risk * 1.5;
    tp2 = targets[1] ?? entry + risk * 3;
    tp3 = targets[2] ?? entry + risk * 5;
  } else {
    const targets = liquidity
      .filter((l) => (l.kind === "LIQ_SSL" || l.kind === "EQL") && (l.price ?? 0) < entry)
      .map((l) => l.price!)
      .sort((a, b) => b - a);
    tp1 = targets[0] ?? entry - risk * 1.5;
    tp2 = targets[1] ?? entry - risk * 3;
    tp3 = targets[2] ?? entry - risk * 5;
  }

  const rr = Math.abs(tp1 - entry) / Math.max(1e-9, risk);
  if (rr < 1) return null;

  // Confidence: based on confluence count
  const reasons = [entryReason];
  let conf = 50;
  if (trendBias !== "RANGE") {
    reasons.push(`${trendBias} structure on entry TF`);
    conf += 12;
  }
  if (orderflow.absorption !== "NONE") {
    reasons.push(`${orderflow.absorption} absorption detected`);
    conf += 10;
  }
  if (orderflow.buyPressure > 0.6 && side === "LONG") {
    reasons.push(`Buy-side orderflow dominance (${(orderflow.buyPressure * 100).toFixed(0)}%)`);
    conf += 10;
  }
  if (orderflow.buyPressure < 0.4 && side === "SHORT") {
    reasons.push(`Sell-side orderflow dominance (${(orderflow.sellPressure * 100).toFixed(0)}%)`);
    conf += 10;
  }
  const sweeps = liquidity.filter((l) => l.kind === "SWEEP_BSL" || l.kind === "SWEEP_SSL");
  if (sweeps.length > 0) {
    const lastSweep = sweeps.at(-1)!;
    const sweepAligns =
      (side === "LONG" && lastSweep.kind === "SWEEP_SSL") ||
      (side === "SHORT" && lastSweep.kind === "SWEEP_BSL");
    if (sweepAligns) {
      reasons.push(`Liquidity sweep confirmation (${lastSweep.label})`);
      conf += 13;
    }
  }
  if (rr >= 2) {
    reasons.push(`Risk-reward ≥ 2 (${rr.toFixed(2)}R)`);
    conf += 8;
  }
  if (rr >= 3) {
    reasons.push(`Premium RR ≥ 3`);
    conf += 5;
  }
  conf = Math.min(96, conf);

  return {
    side,
    entry,
    stop,
    tp1,
    tp2,
    tp3,
    rr,
    confidence: conf,
    reasons,
  };
}

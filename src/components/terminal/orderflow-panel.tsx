"use client";

import { useEffect, useRef } from "react";
import { useTradingStore } from "@/lib/store";
import { analyzeOrderflow } from "@/lib/smc";
import { fmtCompact } from "@/lib/format";

export default function OrderflowPanel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { candlesByTf, activeTimeframe, livePrice } = useTradingStore();
  const candles = candlesByTf[activeTimeframe] ?? [];

  const orderflow = (() => {
    if (candles.length < 30) return null;
    return analyzeOrderflow(candles, 80);
  })();

  // === CVD / Delta mini chart ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = 44;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#020803";
    ctx.fillRect(0, 0, w, h);

    if (candles.length < 30) return;

    // Compute CVD series
    let cvd = 0;
    const cvdSeries: number[] = [];
    const recent = candles.slice(-80);
    for (const c of recent) {
      const range = Math.max(c.h - c.l, 1e-9);
      const body = c.c - c.o;
      const bodyRatio = Math.abs(body) / range;
      const upperWick = c.h - Math.max(c.o, c.c);
      const lowerWick = Math.min(c.o, c.c) - c.l;
      const bullShare = body >= 0
        ? 0.55 + bodyRatio * 0.35 - (upperWick / range) * 0.15
        : 0.45 - bodyRatio * 0.35 + (lowerWick / range) * 0.15;
      const clamped = Math.max(0.1, Math.min(0.9, bullShare));
      const delta = c.v * (clamped - (1 - clamped));
      cvd += delta;
      cvdSeries.push(cvd);
    }

    let min = Math.min(...cvdSeries);
    let max = Math.max(...cvdSeries);
    const range = max - min || 1;
    const padL = 4;
    const padR = 4;
    const padT = 6;
    const padB = 8;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;

    // Grid
    ctx.strokeStyle = "rgba(0, 255, 127, 0.05)";
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
    }

    // Zero line position relative to CVD range
    if (min < 0 && max > 0) {
      const zeroY = padT + ((max - 0) / range) * chartH;
      ctx.strokeStyle = "rgba(255, 176, 0, 0.3)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, zeroY);
      ctx.lineTo(padL + chartW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // CVD line
    ctx.strokeStyle = "#00ffe0";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0, 255, 224, 0.7)";
    ctx.beginPath();
    cvdSeries.forEach((v, i) => {
      const x = padL + (chartW * i) / (cvdSeries.length - 1);
      const y = padT + ((max - v) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill area
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.lineTo(padL, padT + chartH);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 255, 224, 0.08)";
    ctx.fill();

    // Last point
    const lastX = padL + chartW;
    const lastY = padT + ((max - cvdSeries.at(-1)!) / range) * chartH;
    ctx.fillStyle = "#00ffe0";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#00ffe0";
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = "rgba(0, 255, 224, 0.7)";
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText(`CVD ${cvdSeries.at(-1)!.toFixed(1)}`, padL + 4, padT + 8);
  }, [candles]);

  if (!orderflow) {
    return (
      <div className="matrix-panel flex flex-col h-full">
        <div className="matrix-header">
          <span>≡ ORDERFLOW</span>
        </div>
        <div className="p-4 text-xs matrix-text-dim">{"// AWAITING DATA..."}</div>
      </div>
    );
  }

  const absDelta = Math.abs(orderflow.delta);
  const deltaSign = orderflow.delta >= 0 ? "+" : "-";
  const deltaColor = orderflow.delta >= 0 ? "var(--matrix-green)" : "var(--matrix-red)";

  // Volume profile canvas
  return (
    <div className="matrix-panel flex flex-col h-full overflow-hidden">
      <div className="matrix-header flex-none">
        <span>≡ ORDERFLOW</span>
        <span className="text-[var(--matrix-green-dim)]">{activeTimeframe}</span>
      </div>

      {/* CVD chart — compact */}
      <div className="border-b border-[rgba(0,255,127,0.12)] flex-none">
        <div className="flex items-center justify-between px-2 pt-1">
          <span className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">CVD</span>
          <span className="text-[9px] matrix-text-cyan font-bold tabular-nums">
            {orderflow.cvd >= 0 ? "+" : ""}{fmtCompact(orderflow.cvd)}
          </span>
        </div>
        <canvas ref={canvasRef} className="block w-full" style={{ height: "44px" }} />
      </div>

      {/* Stats grid — compact 2x2 */}
      <div className="grid grid-cols-2 gap-px bg-[rgba(0,255,127,0.08)] flex-none">
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">Δ NOW</div>
          <div className="text-[10px] font-bold tabular-nums leading-tight" style={{ color: deltaColor }}>
            {deltaSign}{fmtCompact(absDelta)}
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">Δ EMA</div>
          <div className="text-[10px] font-bold tabular-nums matrix-text-amber leading-tight">
            {orderflow.deltaEMA >= 0 ? "+" : ""}{fmtCompact(orderflow.deltaEMA)}
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">BUY</div>
          <div className="text-[10px] font-bold tabular-nums matrix-text leading-tight">
            {(orderflow.buyPressure * 100).toFixed(0)}%
          </div>
          <div className="h-0.5 mt-0.5 bg-[rgba(0,255,127,0.1)]">
            <div className="h-full" style={{ width: `${orderflow.buyPressure * 100}%`, background: "var(--matrix-green)" }} />
          </div>
        </div>
        <div className="bg-[#020803] px-1.5 py-1">
          <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest">SELL</div>
          <div className="text-[10px] font-bold tabular-nums matrix-text-red leading-tight">
            {(orderflow.sellPressure * 100).toFixed(0)}%
          </div>
          <div className="h-0.5 mt-0.5 bg-[rgba(255,59,59,0.1)]">
            <div className="h-full" style={{ width: `${orderflow.sellPressure * 100}%`, background: "var(--matrix-red)" }} />
          </div>
        </div>
      </div>

      {/* Absorption — compact single line */}
      <div className="border-t border-[rgba(0,255,127,0.12)] px-1.5 py-0.5 flex items-center justify-between flex-none">
        <span className="text-[8px] text-[var(--matrix-green-dim)] tracking-widest">ABS</span>
        <span
          className={`text-[9px] font-bold tracking-wider ${orderflow.absorption !== "NONE" ? "matrix-blink" : ""}`}
          style={{
            color: orderflow.absorption === "BUY" ? "var(--matrix-green)" : orderflow.absorption === "SELL" ? "var(--matrix-red)" : "var(--matrix-green-dim)",
          }}
        >
          {orderflow.absorption === "NONE" ? "—" : orderflow.absorption}
        </span>
      </div>

      {/* Volume profile — fills remaining space */}
      <div className="flex-1 min-h-0 border-t border-[rgba(0,255,127,0.12)] p-1 overflow-hidden">
        <div className="text-[7px] text-[var(--matrix-green-dim)] tracking-widest mb-0.5 flex justify-between">
          <span>VOL PROFILE</span>
          <span>POC: <span className="matrix-text-amber">{orderflow.poc.toFixed(1)}</span></span>
        </div>
        <VolumeProfile
          nodes={orderflow.volumeNode}
          poc={orderflow.poc}
          vah={orderflow.vah}
          val={orderflow.val}
          livePrice={livePrice}
        />
      </div>

      {/* Value area footer — compact */}
      <div className="border-t border-[rgba(0,255,127,0.12)] px-1.5 py-0.5 grid grid-cols-2 gap-2 text-[8px] flex-none">
        <div className="flex justify-between">
          <span className="text-[var(--matrix-green-dim)]">VAH</span>
          <span className="matrix-text tabular-nums">{orderflow.vah.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--matrix-green-dim)]">VAL</span>
          <span className="matrix-text tabular-nums">{orderflow.val.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

function VolumeProfile({
  nodes,
  poc,
  vah,
  val,
  livePrice,
}: {
  nodes: { price: number; volume: number }[];
  poc: number;
  vah: number;
  val: number;
  livePrice: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    // Use parent's available height (after the label), minimum 40px so it always renders
    const h = Math.max(40, parent.clientHeight - 12);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#020803";
    ctx.fillRect(0, 0, w, h);

    if (nodes.length === 0) return;

    // Bucket nodes (sample to ~25 rows)
    const targetRows = 25;
    const prices = nodes.map((n) => n.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const pRange = maxP - minP || 1;
    const bucketSize = pRange / targetRows;
    const buckets: { price: number; volume: number }[] = [];
    for (let i = 0; i < targetRows; i++) {
      const lo = minP + i * bucketSize;
      const hi = lo + bucketSize;
      const vol = nodes.filter((n) => n.price >= lo && n.price < hi).reduce((s, n) => s + n.volume, 0);
      buckets.push({ price: (lo + hi) / 2, volume: vol });
    }
    // Reverse so highest price is on top
    buckets.reverse();
    const maxVol = Math.max(...buckets.map((b) => b.volume), 1);

    const padL = 4;
    const padR = 50;
    const padT = 2;
    const padB = 2;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const rowH = chartH / buckets.length;

    buckets.forEach((b, i) => {
      const y = padT + i * rowH;
      const barW = (b.volume / maxVol) * chartW;
      const inVA = b.price >= val && b.price <= vah;
      const isPOC = Math.abs(b.price - poc) < bucketSize;
      ctx.fillStyle = isPOC
        ? "rgba(255, 176, 0, 0.7)"
        : inVA
        ? "rgba(0, 255, 127, 0.4)"
        : "rgba(0, 255, 127, 0.15)";
      ctx.fillRect(padL, y, barW, Math.max(1, rowH - 0.5));
    });

    // Live price line
    if (livePrice > 0) {
      const y = padT + ((maxP - livePrice) / pRange) * chartH;
      if (y >= 0 && y <= h) {
        ctx.strokeStyle = "rgba(0, 255, 127, 0.7)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + chartR, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#00ff7f";
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(livePrice.toFixed(2), padL + chartW + 4, y + 3);
      }
    }
    function chartR() { return w - padR; }

    // VA lines
    [vah, val].forEach((p, i) => {
      const y = padT + ((maxP - p) / pRange) * chartH;
      if (y >= 0 && y <= h) {
        ctx.strokeStyle = "rgba(0, 255, 224, 0.4)";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(0, 255, 224, 0.7)";
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(i === 0 ? "VAH" : "VAL", padL + chartW + 4, y + 3);
      }
    });
  }, [nodes, poc, vah, val, livePrice]);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
}

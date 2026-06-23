"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTradingStore } from "@/lib/store";
import { analyzeSMC, analyzeOrderflow } from "@/lib/smc";
import type { Candle } from "@/lib/types";
import { fmtPrice, fmtTime } from "@/lib/format";

interface ChartProps {
  height?: number;
}

// View state — supports both horizontal and vertical pan/zoom
interface ViewState {
  offset: number;            // candles from right edge (horizontal pan)
  visibleCount: number;      // horizontal zoom (candles visible)
  autoFitY: boolean;         // true = auto-fit vertical; false = manual
  priceCenter: number;       // manual price center (when autoFitY=false)
  priceRange: number;        // manual price range (pMax - pMin)
}

interface DragState {
  mode: "pan" | "box" | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startOffset: number;
  startVisibleCount: number;
  startPriceCenter: number;
  startPriceRange: number;
  startAutoFitY: boolean;
  moved: boolean;
}

const MIN_VISIBLE = 15;
const MAX_VISIBLE = 800;
const LAYOUT = {
  padL: 8,
  padR: 78,
  padT: 8,
  padB: 22,
  volRatio: 0.18,
  volMin: 0,
  volMax: 80,
};

export default function TradingChart({ height = 560 }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Hover state (ref to avoid re-renders during mouse move)
  const hoverRef = useRef<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  // View state
  const [view, setView] = useState<ViewState>({
    offset: 0,
    visibleCount: 120,
    autoFitY: true,
    priceCenter: 0,
    priceRange: 0,
  });

  // Drag state (ref to avoid re-renders during drag)
  const dragRef = useRef<DragState>({
    mode: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startOffset: 0,
    startVisibleCount: 120,
    startPriceCenter: 0,
    startPriceRange: 0,
    startAutoFitY: true,
    moved: false,
  });

  // Force redraw trigger for box-zoom overlay (ref-based drawing)
  const [renderTick, setRenderTick] = useState(0);
  // Mirrors dragRef.mode for conditional rendering
  const [isDragging, setIsDragging] = useState(false);

  const [dimensions, setDimensions] = useState({ w: 1200, h: height });

  const {
    candlesByTf,
    activeTimeframe,
    livePrice,
    prevPrice,
    showSMC,
    showOrderflow,
    showLiquidity,
    showFVG,
    showOB,
    showVolume,
    symbol,
  } = useTradingStore();

  const candles = candlesByTf[activeTimeframe] ?? [];

  // === Layout helpers ===
  const getLayout = useCallback(() => {
    const volH = showVolume
      ? Math.min(LAYOUT.volMax, dimensions.h * LAYOUT.volRatio)
      : 0;
    const chartH = dimensions.h - LAYOUT.padT - LAYOUT.padB - volH;
    const chartW = dimensions.w - LAYOUT.padL - LAYOUT.padR;
    return {
      padL: LAYOUT.padL,
      padR: LAYOUT.padR,
      padT: LAYOUT.padT,
      padB: LAYOUT.padB,
      volH,
      chartH,
      chartW,
      volTop: dimensions.h - LAYOUT.padB - volH,
    };
  }, [dimensions, showVolume]);

  // === Analysis — memoized ===
  const analysis = useMemo(() => {
    if (candles.length < 30) return null;
    const smc = analyzeSMC(candles);
    const orderflow = analyzeOrderflow(candles, 80);
    return { smc, orderflow };
  }, [candles, livePrice]);

  // === Compute auto-fit price bounds ===
  const autoFitBounds = useMemo<{ min: number; max: number }>(() => {
    if (candles.length < 2) return { min: 0, max: 1 };
    const total = candles.length;
    const visible = Math.min(view.visibleCount, total);
    const startIdx = Math.max(0, total - visible - view.offset);
    const endIdx = Math.min(total, startIdx + visible);
    const visibleCandles = candles.slice(startIdx, endIdx);
    let pMin = Infinity;
    let pMax = -Infinity;
    for (const c of visibleCandles) {
      if (c.l < pMin) pMin = c.l;
      if (c.h > pMax) pMax = c.h;
    }
    // Include live price in auto-fit bounds
    const extraLevels: number[] = [];
    if (livePrice) extraLevels.push(livePrice);
    for (const lv of extraLevels) {
      if (isFinite(lv) && lv > 0) {
        pMin = Math.min(pMin, lv);
        pMax = Math.max(pMax, lv);
      }
    }
    if (!isFinite(pMin) || !isFinite(pMax)) return { min: 0, max: 1 };
    const pad = (pMax - pMin) * 0.08 || pMax * 0.01;
    return { min: pMin - pad, max: pMax + pad };
  }, [candles, view.offset, view.visibleCount, livePrice]);

  // === Effective bounds — auto-fit or manual ===
  const effectiveBounds = useMemo<{ min: number; max: number }>(() => {
    if (view.autoFitY) return autoFitBounds;
    const half = view.priceRange / 2;
    return { min: view.priceCenter - half, max: view.priceCenter + half };
  }, [view, autoFitBounds]);

  // === Resize observer ===
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ w: rect.width, h: rect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // === Main draw loop ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = dimensions.w;
    const h = dimensions.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // === BACKGROUND ===
    ctx.fillStyle = "#020803";
    ctx.fillRect(0, 0, w, h);

    const { padL, padR, padT, padB, volH, chartH, chartW, volTop } = getLayout();

    if (candles.length < 5) {
      ctx.fillStyle = "rgba(0, 255, 127, 0.5)";
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillText("// ACQUIRING MARKET DATA...", padL, h / 2);
      return;
    }

    // === Visible range ===
    const total = candles.length;
    const visible = Math.min(view.visibleCount, total);
    const startIdx = Math.max(0, total - visible - view.offset);
    const endIdx = Math.min(total, startIdx + visible);
    const visibleCandles = candles.slice(startIdx, endIdx);

    // === Price range (from effectiveBounds, not recomputed) ===
    let pMin = effectiveBounds.min;
    let pMax = effectiveBounds.max;
    const pRange = pMax - pMin || 1;

    // Volume max
    let vMax = 0;
    for (const c of visibleCandles) {
      if (c.v > vMax) vMax = c.v;
    }

    // === GRID ===
    ctx.strokeStyle = "rgba(0, 255, 127, 0.05)";
    ctx.lineWidth = 1;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = "rgba(0, 255, 127, 0.4)";
    const gridCount = 8;
    for (let i = 0; i <= gridCount; i++) {
      const y = padT + (chartH * i) / gridCount;
      const p = pMax - (pRange * i) / gridCount;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.fillText(p.toFixed(2), padL + chartW + 4, y + 3);
    }
    const vGridCount = 8;
    for (let i = 0; i <= vGridCount; i++) {
      const x = padL + (chartW * i) / vGridCount;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + chartH);
      ctx.stroke();
    }

    // === CANDLE METRICS ===
    const candleSlot = chartW / visible;
    const candleW = Math.max(1, Math.min(14, candleSlot * 0.7));

    function xOf(idx: number) {
      return padL + (idx - startIdx + 0.5) * candleSlot;
    }
    function yOf(price: number) {
      return padT + ((pMax - price) / pRange) * chartH;
    }

    // === SMC OVERLAYS — behind candles ===
    if (analysis && showSMC) {
      // Order blocks
      if (showOB) {
        for (const ob of analysis.smc.orderBlocks) {
          if (ob.index < startIdx || ob.index > endIdx) continue;
          const xStart = xOf(ob.index);
          const y1 = yOf(ob.top);
          const y2 = yOf(ob.bottom);
          const isBull = ob.kind === "OB_BULL";
          ctx.fillStyle = isBull
            ? "rgba(0, 255, 127, 0.10)"
            : "rgba(255, 59, 59, 0.10)";
          ctx.fillRect(xStart - candleW, y1, chartW - xStart + padL + candleW, y2 - y1);
          ctx.strokeStyle = isBull
            ? "rgba(0, 255, 127, 0.35)"
            : "rgba(255, 59, 59, 0.35)";
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(xStart - candleW, y1, chartW - xStart + padL + candleW, y2 - y1);
          ctx.setLineDash([]);
          ctx.fillStyle = isBull ? "rgba(0, 255, 127, 0.7)" : "rgba(255, 59, 59, 0.7)";
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(ob.label, xStart - candleW + 2, y1 + 9);
        }
      }

      // FVGs
      if (showFVG) {
        for (const fvg of analysis.smc.fvgs) {
          if (fvg.index < startIdx || fvg.index > endIdx) continue;
          const xStart = xOf(fvg.index - 2);
          const y1 = yOf(fvg.top);
          const y2 = yOf(fvg.bottom);
          const isBull = fvg.kind === "FVG_BULL";
          if (fvg.mitigated) {
            ctx.fillStyle = isBull
              ? "rgba(0, 255, 127, 0.04)"
              : "rgba(255, 59, 59, 0.04)";
          } else {
            ctx.fillStyle = isBull
              ? "rgba(0, 255, 127, 0.16)"
              : "rgba(255, 59, 59, 0.16)";
          }
          ctx.fillRect(xStart, y1, chartW - xStart + padL, y2 - y1);
          ctx.strokeStyle = isBull
            ? "rgba(0, 255, 127, 0.4)"
            : "rgba(255, 59, 59, 0.4)";
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(xStart, y1, chartW - xStart + padL, y2 - y1);
          ctx.setLineDash([]);
          ctx.fillStyle = isBull ? "rgba(0, 255, 127, 0.7)" : "rgba(255, 59, 59, 0.7)";
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(fvg.label, xStart + 2, y1 + 9);
        }
      }

      // Liquidity lines
      if (showLiquidity) {
        for (const liq of analysis.smc.liquidity) {
          if (!liq.price) continue;
          const y = yOf(liq.price);
          if (y < padT || y > padT + chartH) continue;
          const isBSL = liq.kind === "LIQ_BSL" || liq.kind === "EQH" || liq.kind === "SWEEP_BSL";
          const isSSL = liq.kind === "LIQ_SSL" || liq.kind === "EQL" || liq.kind === "SWEEP_SSL";
          const xStart = Math.max(padL, xOf(liq.index));
          if (liq.kind === "SWEEP_BSL" || liq.kind === "SWEEP_SSL") {
            ctx.strokeStyle = isBSL ? "rgba(255, 0, 212, 0.7)" : "rgba(0, 255, 224, 0.7)";
            ctx.fillStyle = isBSL ? "rgba(255, 0, 212, 0.7)" : "rgba(0, 255, 224, 0.7)";
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(xStart, y - 6);
            ctx.lineTo(xStart + 6, y);
            ctx.lineTo(xStart, y + 6);
            ctx.fill();
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.fillText(liq.label, xStart + 8, y - 3);
          } else {
            ctx.strokeStyle = isBSL
              ? "rgba(255, 176, 0, 0.45)"
              : "rgba(0, 255, 224, 0.45)";
            ctx.setLineDash([6, 3]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = isBSL ? "rgba(255, 176, 0, 0.8)" : "rgba(0, 255, 224, 0.8)";
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.fillText(liq.label, xStart + 3, y - 3);
          }
        }
      }

      // Structure markers (BOS / CHoCH)
      for (const st of analysis.smc.structures) {
        if (st.index < startIdx || st.index > endIdx) continue;
        const x = xOf(st.index);
        const isBull = st.kind === "BOS_BULL" || st.kind === "CHoCH_BULL";
        const isCHoCH = st.kind.includes("CHoCH");
        const color = isBull ? "rgba(0, 255, 127, 0.9)" : "rgba(255, 59, 59, 0.9)";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, padT + chartH);
        ctx.lineTo(x, padT + chartH - 12);
        ctx.stroke();
        ctx.beginPath();
        if (isBull) {
          ctx.moveTo(x, padT + chartH);
          ctx.lineTo(x - 4, padT + chartH - 6);
          ctx.lineTo(x + 4, padT + chartH - 6);
        } else {
          ctx.moveTo(x, padT + chartH - 12);
          ctx.lineTo(x - 4, padT + chartH - 6);
          ctx.lineTo(x + 4, padT + chartH - 6);
        }
        ctx.fill();
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillText(st.label, x + 3, padT + chartH - 14);
        if (isCHoCH) {
          ctx.fillStyle = "rgba(255, 0, 212, 0.8)";
          ctx.fillText("★", x - 6, padT + chartH - 14);
        }
      }
    }

    // === VOLUME BARS ===
    if (showVolume) {
      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const idx = startIdx + i;
        const x = xOf(idx);
        const vh = (c.v / vMax) * (volH - 4);
        const up = c.c >= c.o;
        ctx.fillStyle = up ? "rgba(0, 255, 127, 0.4)" : "rgba(255, 59, 59, 0.4)";
        ctx.fillRect(x - candleW / 2, volTop + volH - vh, candleW, vh);
      }
      ctx.fillStyle = "rgba(0, 255, 127, 0.4)";
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText("VOL", padL + 2, volTop + 10);
    }

    // === CANDLES ===
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const idx = startIdx + i;
      const x = xOf(idx);
      const up = c.c >= c.o;
      const color = up ? "#00ff7f" : "#ff3b3b";
      const wickColor = up ? "rgba(0, 255, 127, 0.85)" : "rgba(255, 59, 59, 0.85)";
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yOf(c.h));
      ctx.lineTo(x, yOf(c.l));
      ctx.stroke();
      const yO = yOf(c.o);
      const yC = yOf(c.c);
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(1, Math.abs(yC - yO));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
      if (i === visibleCandles.length - 1) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
        ctx.shadowBlur = 0;
      }
    }

    // === LIVE PRICE LINE ===
    if (livePrice) {
      const y = yOf(livePrice);
      const up = livePrice >= prevPrice;
      const c = up ? "#00ff7f" : "#ff3b3b";
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c;
      ctx.fillRect(padL + chartW, y - 8, padR, 16);
      ctx.fillStyle = "#000";
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(livePrice.toFixed(2), padL + chartW + 4, y + 3);
    }

    // === TIME AXIS LABELS ===
    ctx.fillStyle = "rgba(0, 255, 127, 0.5)";
    ctx.font = '8px "JetBrains Mono", monospace';
    const labelEvery = Math.ceil(visible / 8);
    for (let i = 0; i < visibleCandles.length; i += labelEvery) {
      const x = xOf(startIdx + i);
      const c = visibleCandles[i];
      const d = new Date(c.t);
      const pad = (n: number) => n.toString().padStart(2, "0");
      ctx.fillText(`${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`, x - 25, h - 8);
    }

    // === CROSSHAIR (hover) ===
    if (hoverRef.current.visible && !dragRef.current.mode) {
      const hx = hoverRef.current.x;
      const hy = hoverRef.current.y;
      if (hx > padL && hx < padL + chartW && hy > padT && hy < padT + chartH) {
        ctx.strokeStyle = "rgba(0, 255, 127, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, padT);
        ctx.lineTo(hx, padT + chartH + (showVolume ? volH : 0));
        ctx.moveTo(padL, hy);
        ctx.lineTo(padL + chartW, hy);
        ctx.stroke();
        ctx.setLineDash([]);
        // price label on Y axis
        const price = pMax - ((hy - padT) / chartH) * pRange;
        ctx.fillStyle = "rgba(0, 255, 127, 0.9)";
        ctx.fillRect(padL + chartW, hy - 8, padR, 16);
        ctx.fillStyle = "#000";
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(price.toFixed(2), padL + chartW + 4, hy + 3);
        // time label on X axis (hovered candle)
        const slot = chartW / visible;
        const idx = Math.floor((hx - padL) / slot) + startIdx;
        if (idx >= 0 && idx < candles.length) {
          const hc = candles[idx];
          const d = new Date(hc.t);
          const pad2 = (n: number) => n.toString().padStart(2, "0");
          const label = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
          const labelW = ctx.measureText(label).width + 8;
          ctx.fillStyle = "rgba(0, 255, 127, 0.9)";
          ctx.fillRect(hx - labelW / 2, h - padB + 2, labelW, padB - 4);
          ctx.fillStyle = "#000";
          ctx.fillText(label, hx - labelW / 2 + 4, h - 6);
        }
      }
    }

    // === BOX-ZOOM SELECTION OVERLAY ===
    const drag = dragRef.current;
    if (drag.mode === "box" && drag.moved) {
      const x1 = Math.min(drag.startX, drag.currentX);
      const x2 = Math.max(drag.startX, drag.currentX);
      const y1 = Math.min(drag.startY, drag.currentY);
      const y2 = Math.max(drag.startY, drag.currentY);
      // Fill
      ctx.fillStyle = "rgba(0, 255, 224, 0.10)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      // Border
      ctx.strokeStyle = "rgba(0, 255, 224, 0.8)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      // Corner markers
      ctx.fillStyle = "#00ffe0";
      const ms = 3;
      [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].forEach(([px, py]) => {
        ctx.fillRect(px - ms, py - ms, ms * 2, ms * 2);
      });
      // Dimension labels
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = "#00ffe0";
      const w_units = Math.round((x2 - x1) / candleSlot);
      const h_units = ((y2 - y1) / chartH * pRange).toFixed(2);
      ctx.fillText(`${w_units} bars × ${h_units} pts`, x2 + 4, y1 + 8);
    }

    // === PAN INDICATOR ===
    if (drag.mode === "pan" && drag.moved) {
      ctx.fillStyle = "rgba(255, 176, 0, 0.8)";
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText("⊙ PAN", padL + 4, padT + 12);
    }

    // === TOP-LEFT OVERLAY INFO ===
    const topOverlays: string[] = [
      `${activeTimeframe} • ${symbol}`,
      `O:${visibleCandles.at(-1)?.o.toFixed(2)} H:${visibleCandles.at(-1)?.h.toFixed(2)} L:${visibleCandles.at(-1)?.l.toFixed(2)} C:${visibleCandles.at(-1)?.c.toFixed(2)}`,
    ];
    if (analysis) {
      topOverlays.push(`TREND: ${analysis.smc.trendBias}`);
      topOverlays.push(`CVD: ${analysis.orderflow.cvd.toFixed(1)} Δ:${analysis.orderflow.delta.toFixed(1)} ABS:${analysis.orderflow.absorption}`);
    }
    // Only render if not currently dragging (avoid overlap with PAN indicator)
    const overlayStart = drag.mode === "pan" && drag.moved ? 24 : 0;
    ctx.fillStyle = "rgba(0, 255, 127, 0.85)";
    ctx.font = '9px "JetBrains Mono", monospace';
    topOverlays.forEach((line, i) => {
      ctx.fillText(line, padL + 4, padT + 12 + overlayStart + i * 12);
    });

    // === Y-AXIS MODE INDICATOR (top right of price axis) ===
    ctx.fillStyle = view.autoFitY ? "rgba(0, 255, 127, 0.6)" : "rgba(255, 176, 0, 0.8)";
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText(view.autoFitY ? "Y:AUTO" : "Y:LOCK", padL + chartW + 4, padT + 10);

    // === ZOOM LEVEL INDICATOR (bottom right) ===
    const zoomPct = ((view.visibleCount / total) * 100).toFixed(1);
    ctx.fillStyle = "rgba(0, 255, 127, 0.5)";
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText(`ZOOM ${zoomPct}% (${visible}/${total})`, padL + chartW - 100, h - 8);

    // === LEGEND (bottom right area) ===
    const legend = [
      ["BOS/CHoCH", "#00ff7f"],
      ["FVG", "#ff3b3b"],
      ["OB", "rgba(0,255,127,0.4)"],
      ["LIQ BSL", "#ffb000"],
      ["LIQ SSL", "#00ffe0"],
      ["SWEEP", "#ff00d4"],
    ];
    ctx.font = '8px "JetBrains Mono", monospace';
    const lx0 = padL + chartW - 200;
    const ly0 = padT + 18;
    legend.forEach(([lbl, col], i) => {
      const x = lx0 + (i % 4) * 50;
      const y = ly0 + Math.floor(i / 4) * 11;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = "rgba(0, 255, 127, 0.7)";
      ctx.fillText(lbl, x + 10, y + 7);
    });
  }, [
    candles,
    dimensions,
    view,
    analysis,
    livePrice,
    prevPrice,
    activeTimeframe,
    symbol,
    showSMC,
    showOrderflow,
    showLiquidity,
    showFVG,
    showOB,
    showVolume,
    effectiveBounds,
    renderTick,
    getLayout,
  ]);

  // === MOUSE HANDLERS ===
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 0) {
      // Left button: pan (both H and V)
      const center = effectiveBounds.min + (effectiveBounds.max - effectiveBounds.min) / 2;
      const range = effectiveBounds.max - effectiveBounds.min;
      dragRef.current = {
        mode: "pan",
        startX: x, startY: y,
        currentX: x, currentY: y,
        startOffset: view.offset,
        startVisibleCount: view.visibleCount,
        startPriceCenter: center,
        startPriceRange: range,
        startAutoFitY: view.autoFitY,
        moved: false,
      };
      setIsDragging(true);
      canvas.style.cursor = "grabbing";
    } else if (e.button === 2) {
      // Right button: box zoom
      e.preventDefault();
      const center = effectiveBounds.min + (effectiveBounds.max - effectiveBounds.min) / 2;
      const range = effectiveBounds.max - effectiveBounds.min;
      dragRef.current = {
        mode: "box",
        startX: x, startY: y,
        currentX: x, currentY: y,
        startOffset: view.offset,
        startVisibleCount: view.visibleCount,
        startPriceCenter: center,
        startPriceRange: range,
        startAutoFitY: view.autoFitY,
        moved: false,
      };
      setIsDragging(true);
      canvas.style.cursor = "crosshair";
    }
  }, [view, effectiveBounds]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hoverRef.current = { x, y, visible: true };

    const drag = dragRef.current;
    if (drag.mode) {
      drag.currentX = x;
      drag.currentY = y;
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;

      if (drag.mode === "pan") {
        const { chartW, chartH } = getLayout();
        // Horizontal pan
        const slotSize = chartW / drag.startVisibleCount;
        const candlesShifted = Math.round(dx / slotSize);
        const newOffset = Math.max(
          0,
          Math.min(candles.length - drag.startVisibleCount, drag.startOffset + candlesShifted),
        );
        // Vertical pan — switch to manual mode
        const pricePerPixel = drag.startPriceRange / chartH;
        const newPriceCenter = drag.startPriceCenter - dy * pricePerPixel;
        setView({
          offset: newOffset,
          visibleCount: drag.startVisibleCount,
          autoFitY: false,
          priceCenter: newPriceCenter,
          priceRange: drag.startPriceRange,
        });
      } else if (drag.mode === "box") {
        // Just trigger redraw for the box overlay
        setRenderTick((t) => (t + 1) % 1000000);
      }
    } else {
      // Hover mode — find candle + compute hover price
      const { padL, chartW, chartH, padT } = getLayout();
      const total = candles.length;
      const visible = Math.min(view.visibleCount, total);
      const startIdx = Math.max(0, total - visible - view.offset);
      const slot = chartW / visible;
      const idx = Math.floor((x - padL) / slot) + startIdx;
      if (idx >= 0 && idx < candles.length) setHoverCandle(candles[idx]);
      const pRange = effectiveBounds.max - effectiveBounds.min;
      const price = effectiveBounds.max - ((y - padT) / chartH) * pRange;
      setHoverPrice(price);
      canvas.style.cursor = "crosshair";
    }
  }, [view, candles, effectiveBounds, getLayout]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const drag = dragRef.current;

    if (drag.mode === "box" && drag.moved) {
      const { padL, chartW, padT, chartH } = getLayout();
      const x1 = Math.min(drag.startX, drag.currentX);
      const x2 = Math.max(drag.startX, drag.currentX);
      const y1 = Math.min(drag.startY, drag.currentY);
      const y2 = Math.max(drag.startY, drag.currentY);

      if (x2 - x1 > 8 && y2 - y1 > 8) {
        // Vertical zoom
        const pRange = effectiveBounds.max - effectiveBounds.min;
        const newPriceMax = effectiveBounds.max - ((y1 - padT) / chartH) * pRange;
        const newPriceMin = effectiveBounds.max - ((y2 - padT) / chartH) * pRange;
        const newPriceCenter = (newPriceMax + newPriceMin) / 2;
        const newPriceRange = Math.max(newPriceMax - newPriceMin, pRange * 0.02);

        // Horizontal zoom
        const total = candles.length;
        const visible = Math.min(view.visibleCount, total);
        const startIdx = Math.max(0, total - visible - view.offset);
        const slot = chartW / visible;
        const candlesInBox = Math.max(MIN_VISIBLE, Math.round((x2 - x1) / slot));
        const candlesBeforeBox = Math.round((x1 - padL) / slot);
        const newVisibleCount = Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, candlesInBox));
        const newEndIdx = startIdx + candlesBeforeBox + candlesInBox;
        const newOffset = Math.max(0, Math.min(total - newVisibleCount, total - newEndIdx));

        setView({
          offset: newOffset,
          visibleCount: newVisibleCount,
          autoFitY: false,
          priceCenter: newPriceCenter,
          priceRange: newPriceRange,
        });
      }
    }

    dragRef.current = {
      mode: null,
      startX: 0, startY: 0,
      currentX: 0, currentY: 0,
      startOffset: 0, startVisibleCount: 120,
      startPriceCenter: 0, startPriceRange: 0,
      startAutoFitY: true,
      moved: false,
    };
    setIsDragging(false);
    canvas.style.cursor = "crosshair";
  }, [view, candles.length, effectiveBounds, getLayout]);

  const onMouseLeave = useCallback(() => {
    hoverRef.current.visible = false;
    setHoverCandle(null);
    setHoverPrice(null);
    const canvas = canvasRef.current;
    if (canvas && !dragRef.current.mode) canvas.style.cursor = "default";
  }, []);

  const onDoubleClick = useCallback(() => {
    // Reset to auto-fit
    setView({
      offset: 0,
      visibleCount: 120,
      autoFitY: true,
      priceCenter: 0,
      priceRange: 0,
    });
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // === ENHANCED WHEEL HANDLER ===
  // Plain wheel = pan horizontally
  // Shift+wheel = pan vertically
  // Ctrl/Cmd+wheel = zoom horizontally (toward mouse X)
  // Alt+wheel = zoom vertically (toward mouse Y)
  const onWheel = useCallback((e: React.WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const { padL, chartW, padT, chartH } = getLayout();

    if (e.shiftKey) {
      // Shift+wheel: pan vertically (price)
      setView((v) => {
        const bounds = v.autoFitY
          ? autoFitBounds
          : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
        const pRange = bounds.max - bounds.min;
        const panAmount = (e.deltaY > 0 ? 1 : -1) * pRange * 0.05;
        return {
          ...v,
          autoFitY: false,
          priceCenter: (v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter) + panAmount,
          priceRange: v.autoFitY ? pRange : v.priceRange,
        };
      });
    } else if (e.altKey) {
      // Alt+wheel: zoom vertically (toward mouse Y)
      setView((v) => {
        const bounds = v.autoFitY
          ? autoFitBounds
          : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
        const pRange = bounds.max - bounds.min;
        const zoomFactor = e.deltaY > 0 ? 1.18 : 0.85;
        const newRange = Math.max(pRange * 0.01, pRange * zoomFactor);
        const mousePrice = bounds.max - ((mouseY - padT) / chartH) * pRange;
        const center = v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter;
        const newCenter = mousePrice + (center - mousePrice) * (newRange / pRange);
        return {
          ...v,
          autoFitY: false,
          priceCenter: newCenter,
          priceRange: newRange,
        };
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+wheel: zoom horizontally toward mouse X
      setView((v) => {
        const total = candles.length;
        const visible = Math.min(v.visibleCount, total);
        const startIdx = Math.max(0, total - visible - v.offset);
        const slot = chartW / visible;
        const mouseCandleIdx = Math.floor((mouseX - padL) / slot) + startIdx;
        const zoomFactor = e.deltaY > 0 ? 1.18 : 0.85;
        const newVisible = Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, Math.round(v.visibleCount * zoomFactor)));
        const newSlot = chartW / newVisible;
        const newStartIdx = Math.max(0, Math.min(total - newVisible, mouseCandleIdx - Math.floor((mouseX - padL) / newSlot)));
        const newOffset = Math.max(0, Math.min(total - newVisible, total - newStartIdx - newVisible));
        return { ...v, visibleCount: newVisible, offset: newOffset };
      });
    } else {
      // Plain wheel: pan horizontally
      setView((v) => {
        const panSpeed = Math.max(1, Math.round(v.visibleCount * 0.02));
        const newOffset = Math.max(
          0,
          Math.min(candles.length - v.visibleCount, v.offset + (e.deltaY > 0 ? -panSpeed : panSpeed)),
        );
        return { ...v, offset: newOffset };
      });
    }
  }, [candles.length, autoFitBounds, getLayout]);

  // === KEYBOARD ===
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const panSpeed = Math.max(1, Math.round(view.visibleCount * 0.05));
      if (e.key === "ArrowLeft") {
        setView((v) => ({ ...v, offset: Math.min(candles.length - v.visibleCount, v.offset + panSpeed) }));
      } else if (e.key === "ArrowRight") {
        setView((v) => ({ ...v, offset: Math.max(0, v.offset - panSpeed) }));
      } else if (e.key === "ArrowUp") {
        // Vertical pan up (prices increase)
        setView((v) => {
          const bounds = v.autoFitY ? autoFitBounds : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
          const pRange = bounds.max - bounds.min;
          const panAmount = pRange * 0.05;
          return {
            ...v,
            autoFitY: false,
            priceCenter: (v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter) + panAmount,
            priceRange: v.autoFitY ? pRange : v.priceRange,
          };
        });
      } else if (e.key === "ArrowDown") {
        // Vertical pan down
        setView((v) => {
          const bounds = v.autoFitY ? autoFitBounds : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
          const pRange = bounds.max - bounds.min;
          const panAmount = pRange * 0.05;
          return {
            ...v,
            autoFitY: false,
            priceCenter: (v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter) - panAmount,
            priceRange: v.autoFitY ? pRange : v.priceRange,
          };
        });
      } else if ((e.key === "+" || e.key === "=") && !e.shiftKey) {
        // Horizontal zoom in
        setView((v) => ({ ...v, visibleCount: Math.max(MIN_VISIBLE, Math.round(v.visibleCount * 0.85)) }));
      } else if (e.key === "-" && !e.shiftKey) {
        // Horizontal zoom out
        setView((v) => ({ ...v, visibleCount: Math.min(MAX_VISIBLE, Math.round(v.visibleCount * 1.18)) }));
      } else if (e.key === "+" && e.shiftKey || e.key === "_" ) {
        // Shift+= : vertical zoom in
        setView((v) => {
          const bounds = v.autoFitY ? autoFitBounds : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
          const pRange = bounds.max - bounds.min;
          return {
            ...v,
            autoFitY: false,
            priceCenter: v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter,
            priceRange: Math.max(pRange * 0.01, pRange * 0.85),
          };
        });
      } else if (e.key === "-" && e.shiftKey) {
        // Shift+- : vertical zoom out
        setView((v) => {
          const bounds = v.autoFitY ? autoFitBounds : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
          const pRange = bounds.max - bounds.min;
          return {
            ...v,
            autoFitY: false,
            priceCenter: v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter,
            priceRange: pRange * 1.18,
          };
        });
      } else if (e.key === "0" || e.key === "r" || e.key === "R") {
        // Reset
        setView({
          offset: 0,
          visibleCount: 120,
          autoFitY: true,
          priceCenter: 0,
          priceRange: 0,
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [candles.length, view.visibleCount, autoFitBounds]);

  // === ACTION HANDLERS ===
  const autoFit = useCallback(() => {
    setView((v) => ({ ...v, autoFitY: true, priceCenter: 0, priceRange: 0 }));
  }, []);

  const resetAll = useCallback(() => {
    setView({
      offset: 0,
      visibleCount: 120,
      autoFitY: true,
      priceCenter: 0,
      priceRange: 0,
    });
  }, []);

  const zoomH = useCallback((dir: "in" | "out") => {
    setView((v) => ({
      ...v,
      visibleCount: dir === "in"
        ? Math.max(MIN_VISIBLE, Math.round(v.visibleCount * 0.85))
        : Math.min(MAX_VISIBLE, Math.round(v.visibleCount * 1.18)),
    }));
  }, []);

  const zoomV = useCallback((dir: "in" | "out") => {
    setView((v) => {
      const bounds = v.autoFitY
        ? autoFitBounds
        : { min: v.priceCenter - v.priceRange / 2, max: v.priceCenter + v.priceRange / 2 };
      const pRange = bounds.max - bounds.min;
      const factor = dir === "in" ? 0.85 : 1.18;
      return {
        ...v,
        autoFitY: false,
        priceCenter: v.autoFitY ? (bounds.min + bounds.max) / 2 : v.priceCenter,
        priceRange: Math.max(pRange * 0.01, pRange * factor),
      };
    });
  }, [autoFitBounds]);

  const toggleYLock = useCallback(() => {
    setView((v) => {
      if (v.autoFitY) {
        // Switch to manual — snapshot current auto-fit
        return {
          ...v,
          autoFitY: false,
          priceCenter: (autoFitBounds.min + autoFitBounds.max) / 2,
          priceRange: autoFitBounds.max - autoFitBounds.min,
        };
      } else {
        return { ...v, autoFitY: true, priceCenter: 0, priceRange: 0 };
      }
    });
  }, [autoFitBounds]);

  const panLeft = useCallback(() => {
    setView((v) => {
      const panSpeed = Math.max(1, Math.round(v.visibleCount * 0.1));
      return { ...v, offset: Math.min(candles.length - v.visibleCount, v.offset + panSpeed) };
    });
  }, [candles.length]);

  const panRight = useCallback(() => {
    setView((v) => {
      const panSpeed = Math.max(1, Math.round(v.visibleCount * 0.1));
      return { ...v, offset: Math.max(0, v.offset - panSpeed) };
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      style={{ minHeight: height }}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onDoubleClick={onDoubleClick}
        className="block"
        style={{ background: "#020803", cursor: "crosshair" }}
      />

      {/* Hover tooltip (OHLCV) */}
      {hoverCandle && !isDragging && (
        <div
          className="absolute pointer-events-none bg-[rgba(2,8,3,0.92)] border border-[rgba(0,255,127,0.4)] px-2 py-1 text-[9px] matrix-text z-20"
          style={{
            top: 8,
            right: 90,
            fontFamily: "var(--font-jetbrains), monospace",
            minWidth: 160,
          }}
        >
          <div className="text-[var(--matrix-green-dim)] mb-0.5">
            {new Date(hoverCandle.t).toISOString().slice(0, 16).replace("T", " ")}
          </div>
          <div>O: <span className="matrix-text-bright">{hoverCandle.o.toFixed(2)}</span></div>
          <div>H: <span className="matrix-text-bright">{hoverCandle.h.toFixed(2)}</span></div>
          <div>L: <span className="matrix-text-bright">{hoverCandle.l.toFixed(2)}</span></div>
          <div>C: <span className="matrix-text-bright">{hoverCandle.c.toFixed(2)}</span></div>
          <div>V: <span className="matrix-text-amber">{hoverCandle.v.toFixed(2)}</span></div>
          {hoverPrice && (
            <div className="mt-1 pt-1 border-t border-[rgba(0,255,127,0.2)]">
              Y: <span className="matrix-text-cyan">{hoverPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Chart control toolbar — top right */}
      <div
        className="absolute top-1 right-[90px] flex items-center gap-1 z-10"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        {/* Pan left */}
        <button
          onClick={panLeft}
          title="Pan left (older)"
          className="h-6 w-6 text-[10px] matrix-text-dim hover:matrix-text-bright border border-[rgba(0,255,127,0.2)] hover:border-[var(--matrix-green)] bg-[rgba(2,8,3,0.7)]"
        >◀</button>
        {/* Pan right */}
        <button
          onClick={panRight}
          title="Pan right (newer)"
          className="h-6 w-6 text-[10px] matrix-text-dim hover:matrix-text-bright border border-[rgba(0,255,127,0.2)] hover:border-[var(--matrix-green)] bg-[rgba(2,8,3,0.7)]"
        >▶</button>
        <span className="mx-1 text-[var(--matrix-green-dim)]">|</span>
        {/* Horizontal zoom out */}
        <button
          onClick={() => zoomH("out")}
          title="Zoom out horizontal (-)"
          className="h-6 w-6 text-[10px] matrix-text-dim hover:matrix-text-bright border border-[rgba(0,255,127,0.2)] hover:border-[var(--matrix-green)] bg-[rgba(2,8,3,0.7)]"
        >─</button>
        {/* Horizontal zoom in */}
        <button
          onClick={() => zoomH("in")}
          title="Zoom in horizontal (+)"
          className="h-6 w-6 text-[10px] matrix-text-dim hover:matrix-text-bright border border-[rgba(0,255,127,0.2)] hover:border-[var(--matrix-green)] bg-[rgba(2,8,3,0.7)]"
        >+</button>
        <span className="mx-1 text-[var(--matrix-green-dim)]">|</span>
        {/* Vertical zoom out */}
        <button
          onClick={() => zoomV("out")}
          title="Zoom out vertical (Shift+-)"
          className="h-6 w-6 text-[10px] matrix-text-dim hover:matrix-text-bright border border-[rgba(0,255,127,0.2)] hover:border-[var(--matrix-green)] bg-[rgba(2,8,3,0.7)]"
        >⊟</button>
        {/* Vertical zoom in */}
        <button
          onClick={() => zoomV("in")}
          title="Zoom in vertical (Shift+=)"
          className="h-6 w-6 text-[10px] matrix-text-dim hover:matrix-text-bright border border-[rgba(0,255,127,0.2)] hover:border-[var(--matrix-green)] bg-[rgba(2,8,3,0.7)]"
        >⊞</button>
        {/* Y lock toggle */}
        <button
          onClick={toggleYLock}
          title={view.autoFitY ? "Y axis: AUTO (click to lock)" : "Y axis: LOCKED (click to auto-fit)"}
          className="px-1.5 h-6 text-[9px] font-bold tracking-wider border bg-[rgba(2,8,3,0.7)]"
          style={{
            color: view.autoFitY ? "var(--matrix-green)" : "var(--matrix-amber)",
            borderColor: view.autoFitY ? "rgba(0,255,127,0.4)" : "rgba(255,176,0,0.5)",
          }}
        >
          {view.autoFitY ? "Y:AUTO" : "Y:LOCK"}
        </button>
        {/* Reset */}
        <button
          onClick={resetAll}
          title="Reset view (double-click or R)"
          className="px-1.5 h-6 text-[9px] font-bold tracking-wider border border-[rgba(0,255,224,0.4)] text-[var(--matrix-cyan)] hover:bg-[rgba(0,255,224,0.1)] bg-[rgba(2,8,3,0.7)]"
        >⟲</button>
      </div>

      {/* Help text — bottom left */}
      <div
        className="absolute bottom-1 left-2 flex flex-wrap items-center gap-3 text-[8px] matrix-text-dim z-10"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        <span title="Left-click drag to pan (H+V)">DRAG=pan</span>
        <span title="Right-click drag to box-zoom">RDRAG=box-zoom</span>
        <span title="Plain wheel = horizontal pan">WHL=H-pan</span>
        <span title="Ctrl+wheel = horizontal zoom">⌘WHL=H-zoom</span>
        <span title="Shift+wheel = vertical pan">⇧WHL=V-pan</span>
        <span title="Alt+wheel = vertical zoom">⌥WHL=V-zoom</span>
        <span title="Arrow keys pan, +/- zoom, R reset">⌨ ←→↑↓ +/- R</span>
        <span title="Double-click to reset">2×CLK=reset</span>
      </div>

      {/* Zoom level indicator — bottom right */}
      <div
        className="absolute bottom-1 right-[90px] flex items-center gap-2 text-[8px] z-10"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        <span className="matrix-text-dim">
          H:{view.visibleCount}c
        </span>
        <span className="matrix-text-dim">|</span>
        <span style={{ color: view.autoFitY ? "var(--matrix-green)" : "var(--matrix-amber)" }}>
          V:{view.autoFitY ? "AUTO" : `${view.priceRange.toFixed(2)}`}
        </span>
        <span className="matrix-text-dim">|</span>
        <span className="matrix-text-dim">
          {((view.visibleCount / Math.max(candles.length, 1)) * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

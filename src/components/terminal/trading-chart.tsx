"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTradingStore, openPosition, closePosition, checkPosition } from "@/lib/store";
import { analyzeSMC, analyzeOrderflow, buildTradePlan } from "@/lib/smc";
import type { Candle, Structure } from "@/lib/types";
import { fmtPrice, fmtTime } from "@/lib/format";

interface ChartProps {
  height?: number;
}

interface ViewRange {
  start: number; // candle index
  end: number;   // candle index
  priceMin: number;
  priceMax: number;
}

export default function TradingChart({ height = 560 }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);
  const [view, setView] = useState<{ offset: number; visibleCount: number }>({
    offset: 0,
    visibleCount: 120,
  });
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
    position,
    mode,
    aiSignal,
    pushSignal,
    symbol,
  } = useTradingStore();

  const candles = candlesByTf[activeTimeframe] ?? [];

  // Analysis — memoized
  const analysis = useMemo(() => {
    if (candles.length < 30) return null;
    const smc = analyzeSMC(candles);
    const orderflow = analyzeOrderflow(candles, 80);
    const plan = buildTradePlan(candles, smc, orderflow, livePrice || candles.at(-1)!.c);
    return { smc, orderflow, plan };
  }, [candles, livePrice]);

  // Resize observer
  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ w: rect.width, h: rect.height });
      }
    });
    ro.observe(containerRef.current!);
    return () => ro.disconnect();
  }, []);

  // Draw loop
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

    // Layout
    const padL = 8;
    const padR = 80; // price axis
    const padT = 8;
    const padB = 24; // time axis
    const volH = showVolume ? Math.min(80, h * 0.18) : 0;
    const chartH = h - padT - padB - volH;
    const chartW = w - padL - padR;
    const volTop = h - padB - volH;

    if (candles.length < 5) {
      ctx.fillStyle = "rgba(0, 255, 127, 0.5)";
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillText("// ACQUIRING MARKET DATA...", padL, h / 2);
      return;
    }

    // Visible range
    const total = candles.length;
    const visible = Math.min(view.visibleCount, total);
    const startIdx = Math.max(0, total - visible - view.offset);
    const endIdx = Math.min(total, startIdx + visible);
    const visibleCandles = candles.slice(startIdx, endIdx);

    // Price range
    let pMin = Infinity;
    let pMax = -Infinity;
    let vMax = 0;
    for (const c of visibleCandles) {
      if (c.l < pMin) pMin = c.l;
      if (c.h > pMax) pMax = c.h;
      if (c.v > vMax) vMax = c.v;
    }
    // Include AI signal levels and position levels in range
    const extraLevels: number[] = [];
    if (position.entry) extraLevels.push(position.entry);
    if (position.stop) extraLevels.push(position.stop);
    if (position.tp1) extraLevels.push(position.tp1);
    if (position.tp2) extraLevels.push(position.tp2);
    if (position.tp3) extraLevels.push(position.tp3);
    if (aiSignal) {
      extraLevels.push(aiSignal.entry, aiSignal.stop, aiSignal.tp1, aiSignal.tp2, aiSignal.tp3);
    }
    for (const lv of extraLevels) {
      if (isFinite(lv)) {
        pMin = Math.min(pMin, lv);
        pMax = Math.max(pMax, lv);
      }
    }
    if (livePrice) {
      pMin = Math.min(pMin, livePrice);
      pMax = Math.max(pMax, livePrice);
    }
    // Include SMC structures
    if (analysis && showSMC) {
      for (const f of analysis.smc.fvgs) {
        if (f.index < startIdx || f.index > endIdx) continue;
        pMin = Math.min(pMin, f.bottom);
        pMax = Math.max(pMax, f.top);
      }
      for (const o of analysis.smc.orderBlocks) {
        if (o.index < startIdx || o.index > endIdx) continue;
        pMin = Math.min(pMin, o.bottom);
        pMax = Math.max(pMax, o.top);
      }
      for (const l of analysis.smc.liquidity) {
        if (!l.price) continue;
        pMin = Math.min(pMin, l.price);
        pMax = Math.max(pMax, l.price);
      }
    }
    const pad = (pMax - pMin) * 0.08;
    pMin -= pad;
    pMax += pad;
    const pRange = pMax - pMin || 1;

    // === GRID ===
    ctx.strokeStyle = "rgba(0, 255, 127, 0.05)";
    ctx.lineWidth = 1;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = "rgba(0, 255, 127, 0.35)";
    // Horizontal gridlines
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
    // Vertical gridlines (time)
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
    const candleW = Math.max(1, Math.min(12, candleSlot * 0.7));

    function xOf(idx: number) {
      return padL + (idx - startIdx + 0.5) * candleSlot;
    }
    function yOf(price: number) {
      return padT + ((pMax - price) / pRange) * chartH;
    }

    // === SMC OVERLAYS — draw behind candles ===
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
          // label
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
          // Only draw liquidity that is within visible range
          const y = yOf(liq.price);
          if (y < padT || y > padT + chartH) continue;
          const isBSL = liq.kind === "LIQ_BSL" || liq.kind === "EQH" || liq.kind === "SWEEP_BSL";
          const isSSL = liq.kind === "LIQ_SSL" || liq.kind === "EQL" || liq.kind === "SWEEP_SSL";
          const xStart = Math.max(padL, xOf(liq.index));
          if (liq.kind === "SWEEP_BSL" || liq.kind === "SWEEP_SSL") {
            // Sweep marker
            ctx.strokeStyle = isBSL ? "rgba(255, 0, 212, 0.7)" : "rgba(0, 255, 224, 0.7)";
            ctx.fillStyle = isBSL ? "rgba(255, 0, 212, 0.7)" : "rgba(0, 255, 224, 0.7)";
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(xStart, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();
            // triangle marker
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
        // arrow
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

    // === VOLUME BARS (bottom area) ===
    if (showVolume) {
      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const idx = startIdx + i;
        const x = xOf(idx);
        const vh = (c.v / vMax) * (volH - 4);
        const up = c.c >= c.o;
        ctx.fillStyle = up
          ? "rgba(0, 255, 127, 0.4)"
          : "rgba(255, 59, 59, 0.4)";
        ctx.fillRect(x - candleW / 2, volTop + volH - vh, candleW, vh);
      }
      // Volume label
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

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yOf(c.h));
      ctx.lineTo(x, yOf(c.l));
      ctx.stroke();

      // Body
      const yO = yOf(c.o);
      const yC = yOf(c.c);
      const bodyTop = Math.min(yO, yC);
      const bodyH = Math.max(1, Math.abs(yC - yO));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
      // glow on latest
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
      // label tag
      ctx.fillStyle = c;
      ctx.fillRect(padL + chartW, y - 8, padR, 16);
      ctx.fillStyle = "#000";
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(livePrice.toFixed(2), padL + chartW + 4, y + 3);
    }

    // === AI SIGNAL ZONES (entry / SL / TP) ===
    if (aiSignal && aiSignal.side !== "NEUTRAL") {
      const zones: { price: number; color: string; label: string; fillAlpha: number }[] = [
        { price: aiSignal.entry, color: "#00ffe0", label: `AI ENTRY`, fillAlpha: 0.08 },
        { price: aiSignal.stop, color: "#ff3b3b", label: `AI STOP`, fillAlpha: 0.06 },
        { price: aiSignal.tp1, color: "#00ff7f", label: `AI TP1`, fillAlpha: 0.06 },
        { price: aiSignal.tp2, color: "#5fffaa", label: `AI TP2`, fillAlpha: 0.04 },
        { price: aiSignal.tp3, color: "#ffb000", label: `AI TP3`, fillAlpha: 0.04 },
      ];
      for (const z of zones) {
        const y = yOf(z.price);
        if (y < padT || y > padT + chartH) continue;
        ctx.fillStyle = z.color + Math.floor(z.fillAlpha * 255).toString(16).padStart(2, "0");
        ctx.fillRect(padL, y - 1, chartW, 2);
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // label
        ctx.fillStyle = z.color;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(`${z.label} ${z.price.toFixed(2)}`, padL + 6, y - 3);
      }
      // Zone fills between entry→stop and entry→TP1
      const entryY = yOf(aiSignal.entry);
      const stopY = yOf(aiSignal.stop);
      const tp1Y = yOf(aiSignal.tp1);
      ctx.fillStyle = "rgba(255, 59, 59, 0.06)";
      ctx.fillRect(padL, Math.min(entryY, stopY), chartW, Math.abs(stopY - entryY));
      ctx.fillStyle = "rgba(0, 255, 127, 0.06)";
      ctx.fillRect(padL, Math.min(entryY, tp1Y), chartW, Math.abs(tp1Y - entryY));
    }

    // === OPEN POSITION ZONES ===
    if (position.status === "IN_POSITION" && position.entry && position.stop && position.tp1) {
      const zones: { price: number; color: string; label: string }[] = [
        { price: position.entry, color: "#00ffe0", label: `POS ENTRY` },
        { price: position.stop, color: "#ff3b3b", label: `POS STOP` },
        { price: position.tp1, color: "#00ff7f", label: `POS TP1` },
      ];
      if (position.tp2) zones.push({ price: position.tp2, color: "#5fffaa", label: `POS TP2` });
      if (position.tp3) zones.push({ price: position.tp3, color: "#ffb000", label: `POS TP3` });
      for (const z of zones) {
        const y = yOf(z.price);
        if (y < padT || y > padT + chartH) continue;
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + chartW, y);
        ctx.stroke();
        ctx.fillStyle = z.color;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(`${z.label} ${z.price.toFixed(2)}`, padL + 6, y - 3);
      }
      // liquidation line
      if (position.liquidation) {
        const y = yOf(position.liquidation);
        if (y > padT && y < padT + chartH) {
          ctx.strokeStyle = "rgba(255, 0, 212, 0.6)";
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + chartW, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(255, 0, 212, 0.9)";
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(`LIQ ${position.liquidation.toFixed(2)}`, padL + 6, y - 3);
        }
      }
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
    if (hoverRef.current.visible) {
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
        // price label
        const price = pMax - ((hy - padT) / chartH) * pRange;
        ctx.fillStyle = "rgba(0, 255, 127, 0.9)";
        ctx.fillRect(padL + chartW, hy - 8, padR, 16);
        ctx.fillStyle = "#000";
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.fillText(price.toFixed(2), padL + chartW + 4, hy + 3);
      }
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
    ctx.fillStyle = "rgba(0, 255, 127, 0.85)";
    ctx.font = '9px "JetBrains Mono", monospace';
    topOverlays.forEach((line, i) => {
      ctx.fillText(line, padL + 4, padT + 12 + i * 12);
    });

    // === LEGEND (bottom right) ===
    const legend = [
      ["BOS/CHoCH", "#00ff7f"],
      ["FVG", "#ff3b3b"],
      ["OB", "rgba(0,255,127,0.4)"],
      ["LIQ BSL", "#ffb000"],
      ["LIQ SSL", "#00ffe0"],
      ["SWEEP", "#ff00d4"],
      ["AI LVL", "#00ffe0"],
      ["POS LVL", "rgba(255,176,0,0.8)"],
    ];
    ctx.font = '8px "JetBrains Mono", monospace';
    let lx = padL + chartW - 200;
    const ly = padT + 4;
    legend.forEach(([lbl, col], i) => {
      const x = lx + (i % 4) * 50;
      const y = ly + Math.floor(i / 4) * 11;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = "rgba(0, 255, 127, 0.7)";
      ctx.fillText(lbl, x + 10, y + 7);
    });
  }, [candles, dimensions, view, analysis, livePrice, prevPrice, position, aiSignal, activeTimeframe, symbol, showSMC, showOrderflow, showLiquidity, showFVG, showOB, showVolume]);

  // === AUTO-EXECUTE AI SIGNAL ===
  const { autoExecute, setLivePrice, setConnection } = useTradingStore();
  useEffect(() => {
    if (!autoExecute || !aiSignal || !analysis?.plan) return;
    if (position.status === "IN_POSITION") return;
    if (aiSignal.side === "NEUTRAL") return;
    if (aiSignal.confidence < 60) return;
    // Open position from AI signal
    const sig = aiSignal;
    openPosition(sig.side, sig.entry, sig.stop, sig.tp1, sig.tp2, sig.tp3, 10, 1);
    pushSignal({
      id: Math.random().toString(36).slice(2),
      ts: Date.now(),
      side: sig.side,
      type: "ENTRY",
      price: sig.entry,
      note: `[AUTO-EXEC] AI ${sig.side} conf=${sig.confidence.toFixed(0)}% | ${mode}`,
      confidence: sig.confidence,
    });
  }, [autoExecute, aiSignal, position.status]);

  // === CHECK POSITION ON PRICE UPDATE ===
  useEffect(() => {
    if (livePrice > 0) checkPosition(livePrice);
  }, [livePrice]);

  // === HOVER HANDLERS ===
  function onMove(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    hoverRef.current = { x, y, visible: true };
    // find candle
    const padL = 8;
    const padR = 80;
    const chartW = dimensions.w - padL - padR;
    const total = candles.length;
    const visible = Math.min(view.visibleCount, total);
    const startIdx = Math.max(0, total - visible - view.offset);
    const slot = chartW / visible;
    const idx = Math.floor((x - padL) / slot) + startIdx;
    if (idx >= 0 && idx < candles.length) setHoverCandle(candles[idx]);
    // force redraw
    canvas.style.cursor = "crosshair";
  }
  function onLeave() {
    hoverRef.current.visible = false;
    setHoverCandle(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = "default";
  }

  // === WHEEL ZOOM/PAN ===
  function onWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      setView((v) => ({
        ...v,
        visibleCount: Math.max(30, Math.min(400, v.visibleCount + (e.deltaY > 0 ? 10 : -10))),
      }));
    } else {
      setView((v) => ({
        ...v,
        offset: Math.max(0, Math.min(candles.length - v.visibleCount, v.offset + (e.deltaY > 0 ? 4 : -4))),
      }));
    }
  }

  // === KEYBOARD ===
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setView((v) => ({ ...v, offset: Math.min(candles.length - v.visibleCount, v.offset + 5) }));
      } else if (e.key === "ArrowRight") {
        setView((v) => ({ ...v, offset: Math.max(0, v.offset - 5) }));
      } else if (e.key === "+" || e.key === "=") {
        setView((v) => ({ ...v, visibleCount: Math.max(30, v.visibleCount - 10) }));
      } else if (e.key === "-") {
        setView((v) => ({ ...v, visibleCount: Math.min(400, v.visibleCount + 10) }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [candles.length]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ minHeight: height }}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="block"
        style={{ background: "#020803" }}
      />
      {/* Hover tooltip */}
      {hoverCandle && (
        <div
          className="absolute pointer-events-none bg-[rgba(2,8,3,0.92)] border border-[rgba(0,255,127,0.4)] px-2 py-1 text-[9px] matrix-text z-20"
          style={{
            top: 8,
            right: 90,
            fontFamily: "var(--font-jetbrains), monospace",
            minWidth: 160,
          }}
        >
          <div className="text-[var(--matrix-green-dim)] mb-0.5">{new Date(hoverCandle.t).toISOString().slice(0, 16).replace("T", " ")}</div>
          <div>O: <span className="matrix-text-bright">{hoverCandle.o.toFixed(2)}</span></div>
          <div>H: <span className="matrix-text-bright">{hoverCandle.h.toFixed(2)}</span></div>
          <div>L: <span className="matrix-text-bright">{hoverCandle.l.toFixed(2)}</span></div>
          <div>C: <span className="matrix-text-bright">{hoverCandle.c.toFixed(2)}</span></div>
          <div>V: <span className="matrix-text-amber">{hoverCandle.v.toFixed(2)}</span></div>
        </div>
      )}
      {/* Bottom toolbar */}
      <div className="absolute bottom-1 left-2 flex items-center gap-3 text-[9px] matrix-text-dim z-10" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
        <span>SCROLL=pan | CTRL+SCROLL=zoom | ←→=pan | +/-=zoom</span>
      </div>
      {/* Trade plan quick-action */}
      {analysis?.plan && position.status === "FLAT" && (
        <button
          onClick={() => {
            const p = analysis.plan!;
            openPosition(p.side, p.entry, p.stop, p.tp1, p.tp2, p.tp3, 10, 1);
          }}
          className="absolute top-1 right-[90px] px-3 py-1 text-[10px] font-bold tracking-widest bg-[var(--matrix-green)] text-black hover:bg-[var(--matrix-green-bright)] z-10"
          style={{ fontFamily: "var(--font-jetbrains), monospace", boxShadow: "0 0 8px rgba(0,255,127,0.6)" }}
        >
          ▶ EXEC {analysis.plan.side} {analysis.plan.rr.toFixed(1)}R
        </button>
      )}
    </div>
  );
}

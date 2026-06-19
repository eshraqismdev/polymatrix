"use client";

import { useEffect, useRef } from "react";

interface MatrixRainProps {
  className?: string;
  opacity?: number;
  fontSize?: number;
  speed?: number; // ms per frame
}

const CHARS = "01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ$€¥₿◆◇◈░▒▓█▌▐<>=+-*/{}[]#".split("");

export default function MatrixRain({
  className = "",
  opacity = 0.18,
  fontSize = 14,
  speed = 60,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const colsRef = useRef<number>(0);
  const dropsRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas || !ctx) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      const cols = Math.floor(w / fontSize);
      colsRef.current = cols;
      dropsRef.current = new Array(cols).fill(0).map(() => Math.floor(Math.random() * -h / fontSize));
    }

    resize();
    window.addEventListener("resize", resize);

    function draw(ts: number) {
      if (!canvas || !ctx) return;
      if (ts - lastFrameRef.current < speed) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = ts;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Fade the canvas slightly each frame for trailing effect
      ctx.fillStyle = `rgba(0, 0, 0, 0.08)`;
      ctx.fillRect(0, 0, w, h);

      const cols = colsRef.current;
      const drops = dropsRef.current;
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < cols; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        // Bright head, dim tail
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        // Head is bright green
        if (Math.random() > 0.975) {
          ctx.fillStyle = `rgba(180, 255, 220, ${opacity * 3.5})`;
          ctx.fillText(char, x, y);
        } else {
          ctx.fillStyle = `rgba(0, 255, 127, ${opacity})`;
          ctx.fillText(char, x, y);
        }
        // occasional brightening
        if (Math.random() > 0.98) {
          ctx.fillStyle = `rgba(0, 255, 200, ${opacity * 1.6})`;
          ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y - fontSize);
        }
        if (y > h && Math.random() > 0.972) drops[i] = 0;
        drops[i]++;
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fontSize, speed, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden
    />
  );
}

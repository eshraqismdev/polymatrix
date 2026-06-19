import type { Timeframe } from "./types";

export function fmtPrice(p: number, digits = 2): string {
  if (!isFinite(p)) return "—";
  return p.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtCompact(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export function fmtPct(p: number, digits = 2): string {
  if (!isFinite(p)) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(digits)}%`;
}

export function fmtUsd(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtTime(ts: number, withSeconds = true): string {
  const d = new Date(ts);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? ":" + pad(d.getSeconds()) : ""}`;
}

export function fmtTimeUTC(ts: number): string {
  const d = new Date(ts);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Hyperliquid interval codes
export const TF_TO_HL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1W",
};

export const TF_TO_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4H": 4 * 60 * 60_000,
  "1D": 24 * 60 * 60_000,
  "1W": 7 * 24 * 60 * 60_000,
};

export const ALL_TF: Timeframe[] = ["1W", "1D", "4H", "15m", "5m", "1m"];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

import type { Metadata } from "next";
import { Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "NEO//LIQUID — SMC AI Trading Terminal",
  description:
    "AI smart-money scalp trading terminal for BTCUSDT on Hyperliquid. SMC + orderflow + multi-timeframe liquidity analysis with paper/real mode.",
  keywords: [
    "SMC",
    "smart money concepts",
    "Hyperliquid",
    "BTCUSDT",
    "scalping",
    "orderflow",
    "liquidity",
    "AI trading",
  ],
  authors: [{ name: "NEO//LIQUID" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} ${jetbrains.variable} antialiased`}
        style={{ fontFamily: "var(--font-jetbrains), var(--font-geist-mono), 'Courier New', monospace" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

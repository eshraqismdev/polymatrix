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
  title: "NEO//LIQUID — Live SMC Market Analytics (Educational)",
  description:
    "Live Smart Money Concepts (SMC) market analytics terminal for BTCUSDT on Hyperliquid DEX. Educational stream — NOT financial advice. Real-time orderflow, liquidity mapping, and multi-timeframe structure analysis.",
  keywords: [
    "SMC",
    "smart money concepts",
    "Hyperliquid",
    "BTCUSDT",
    "orderflow",
    "liquidity",
    "market analysis",
    "educational",
    "live stream",
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

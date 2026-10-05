import { Calistoga, Inter, Vazirmatn } from "next/font/google";

export const vazirmatn = Vazirmatn({
  // The public default is Persian; keep the critical font request limited to
  // the glyph set used by this locale. Latin copy falls back to the system
  // sans stack without blocking the first heading paint.
  subsets: ["arabic"],
  variable: "--font-sans-fa",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-en",
  display: "swap",
  // The default public landing is Persian; discover this locale-specific font
  // from CSS instead of competing with the above-the-fold image preload.
  preload: false,
});

/** Denali Club display headings — design-system/denali-club/MASTER.md */
export const calistoga = Calistoga({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading-en",
  display: "swap",
  // Keep the English display face available without adding a critical request
  // to the Persian landing path.
  preload: false,
});

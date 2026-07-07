import { Calistoga, Inter, Vazirmatn } from "next/font/google";

export const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-sans-fa",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-en",
  display: "swap",
});

/** Denali Club display headings — design-system/denali-club/MASTER.md */
export const calistoga = Calistoga({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading-en",
  display: "swap",
});

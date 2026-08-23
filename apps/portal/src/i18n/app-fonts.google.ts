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

/** Display heading font for branded guest/member surfaces. */
export const calistoga = Calistoga({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading-en",
  display: "swap",
});

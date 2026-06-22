import { Inter, Vazirmatn } from "next/font/google";

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

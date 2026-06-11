import { Inter, Vazirmatn } from "next/font/google";

import type { AppLocale } from "./routing";

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

export function resolveAppFontClassName(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.className : inter.className;
}

export function resolveAppFontFamilyCss(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.style.fontFamily : inter.style.fontFamily;
}

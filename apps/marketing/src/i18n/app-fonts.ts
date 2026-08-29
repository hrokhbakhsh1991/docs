import type { AppLocale } from "./routing";

import { inter, vazirmatn } from "@/i18n/app-fonts.google";

export { inter, vazirmatn, calistoga } from "@/i18n/app-fonts.google";

export function resolveAppFontClassName(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.className : inter.className;
}

export function resolveAppFontFamilyCss(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.style.fontFamily : inter.style.fontFamily;
}

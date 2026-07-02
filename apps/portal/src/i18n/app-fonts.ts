import type { AppLocale } from "./routing";

import { inter, vazirmatn, calistoga } from "./app-fonts.google";

export { inter, vazirmatn, calistoga };

export function resolveAppFontClassName(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.className : inter.className;
}

export function resolveAppFontFamilyCss(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.style.fontFamily : inter.style.fontFamily;
}

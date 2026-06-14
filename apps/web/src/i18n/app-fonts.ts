import type { AppLocale } from "./routing";

import { inter, vazirmatn } from "./app-fonts.google";

export { inter, vazirmatn };

export function resolveAppFontClassName(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.className : inter.className;
}

export function resolveAppFontFamilyCss(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.style.fontFamily : inter.style.fontFamily;
}

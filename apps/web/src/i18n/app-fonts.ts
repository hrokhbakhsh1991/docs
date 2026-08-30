import type { AppLocale } from "./routing";

// Offline system stack. `app-fonts.google.ts` (`next/font/google`) hangs
// `next dev` when fonts.googleapis.com TLS is blocked (see NEXT_FONT_OFFLINE).
import { inter, vazirmatn } from "./app-fonts.offline";

export { inter, vazirmatn };

export function resolveAppFontClassName(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.className : inter.className;
}

export function resolveAppFontFamilyCss(locale: AppLocale): string {
  return locale === "fa" ? vazirmatn.style.fontFamily : inter.style.fontFamily;
}

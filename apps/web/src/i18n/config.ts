/**
 * Public locale list — single source is `routing.ts` (`defineRouting`).
 * Today only `fa` is active and URLs omit a locale segment; re-expand `routing.locales` when adding languages.
 */
import { routing } from "./routing";

export { routing };
export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;

import { type AppLocale, resolveTextDirection } from "@/i18n/routing";

export type OperatorSheetSide = "left" | "right";

/**
 * Operator detail / master-detail sheets attach to the reading-trailing viewport edge.
 * RTL (fa): physical LEFT — enter/exit from LEFT.
 * LTR (en): physical RIGHT — enter/exit from RIGHT.
 */
export function resolveOperatorDetailSheetSide(locale: AppLocale): OperatorSheetSide {
  return resolveTextDirection(locale) === "rtl" ? "left" : "right";
}

/**
 * Mobile nav drawer attaches to the reading-leading edge (opposite detail sheets).
 */
export function resolveOperatorNavSheetSide(locale: AppLocale): OperatorSheetSide {
  return resolveTextDirection(locale) === "rtl" ? "right" : "left";
}

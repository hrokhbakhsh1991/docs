import { defineRouting } from "next-intl/routing";

/**
 * Single-locale (fa) for now: URLs have **no** `/fa` or `/en` prefix.
 * Legacy `/fa/...` and `/en/...` are stripped in `middleware.ts` (308 → locale-less path).
 * `next-intl` stays wired for future multi-locale; add locales + `localePrefix` when needed.
 */
export const routing = defineRouting({
  locales: ["fa"],
  defaultLocale: "fa",
  localePrefix: "never",
});

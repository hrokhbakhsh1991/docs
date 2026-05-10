import localFont from "next/font/local";

/**
 * Vazirmatn (SIL Open Font License) — self-hosted via `next/font/local` for optimal loading.
 * Variable woff2 files live under `apps/web/fonts/` (Arabic + Latin subsets for mixed UI copy).
 */
export const vazirmatn = localFont({
  src: [
    {
      path: "../../fonts/vazirmatn-arabic-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../fonts/vazirmatn-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../fonts/vazirmatn-latin-ext-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-vazirmatn",
});

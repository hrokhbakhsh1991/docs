/** Home-only transparent header — catalog/detail use solid sticky (PR-12). */
export const MARKETING_HEADER_OVERLAY_REQUEST_HEADER = "x-marketing-header-overlay";

export function isMarketingHomePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized === "/" || normalized === "/en";
}

export function resolveMarketingHeaderOverlay(input: {
  readonly landingVariant: string;
  readonly pathname: string;
}): boolean {
  return input.landingVariant === "full" && isMarketingHomePath(input.pathname);
}

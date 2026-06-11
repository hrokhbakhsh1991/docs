/** Local dev marketing host map — not valid in production unless explicitly allowed. */
export function isDevMarketingHostAllowed(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_WEB_SESSION === "true";
}

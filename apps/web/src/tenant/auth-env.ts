/** Local dev web session via env — enable only when ALLOW_DEV_WEB_SESSION is set. */
export function isDevWebSessionAllowed(): boolean {
  // `next start` forces NODE_ENV=production; ALLOW_DEV_WEB_SESSION is the explicit VPS/staging gate.
  return process.env.ALLOW_DEV_WEB_SESSION === "true";
}

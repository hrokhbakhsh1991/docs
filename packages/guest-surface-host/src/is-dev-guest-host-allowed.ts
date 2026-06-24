/** M+P dev guest bootstrap — ALLOW_DEV_WEB_SESSION (P8/P9 parity). */
export function isDevGuestHostAllowed(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_WEB_SESSION === "true";
}

/** @deprecated marketing/portal alias until apps migrate call sites */
export const isDevWebSessionAllowed = isDevGuestHostAllowed;

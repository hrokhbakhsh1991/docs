declare global {
  interface Window {
    /** Playwright smoke: enable Denali local draft without rebuilding with `NEXT_PUBLIC_*`. */
    __DENALI_DRAFT__?: boolean;
  }
}

/**
 * Opt-in Denali wizard local draft autosave.
 * Set `NEXT_PUBLIC_ENABLE_DENALI_DRAFT=1` at build time (unset = no draft writes).
 */
export function isDenaliDraftEnabled(): boolean {
  if (typeof window !== "undefined" && window.__DENALI_DRAFT__ === true) {
    return true;
  }
  return process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT === "1";
}

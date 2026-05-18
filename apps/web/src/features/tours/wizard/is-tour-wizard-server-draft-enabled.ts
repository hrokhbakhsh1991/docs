declare global {
  interface Window {
    /** Playwright smoke: enable server draft without rebuilding with `NEXT_PUBLIC_*`. */
    __TOUR_WIZARD_SERVER_DRAFT__?: boolean;
  }
}

/** Opt-in server draft sync (فاز ۲.۵.۳). Set `NEXT_PUBLIC_TOUR_WIZARD_SERVER_DRAFT=1`. */
export function isTourWizardServerDraftEnabled(): boolean {
  if (typeof window !== "undefined" && window.__TOUR_WIZARD_SERVER_DRAFT__ === true) {
    return true;
  }
  return process.env.NEXT_PUBLIC_TOUR_WIZARD_SERVER_DRAFT === "1";
}

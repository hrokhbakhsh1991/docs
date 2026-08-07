const DEFAULT_MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 50;
/** Per-attempt ceiling so a hung Next BFF cannot leave OTP on «verifying…» forever. */
const ATTEMPT_TIMEOUT_MS = 2_500;

/** Bounded retry until member BFF accepts session (Set-Cookie from verify-otp committed). */
export async function waitForMemberSessionCookie(
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch("/api/me/profile", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok === true) {
          return true;
        }
      }
    } catch {
      // retry (network, abort/timeout, parse)
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, BASE_DELAY_MS * (attempt + 1));
      });
    }
  }
  return false;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 50;

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
      });
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok === true) {
          return true;
        }
      }
    } catch {
      // retry
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, BASE_DELAY_MS * (attempt + 1));
      });
    }
  }
  return false;
}

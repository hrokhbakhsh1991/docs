import {
  buildPublicRegistrationProfilePayload,
  readPublicRegistrationErrorCode,
  type PublicRegistrationApiError,
} from "@app-tour/catalog-registration-auth";

import { waitForMemberSessionCookie } from "./wait-member-session-cookie";

export type GuestAuthVerifyOutcome =
  | { readonly outcome: "session_ready" }
  | { readonly outcome: "needs_profile"; readonly onboardingToken: string };

/**
 * Network + session probe only. No cookie write, tenant, origin, or intake.
 * Portal same-origin adapter is the only implementation until a PCMS amendment.
 */
export type GuestAuthTransport = {
  readonly preflightPhone: (input: { readonly phone: string }) => Promise<{ readonly exists: boolean }>;
  readonly requestOtp: (input: { readonly phone: string }) => Promise<{ readonly challengeId: string }>;
  readonly verifyOtp: (input: {
    readonly phone: string;
    readonly otp: string;
    readonly challengeId: string;
  }) => Promise<GuestAuthVerifyOutcome>;
  readonly completeProfile: (input: {
    readonly onboardingToken: string;
    readonly displayName: string;
    readonly email?: string;
  }) => Promise<{ readonly outcome: "session_ready" }>;
  readonly probeSession: () => Promise<{ readonly ready: boolean }>;
};

export class GuestAuthTransportError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "GuestAuthTransportError";
    this.code = code;
  }
}

export function isGuestAuthTransportError(error: unknown): error is GuestAuthTransportError {
  return error instanceof GuestAuthTransportError;
}

export function readGuestAuthFailureCode(error: unknown): string {
  return isGuestAuthTransportError(error) ? error.code : "network";
}

type PublicAuthJson = PublicRegistrationApiError & {
  readonly exists?: boolean;
};

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function postPublicAuthJson(
  path: string,
  body: unknown
): Promise<{ readonly ok: boolean; readonly data: PublicAuthJson }> {
  const res = await fetch(path, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as PublicAuthJson;
  return { ok: res.ok, data };
}

/**
 * Today's Portal host: relative BFF paths. Does not accept a base URL
 * (a future Marketing adapter would be a separate factory).
 */
export function createPortalSameOriginGuestAuthTransport(): GuestAuthTransport {
  return {
    async preflightPhone(input) {
      const { ok, data } = await postPublicAuthJson("/api/public-auth/phone-preflight", {
        phone: input.phone,
      });
      if (!ok) {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      return { exists: data.exists === true };
    },
    async requestOtp(input) {
      const { ok, data } = await postPublicAuthJson("/api/public-auth/request-otp", {
        phone: input.phone,
      });
      if (!ok || data.ok !== true || typeof data.challenge_id !== "string") {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      return { challengeId: data.challenge_id };
    },
    async verifyOtp(input) {
      const { ok, data } = await postPublicAuthJson("/api/public-auth/verify-otp", {
        phone: input.phone,
        otp: input.otp,
        challenge_id: input.challengeId,
      });
      if (!ok || data.ok !== true) {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      if (data.requires_registration === true) {
        const onboardingToken =
          typeof data.onboarding_token === "string" ? data.onboarding_token : "";
        if (onboardingToken.length === 0) {
          throw new GuestAuthTransportError("network");
        }
        return { outcome: "needs_profile", onboardingToken };
      }
      return { outcome: "session_ready" };
    },
    async completeProfile(input) {
      const { ok, data } = await postPublicAuthJson(
        "/api/public-auth/register-complete",
        buildPublicRegistrationProfilePayload({
          onboardingToken: input.onboardingToken,
          displayName: input.displayName,
          profileEmail: input.email ?? "",
        })
      );
      if (!ok || data.ok !== true) {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      return { outcome: "session_ready" };
    },
    async probeSession() {
      const ready = await waitForMemberSessionCookie();
      return { ready };
    },
  };
}

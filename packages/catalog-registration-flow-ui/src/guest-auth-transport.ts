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
 * Portal same-origin and Marketing Portal-origin are separate factories.
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
  readonly session_token?: unknown;
};

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

const PUBLIC_AUTH_SESSION_MAX_ATTEMPTS = 8;
const PUBLIC_AUTH_SESSION_BASE_DELAY_MS = 50;
const PUBLIC_AUTH_SESSION_ATTEMPT_TIMEOUT_MS = 2_500;

async function postPublicAuthJson(
  url: string,
  body: unknown
): Promise<{ readonly ok: boolean; readonly data: PublicAuthJson }> {
  const res = await fetch(url, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as PublicAuthJson;
  return { ok: res.ok, data };
}

function createGuestAuthTransportFromPublicAuthBase(
  urlForPath: (path: string) => string,
  probeSession: GuestAuthTransport["probeSession"]
): GuestAuthTransport {
  return {
    async preflightPhone(input) {
      const { ok, data } = await postPublicAuthJson(urlForPath("/api/public-auth/phone-preflight"), {
        phone: input.phone,
      });
      if (!ok) {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      return { exists: data.exists === true };
    },
    async requestOtp(input) {
      const { ok, data } = await postPublicAuthJson(urlForPath("/api/public-auth/request-otp"), {
        phone: input.phone,
      });
      if (!ok || data.ok !== true || typeof data.challenge_id !== "string") {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      return { challengeId: data.challenge_id };
    },
    async verifyOtp(input) {
      const { ok, data } = await postPublicAuthJson(urlForPath("/api/public-auth/verify-otp"), {
        phone: input.phone,
        otp: input.otp,
        challenge_id: input.challengeId,
      });
      // JSON session_token (if present) is ignored — cookie write stays Portal Set-Cookie.
      void data.session_token;
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
        urlForPath("/api/public-auth/register-complete"),
        buildPublicRegistrationProfilePayload({
          onboardingToken: input.onboardingToken,
          displayName: input.displayName,
          profileEmail: input.email ?? "",
        })
      );
      void data.session_token;
      if (!ok || data.ok !== true) {
        throw new GuestAuthTransportError(readPublicRegistrationErrorCode(data));
      }
      return { outcome: "session_ready" };
    },
    probeSession,
  };
}

/**
 * Today's Portal host: relative BFF paths. Does not accept a base URL
 * (Marketing uses tryCreatePortalOriginGuestAuthTransport).
 */
export function createPortalSameOriginGuestAuthTransport(): GuestAuthTransport {
  return createGuestAuthTransportFromPublicAuthBase(
    (path) => path,
    async () => {
      const ready = await waitForMemberSessionCookie();
      return { ready };
    }
  );
}

/** http(s) origin only — no `*`, userinfo, or relative URLs. */
export function parsePortalPublicOrigin(
  portalPublicBaseUrl: string | null | undefined
): string | null {
  if (typeof portalPublicBaseUrl !== "string") {
    return null;
  }
  const trimmed = portalPublicBaseUrl.trim();
  if (trimmed.length === 0 || trimmed === "*") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return null;
  }
  return url.origin;
}

async function waitForPublicAuthSession(origin: string): Promise<boolean> {
  for (let attempt = 0; attempt < PUBLIC_AUTH_SESSION_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${origin}/api/public-auth/session`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(PUBLIC_AUTH_SESSION_ATTEMPT_TIMEOUT_MS),
      });
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean; ready?: boolean };
        if (body.ok === true && body.ready === true) {
          return true;
        }
      }
    } catch {
      // retry (network, abort/timeout, parse)
    }
    if (attempt < PUBLIC_AUTH_SESSION_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, PUBLIC_AUTH_SESSION_BASE_DELAY_MS * (attempt + 1));
      });
    }
  }
  return false;
}

/**
 * Marketing host: absolute Portal public origin. Cookie write stays Portal BFF (CORS).
 * probeSession uses GET {origin}/api/public-auth/session — never /api/me/profile.
 */
export function tryCreatePortalOriginGuestAuthTransport(
  portalPublicBaseUrl: string | null | undefined
): GuestAuthTransport | null {
  const origin = parsePortalPublicOrigin(portalPublicBaseUrl);
  if (origin === null) {
    return null;
  }
  return createGuestAuthTransportFromPublicAuthBase(
    (path) => `${origin}${path}`,
    async () => {
      const ready = await waitForPublicAuthSession(origin);
      return { ready };
    }
  );
}

export function createPortalOriginGuestAuthTransport(
  portalPublicBaseUrl: string
): GuestAuthTransport {
  const transport = tryCreatePortalOriginGuestAuthTransport(portalPublicBaseUrl);
  if (transport === null) {
    throw new GuestAuthTransportError("network");
  }
  return transport;
}

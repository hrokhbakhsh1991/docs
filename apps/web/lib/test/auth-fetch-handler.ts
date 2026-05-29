import {
  buildTestSessionJwt,
  createMembershipAbilityContextResponse,
  createSessionHydrateResponse,
  createUnauthenticatedSessionResponse,
} from "./session-fixtures";
import { createJsonResponse } from "./fetch-response";

export type AuthFetchMockSessionType = "authenticated" | "unauthenticated";

export type AuthFetchHandlerOptions = {
  sessionType?: AuthFetchMockSessionType;
  sessionToken?: string;
  handler?: (
    url: string,
    init?: RequestInit,
  ) => Response | Promise<Response> | undefined;
};

export function resolveFetchUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

export async function handleAuthFetchRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: AuthFetchHandlerOptions = {},
): Promise<Response> {
  const url = resolveFetchUrl(input);
  const sessionType = options.sessionType ?? "authenticated";
  const sessionToken = options.sessionToken ?? buildTestSessionJwt();

  if (options.handler) {
    const custom = await options.handler(url, init);
    if (custom != null) {
      return custom;
    }
  }

  if (url.includes("/api/auth/session")) {
    if (sessionType === "unauthenticated") {
      return createUnauthenticatedSessionResponse();
    }
    return createSessionHydrateResponse(sessionToken);
  }

  if (url.includes("/api/auth/membership-ability-context")) {
    return createMembershipAbilityContextResponse();
  }

  return createJsonResponse({}, 404);
}

import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export const OPERATOR_AUTH_BFF_FETCH_TIMEOUT_MS = 10_000;

export function buildOperatorAuthBffFetchInit(init: RequestInit = {}): RequestInit {
  return {
    cache: "no-store",
    ...init,
    signal: init.signal ?? AbortSignal.timeout(OPERATOR_AUTH_BFF_FETCH_TIMEOUT_MS),
  };
}

export function buildOperatorAuthBffUrl(pathname: string): string {
  return `${resolveTourOpsApiBaseUrl()}${pathname}`;
}

export async function fetchOperatorAuthBff(
  pathname: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(buildOperatorAuthBffUrl(pathname), buildOperatorAuthBffFetchInit(init));
}

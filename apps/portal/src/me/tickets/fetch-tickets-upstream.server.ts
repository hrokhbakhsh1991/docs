import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";

export async function fetchTicketsUpstream(
  host: string,
  path: string,
  init?: {
    readonly method?: string;
    readonly query?: Record<string, string>;
    readonly body?: unknown;
    readonly idempotencyKey?: string;
    readonly contentType?: string;
  },
): Promise<Response> {
  const headers = await buildMemberApiHeaders(host);
  const ingressHost = host.split(":")[0] ?? host;
  const url = new URL(`${resolveTourOpsApiBaseUrl()}${path}`);
  if (init?.query !== undefined) {
    for (const [key, value] of Object.entries(init.query)) {
      url.searchParams.set(key, value);
    }
  }

  const method = init?.method ?? "GET";
  const payload =
    init?.body === undefined
      ? undefined
      : init.contentType === undefined
        ? JSON.stringify(init.body)
        : init.body;

  const requestHeaders: Record<string, string> = {
    ...headers,
    host: ingressHost,
  };
  if (init?.idempotencyKey !== undefined && init.idempotencyKey.length > 0) {
    requestHeaders["Idempotency-Key"] = init.idempotencyKey;
  }
  if (payload !== undefined && typeof payload === "string") {
    requestHeaders["Content-Type"] = init?.contentType ?? "application/json";
  }
  if (payload !== undefined && init?.contentType !== undefined && init.contentType !== "application/json") {
    requestHeaders["Content-Type"] = init.contentType;
  }

  return fetch(url, {
    method,
    headers: requestHeaders,
    ...(payload !== undefined ? { body: payload as BodyInit } : {}),
    cache: "no-store",
  });
}

export function readIdempotencyKey(req: Request): string | undefined {
  const key =
    req.headers.get("idempotency-key")?.trim() ?? req.headers.get("Idempotency-Key")?.trim();
  return key !== undefined && key.length > 0 ? key : undefined;
}

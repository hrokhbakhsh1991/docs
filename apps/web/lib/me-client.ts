/**
 * Browser client for `/api/me` BFF relay (profiles in Settings).
 * Centralizes concurrency headers (`If-Match`) and optional `Idempotency-Key`.
 */

export async function fetchMe(init?: Omit<RequestInit, "credentials" | "cache">): Promise<Response> {
  return fetch("/api/me", {
    credentials: "include",
    cache: "no-store",
    ...init,
  });
}

export async function patchMe(
  jsonBody: Record<string, unknown>,
  init?: Omit<RequestInit, "credentials" | "cache" | "method" | "body"> & {
    /** Same value returned as weak `ETag` from `fetchMe()`, e.g. `W/"3"`. */
    ifMatch?: string;
    /** Optional idempotency (forwarded verbatim to Nest). */
    idempotencyKey?: string;
  }
): Promise<Response> {
  const { ifMatch, idempotencyKey, headers: hdrs, ...rest } = init ?? {};
  const headers = new Headers(hdrs ?? undefined);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const m = typeof ifMatch === "string" ? ifMatch.trim() : "";
  if (m !== "") {
    headers.set("If-Match", m);
  }
  const k = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  if (k !== "") {
    headers.set("Idempotency-Key", k);
  }
  return fetch("/api/me", {
    ...rest,
    method: "PATCH",
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(jsonBody),
    headers,
  });
}

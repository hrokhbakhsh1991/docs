import { TenantContextMissingError } from "../errors/tenant-context-missing.error";
import { requestContextStorage } from "../request-context/request-context";

/**
 * Request tracing (vendor-neutral)
 *
 * - **Correlation:** `correlation_id` in logs aligns with `x-correlation-id` when clients send it;
 *   otherwise it matches `request_id` / `x-request-id`. No single-vendor trace header is required.
 * - **Structured logs:** `RequestContextService.tryGetStructuredLogContext` merges
 *   `tenant_id`, `user_id`, `correlation_id`, `request_id` when the AsyncLocalStorage store exists.
 *
 * TODO (telemetry roadmap — avoid product-specific SDKs in call sites):
 * - **OpenTelemetry:** broaden semantic conventions beyond traces (logs/metrics correlation).
 * - **Distributed tracing:** W3C `traceparent` propagation across internal HTTP + async jobs.
 * - **Metrics dashboard:** RED/USE dashboards from OTLP or Prometheus text; SLO burn alerts.
 */

/** Keys callers must not override via {@link attachCorrelationMetadata} (PII / cardinality / secrets). */
const RESERVED_CORRELATION_METADATA_KEYS = new Set(
  [
    "request_id",
    "correlation_id",
    "tenant_id",
    "user_id",
    "trace_id",
    "span_id",
    "role",
    "method",
    "route",
    "client_ip",
    "authorization",
    "cookie",
    "set-cookie",
    "access_token",
    "refresh_token",
    "id_token",
    "password",
    "secret",
    "api_key"
  ].map((k) => k.toLowerCase())
);

/**
 * Strips reserved / high-risk keys before merging into ALS-backed log context.
 * Callers must still avoid putting **tokens**, **medical / PHI fields**, or **raw secrets** in values —
 * prefer opaque ids; see {@link LoggerService} for redaction guidance.
 */
export function sanitizeCorrelationMetadata(meta: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(meta)) {
    const key = rawKey.trim();
    if (key === "" || RESERVED_CORRELATION_METADATA_KEYS.has(key.toLowerCase())) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Merges low-cardinality string metadata into the active request context for downstream Pino lines.
 * No-op when ALS has no store (e.g. script without bootstrap).
 *
 * **Never attach:** bearer tokens, refresh tokens, OTP codes, webhook signing secrets, KMS plaintext,
 * or medical free-text — use opaque references only.
 */
export function attachCorrelationMetadata(meta: Record<string, string>): void {
  const store = requestContextStorage.getStore();
  if (!store) {
    return;
  }
  const safe = sanitizeCorrelationMetadata(meta);
  store.attachedLogFields = { ...(store.attachedLogFields ?? {}), ...safe };
}

/** Returns the active correlation id when inside HTTP/worker ALS; otherwise `undefined`. */
export function tryGetCorrelationId(): string | undefined {
  const store = requestContextStorage.getStore();
  const fromHeader = store?.correlationId?.trim();
  if (fromHeader && fromHeader !== "") {
    return fromHeader;
  }
  const fallback = store?.requestId?.trim();
  return fallback && fallback !== "" ? fallback : undefined;
}

/**
 * Correlation id for the current async context (see {@link RequestContextMiddleware}).
 * @throws TenantContextMissingError when outside ALS or before `requestId` is set.
 */
export function getCorrelationId(): string {
  const id = tryGetCorrelationId();
  if (!id) {
    throw new TenantContextMissingError("Correlation id is not available outside request context");
  }
  return id;
}

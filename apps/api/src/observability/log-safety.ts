import { createHmac } from "node:crypto";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import {
  HTTP_IDEMPOTENCY_TENANT_MISMATCH,
  IDEMPOTENCY_IN_PROGRESS,
  IDEMPOTENCY_PAYLOAD_MISMATCH,
} from "../http/http-idempotency";

export const LOG_HASH_KEY_REQUIRED = "LOG_HASH_KEY_REQUIRED";
export const PROJECTION_HANDLER_FAILED = "PROJECTION_HANDLER_FAILED";
export const INTERNAL_ERROR = "INTERNAL_ERROR";
export const OUTBOX_RELAY_TICK_FAILED = "OUTBOX_RELAY_TICK_FAILED";

const UUID_PATH_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UUID_INLINE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const RELIABILITY_SENSITIVE_KEY = /tenant|tour|user|actor|correlation|uuid/i;

/** LOG-COL-08 / DEC-042 — strip query and redact UUID segments before access logs. */
export function normalizeHttpLogPath(rawPath: string): string {
  const withoutQuery = rawPath.split("?")[0]?.split("#")[0] ?? "/";
  const segments = withoutQuery.split("/").map((segment) => {
    if (segment.length === 0) {
      return segment;
    }
    if (UUID_PATH_SEGMENT.test(segment)) {
      return ":id";
    }
    return segment;
  });
  const normalized = segments.join("/");
  return normalized.length > 0 ? normalized : "/";
}

/** H-03 / DEC-128 — strip tenant/tour identifiers from reliability profile samples. */
export function sanitizeReliabilitySamplePayload(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(UUID_INLINE, ":uuid");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeReliabilitySamplePayload(entry));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (RELIABILITY_SENSITIVE_KEY.test(key)) {
        continue;
      }
      out[key] = sanitizeReliabilitySamplePayload(entry);
    }
    return out;
  }
  return value;
}

function readLogHashKey(): string {
  const fromEnv = process.env.LOG_HASH_KEY?.trim() ?? process.env.AUDIT_PSEUDONYM_KEY?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "test") {
    return "test-log-hash-key";
  }
  if (isProductionAuthMode()) {
    throw new Error(LOG_HASH_KEY_REQUIRED);
  }
  return "dev-log-hash-key";
}

/** HMAC pseudonym for tenant id on shared log streams — LOG-COL-01/02 / DEC-037. */
export function hashTenantIdForLog(tenantId: string | undefined): string | undefined {
  if (tenantId === undefined) {
    return undefined;
  }
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  return createHmac("sha256", readLogHashKey()).update(normalized).digest("hex");
}

function resolveErrorCodeFromMessage(message: string): string {
  if (message.startsWith("UNAUTHORIZED_")) return message.split(/\s/)[0] ?? message;
  if (message.startsWith("FORBIDDEN_")) return message.split(/\s/)[0] ?? message;
  if (message.startsWith("INVALID_TENANT_AUTH_CONTEXT")) return message.split(/\s/)[0] ?? message;
  if (message.startsWith("ZOD_VALIDATION_FAILED")) return message.split(/\s/)[0] ?? message;
  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) return message.split(/\s/)[0] ?? message;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_BOUND")) return message;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_FOUND")) return message;
  if (message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) return message;
  if (message.startsWith("TOUR_VERSION_CONFLICT")) return message;
  if (message.startsWith("TOUR_NOT_FOUND")) return message;
  if (
    message === "WORKSPACE_TYPE_UNRESOLVED" ||
    message.startsWith("WORKSPACE_TYPE_UNRESOLVED:")
  ) {
    return "WORKSPACE_TYPE_UNRESOLVED";
  }
  if (
    message === "FINANCE_WORKSPACE_UNSUPPORTED" ||
    message.startsWith("FINANCE_WORKSPACE_UNSUPPORTED:")
  ) {
    return "FINANCE_WORKSPACE_UNSUPPORTED";
  }
  if (message.startsWith("TOUR_CAPACITY_EXCEEDED")) return message;
  if (message.startsWith("DUAL_WRITE_FORBIDDEN")) return message;
  if (message.startsWith("DB_POOL_SATURATED")) return message;
  if (message.startsWith("RATE_LIMIT_EXCEEDED")) return message;
  if (message === IDEMPOTENCY_PAYLOAD_MISMATCH || message === IDEMPOTENCY_IN_PROGRESS) {
    return message;
  }
  if (message === HTTP_IDEMPOTENCY_TENANT_MISMATCH) {
    return message;
  }
  if (message.startsWith("TENANT_CONTEXT_")) return message.split(/\s/)[0] ?? message;
  if (message.startsWith("CANONICAL_")) return message.split(/\s/)[0] ?? message;
  return INTERNAL_ERROR;
}

/** Stable error_code for shared-stream 500 logs — never raw Error.message. */
export function resolveInternalErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return resolveErrorCodeFromMessage(message.trim().length > 0 ? message : "unknown_error");
}

/** Stable error_code for outbox relay tick failures — LOG-COL-09 / DEC-042. */
export function resolveOutboxRelayErrorCode(error: unknown): string {
  const code = resolveInternalErrorCode(error);
  return code === INTERNAL_ERROR ? OUTBOX_RELAY_TICK_FAILED : code;
}

/** Stable reason_code for projection handler failures on shared log stream. */
export function resolveProjectionReasonCode(_error: unknown): string {
  return PROJECTION_HANDLER_FAILED;
}

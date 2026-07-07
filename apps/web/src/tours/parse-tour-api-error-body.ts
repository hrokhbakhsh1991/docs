export type ParsedTourApiErrorBody = {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
};

/** Parse Tour Ops API error JSON into stable code + operator-safe message. */
export function parseTourApiErrorBody(body: unknown): ParsedTourApiErrorBody {
  if (body === null || typeof body !== "object") {
    return { code: "unknown_error", message: "unknown_error" };
  }

  const record = body as Record<string, unknown>;
  const errorField = record.error;
  const messageField = record.message;
  const correlationId =
    typeof record.correlationId === "string" && record.correlationId.trim().length > 0
      ? record.correlationId.trim()
      : undefined;

  let message = "unknown_error";
  if (typeof errorField === "string" && errorField.trim().length > 0) {
    message = errorField.trim();
  } else if (typeof messageField === "string" && messageField.trim().length > 0) {
    message = messageField.trim();
  }

  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return { code: record.code.trim(), message, correlationId };
  }

  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) {
    return { code: "CANONICAL_VALIDATION_FAILED", message, correlationId };
  }

  const prefix = message.split(":")[0]?.trim();
  if (prefix != null && prefix.length > 0 && /^[A-Z0-9_]+$/.test(prefix)) {
    return { code: prefix, message, correlationId };
  }

  return { code: "unknown_error", message, correlationId };
}

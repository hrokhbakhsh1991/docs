/** Parse Tour Ops API error JSON into stable code + operator-safe message. */
export function parseTourApiErrorBody(body: unknown): { readonly code: string; readonly message: string } {
  if (body === null || typeof body !== "object") {
    return { code: "unknown_error", message: "unknown_error" };
  }

  const record = body as Record<string, unknown>;
  const errorField = record.error;
  const messageField = record.message;

  let message = "unknown_error";
  if (typeof errorField === "string" && errorField.trim().length > 0) {
    message = errorField.trim();
  } else if (typeof messageField === "string" && messageField.trim().length > 0) {
    message = messageField.trim();
  }

  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return { code: record.code.trim(), message };
  }

  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) {
    return { code: "CANONICAL_VALIDATION_FAILED", message };
  }

  const prefix = message.split(":")[0]?.trim();
  if (prefix != null && prefix.length > 0 && /^[A-Z0-9_]+$/.test(prefix)) {
    return { code: prefix, message };
  }

  return { code: "unknown_error", message };
}

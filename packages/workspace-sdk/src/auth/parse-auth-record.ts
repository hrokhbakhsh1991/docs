import type { AuthContextErrorCode } from "./auth-context-errors";
import { InvalidTenantAuthContextError } from "./auth-context-errors";

export type AuthRecordFieldSpec<T> = {
  readonly key: string;
  readonly required: boolean;
  readonly parse: (value: unknown, record: Record<string, unknown>) => T;
};

function authErr(code: AuthContextErrorCode, message: string): never {
  throw new InvalidTenantAuthContextError(code, message);
}

/**
 * Shared strict object parser for auth subjects (CT-06) — no Zod.
 */
export function parseAuthRecord<T>(
  input: unknown,
  label: string,
  fields: readonly AuthRecordFieldSpec<unknown>[],
  build: (parsed: Record<string, unknown>) => T,
): T {
  if (input === null || typeof input !== "object") {
    authErr("AUTH_CONTEXT_NOT_OBJECT", `${label} must be a plain object`);
  }
  const record = input as Record<string, unknown>;
  const parsed: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = record[field.key];
    if (raw === undefined) {
      if (field.required) {
        authErr("AUTH_CONTEXT_NOT_OBJECT", `${label} requires ${field.key}`);
      }
      continue;
    }
    parsed[field.key] = field.parse(raw, record);
  }

  return build(parsed);
}

export function requireNonEmptyAuthString(
  value: unknown,
  field: string,
  code: AuthContextErrorCode = "AUTH_CONTEXT_NOT_OBJECT",
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    authErr(code, `${field} must be a non-empty string`);
  }
  return value.trim();
}

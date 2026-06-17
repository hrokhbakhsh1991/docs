/** Phase 6 — generic structural tombstone checks (G-API-04). Zero workspace imports. */

export type EnvelopeTombstoneViolation =
  | "DELETED_ROOTS_NOT_ARRAY"
  | "TOMBSTONE_RESURRECTION";

export type EnvelopeTombstoneInvariantResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: EnvelopeTombstoneViolation;
      readonly keys?: readonly string[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEnvelopeShape(
  data: unknown
): data is { readonly form: { readonly data: Record<string, unknown> }; readonly meta: Record<string, unknown> } {
  if (!isRecord(data)) {
    return false;
  }
  const form = data.form;
  if (!isRecord(form) || !isRecord(form.data)) {
    return false;
  }
  const meta = data.meta;
  return isRecord(meta);
}

/**
 * Validates top-level tombstone structure only.
 * Non-envelope blobs pass through unchanged (opaque persist).
 */
export function assertEnvelopeTombstoneInvariants(data: unknown): EnvelopeTombstoneInvariantResult {
  if (!isEnvelopeShape(data)) {
    return { ok: true };
  }

  const deletedRootsRaw = data.meta.deletedRoots;
  if (deletedRootsRaw === undefined) {
    return { ok: true };
  }

  if (!Array.isArray(deletedRootsRaw)) {
    return { ok: false, code: "DELETED_ROOTS_NOT_ARRAY" };
  }

  const resurrected: string[] = [];
  for (const root of deletedRootsRaw) {
    if (typeof root !== "string") {
      return { ok: false, code: "DELETED_ROOTS_NOT_ARRAY" };
    }
    if (Object.prototype.hasOwnProperty.call(data.form.data, root)) {
      resurrected.push(root);
    }
  }

  if (resurrected.length > 0) {
    return { ok: false, code: "TOMBSTONE_RESURRECTION", keys: resurrected };
  }

  return { ok: true };
}

/** Namespaces that enforce envelope tombstone invariants on PATCH (Phase 6). */
export const ENVELOPE_TOMBSTONE_PATCH_NAMESPACES = Object.freeze(
  new Set<string>(["operator.wizard"])
);

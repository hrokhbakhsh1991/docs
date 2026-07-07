import type { WorkspaceDraftTombstoneBinding } from "@app-tour/workspace-sdk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEnvelopeShape(
  data: unknown,
): data is {
  readonly form: { readonly data: Record<string, unknown> };
  readonly meta: Record<string, unknown>;
} {
  if (!isRecord(data)) {
    return false;
  }
  const form = data.form;
  if (!isRecord(form) || !isRecord(form.data)) {
    return false;
  }
  return isRecord(data.meta);
}

function extractFormData(data: unknown): Record<string, unknown> {
  if (!isEnvelopeShape(data)) {
    return {};
  }
  return formDataClone(data.form.data);
}

function formDataClone(data: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(data) as Record<string, unknown>;
}

/**
 * Recompute envelope tombstones server-side before structural invariant check.
 * Client-sent deletedRoots is overwritten when plugin binding is present.
 */
export function reapplyServerEnvelopeTombstones(
  storedData: unknown,
  incomingData: unknown,
  binding: WorkspaceDraftTombstoneBinding | undefined,
): unknown {
  if (!isEnvelopeShape(incomingData)) {
    return incomingData;
  }

  const baselineForm = extractFormData(storedData);
  const incomingForm = incomingData.form.data;
  const incomingMeta = incomingData.meta;

  if (binding === undefined) {
    const { deletedRoots: _removed, ...metaRest } = incomingMeta;
    return {
      form: incomingData.form,
      meta: metaRest,
    };
  }

  const deletedRoots = binding.resolveTombstoneRoots(baselineForm, incomingForm);
  const meta: Record<string, unknown> = { ...incomingMeta };
  if (deletedRoots.length > 0) {
    meta.deletedRoots = deletedRoots;
  } else {
    delete meta.deletedRoots;
  }

  return {
    form: incomingData.form,
    meta,
  };
}

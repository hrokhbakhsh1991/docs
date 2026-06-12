export type CanonicalWizardDraftEnvelope = {
  readonly data: Readonly<Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read a string at a dot-separated canonical path (missing → ""). */
export function getCanonicalStringFromDraft(
  draft: CanonicalWizardDraftEnvelope,
  canonicalPath: string
): string {
  const value = getCanonicalValueFromDraft(draft, canonicalPath);
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

/** Read any JSON value at a dot-separated canonical path (missing → undefined). */
export function getCanonicalValueFromDraft(
  draft: CanonicalWizardDraftEnvelope,
  canonicalPath: string
): unknown {
  if (!canonicalPath) {
    return undefined;
  }

  const segments = canonicalPath.split(".");
  let current: unknown = draft.data;

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function cloneDraftData(data: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return structuredClone(data) as Record<string, unknown>;
}

/** Write a JSON value at a dot-separated canonical path (returns new envelope). */
export function setCanonicalValueOnDraft(
  draft: CanonicalWizardDraftEnvelope,
  canonicalPath: string,
  value: unknown
): CanonicalWizardDraftEnvelope {
  if (!canonicalPath) {
    return draft;
  }
  const data = cloneDraftData(draft.data);
  const segments = canonicalPath.split(".");
  let cursor: Record<string, unknown> = data;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const existing = cursor[segment];
    const branch = isRecord(existing) ? { ...existing } : {};
    cursor[segment] = branch;
    cursor = branch;
  }

  const leaf = segments[segments.length - 1]!;
  if (value === undefined) {
    delete cursor[leaf];
  } else {
    cursor[leaf] = value;
  }

  return { data };
}

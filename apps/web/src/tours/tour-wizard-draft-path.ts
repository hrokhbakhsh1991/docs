import type { TourWizardDraft } from "./tour-wizard-draft";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read a string at a dot-separated canonical path on the wizard draft (missing → ""). */
export function getCanonicalStringValue(draft: TourWizardDraft, canonicalPath: string): string {
  if (!canonicalPath) {
    return "";
  }

  const segments = canonicalPath.split(".");
  let current: unknown = draft.data;

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return "";
    }
    current = current[segment];
  }

  if (typeof current === "string") {
    return current;
  }
  if (current === undefined || current === null) {
    return "";
  }
  return String(current);
}

/** Read any JSON value at a dot-separated canonical path (missing → undefined). */
export function getCanonicalValue(draft: TourWizardDraft, canonicalPath: string): unknown {
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

/** Write any JSON value at a dot-separated canonical path; returns a new draft (immutable update). */
export function setCanonicalValue(
  draft: TourWizardDraft,
  canonicalPath: string,
  value: unknown,
): TourWizardDraft {
  if (!canonicalPath) {
    return draft;
  }

  const segments = canonicalPath.split(".");
  const data = { ...draft.data } as Record<string, unknown>;
  let cursor: Record<string, unknown> = data;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!;
    const existing = cursor[key];
    const branch = isRecord(existing) ? { ...existing } : {};
    cursor[key] = branch;
    cursor = branch;
  }

  const leafKey = segments[segments.length - 1]!;
  cursor[leafKey] = value;

  return { data: data as TourWizardDraft["data"] };
}

/** Write a string at a dot-separated canonical path; returns a new draft (immutable update). */
export function setCanonicalStringValue(
  draft: TourWizardDraft,
  canonicalPath: string,
  value: string,
): TourWizardDraft {
  return setCanonicalValue(draft, canonicalPath, value);
}

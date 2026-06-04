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

/** Write a string at a dot-separated canonical path; returns a new draft (immutable update). */
export function setCanonicalStringValue(
  draft: TourWizardDraft,
  canonicalPath: string,
  value: string,
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

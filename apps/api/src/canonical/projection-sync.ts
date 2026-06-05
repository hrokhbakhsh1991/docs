import type { CanonicalDocument } from "@app-tour/workspace-sdk";

export type TourProjectionFields = {
  readonly title: string | null;
  readonly schemaVersion: number;
};

/**
 * DEC-003 / RULE-008 — derived columns on `tours` (not a separate projection table).
 */
export function deriveTourProjections(canonical: CanonicalDocument): TourProjectionFields {
  const basics = canonical.data?.basics;
  const title =
    basics !== null &&
    typeof basics === "object" &&
    "title" in basics &&
    typeof (basics as { title?: unknown }).title === "string"
      ? (basics as { title: string }).title
      : null;

  return {
    title,
    schemaVersion: canonical.schemaVersion,
  };
}

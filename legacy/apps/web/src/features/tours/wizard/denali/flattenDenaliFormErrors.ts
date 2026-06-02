import type { FieldErrors } from "react-hook-form";

export type DenaliFlatFormError = { path: string; message: string };

/** Recursively flatten RHF errors (including `programNature.itinerary[n].activities`). */
export function flattenDenaliFormErrors(
  errors: FieldErrors | undefined,
  prefix = "",
): DenaliFlatFormError[] {
  if (errors == null || typeof errors !== "object") return [];

  const out: DenaliFlatFormError[] = [];
  for (const [key, value] of Object.entries(errors)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value == null) continue;

    if (typeof value === "object" && "message" in value && typeof value.message === "string") {
      out.push({ path, message: value.message });
      continue;
    }

    if (typeof value === "object") {
      out.push(...flattenDenaliFormErrors(value as FieldErrors, path));
    }
  }
  return out;
}

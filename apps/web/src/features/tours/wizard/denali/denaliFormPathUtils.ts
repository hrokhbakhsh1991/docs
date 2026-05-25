import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

/**
 * Reads a dot-separated path on the Denali wizard form (e.g. `tripDetails.logistics.gatheringPoints`).
 */
export function getDenaliFormPathValue(
  form: DenaliCreateTourWizardForm,
  formPath: string,
): unknown {
  const segments = formPath.split(".").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = form;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Writes a dot-separated path on the Denali wizard form.
 * Mutates `form` in place — use on cloned form state during normalize.
 * Creates plain object intermediates when missing; does not replace sibling branches.
 */
export function setDenaliFormPathValue(
  form: DenaliCreateTourWizardForm,
  formPath: string,
  value: unknown,
): void {
  const segments = formPath.split(".").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return;
  }

  let current: Record<string, unknown> = form as unknown as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]!;
    let child = current[key];
    if (child == null || typeof child !== "object" || Array.isArray(child)) {
      child = {};
      current[key] = child;
    }
    current = child as Record<string, unknown>;
  }
  current[segments[segments.length - 1]!] = value;
}

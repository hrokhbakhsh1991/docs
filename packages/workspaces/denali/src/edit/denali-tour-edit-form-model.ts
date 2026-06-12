import { denaliHydrateTourEditDraft } from "../clone/denali-tour-clone-hydration";

export type DenaliTourEditHydrateOptions = {
  readonly activeEquipmentIds?: readonly string[];
};

/**
 * Maps stored tour canonical `data` into wizard draft `data` for flat edit (Phase 12.4).
 * Preserves title, publishStatus, and photo refs — no clone suffix.
 */
export function canonicalToDenaliEditDraft(
  canonicalData: Readonly<Record<string, unknown>>,
  options?: DenaliTourEditHydrateOptions
): Record<string, unknown> {
  return denaliHydrateTourEditDraft(canonicalData as Record<string, unknown>, options).data;
}

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DenaliWizardCatalogSanitizeResult = {
  form: DenaliCreateTourWizardForm;
  clearedDestination: boolean;
  /** @deprecated Count of removed theme ids (any source). */
  clearedMainTheme: boolean;
  clearedThemeIds: number;
};

/**
 * Drops destination/theme UUIDs that are not in the active workspace catalog.
 * Prevents POST /tours 400 after DB migrations or stale local drafts.
 */
export function sanitizeDenaliWizardCatalogRefs(
  form: DenaliCreateTourWizardForm,
  input: {
    destinationIds: ReadonlySet<string>;
    themeIds: ReadonlySet<string>;
  },
): DenaliWizardCatalogSanitizeResult {
  const next: DenaliCreateTourWizardForm = {
    ...form,
    basicInfo: { ...form.basicInfo },
    programNature: { ...form.programNature },
  };

  let clearedDestination = false;
  let clearedThemeIds = 0;

  const destId = next.basicInfo.destinationId?.trim();
  if (destId && UUID_V4.test(destId) && !input.destinationIds.has(destId)) {
    next.basicInfo.destinationId = undefined;
    clearedDestination = true;
  }

  const rawIds = Array.isArray(next.programNature.themeIds)
    ? next.programNature.themeIds
    : [];
  const legacyMain = (next.programNature as { mainTourThemeId?: string }).mainTourThemeId?.trim();
  const legacySecondary = (next.programNature as { secondaryTourThemeIds?: string[] })
    .secondaryTourThemeIds;
  const merged = [
    ...rawIds,
    ...(legacyMain && UUID_V4.test(legacyMain) ? [legacyMain] : []),
    ...(Array.isArray(legacySecondary) ? legacySecondary : []),
  ]
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0 && UUID_V4.test(id));

  const kept = [...new Set(merged)].filter((id) => input.themeIds.has(id));
  clearedThemeIds = merged.length - kept.length;
  next.programNature.themeIds = kept;

  return {
    form: next,
    clearedDestination,
    clearedMainTheme: clearedThemeIds > 0,
    clearedThemeIds,
  };
}

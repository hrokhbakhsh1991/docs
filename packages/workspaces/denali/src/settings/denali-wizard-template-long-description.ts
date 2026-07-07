import { parseFieldRulesOverlay } from "../rules/templateOverlay";

export const DENALI_WIZARD_PHOTOS_STEP_ID = "denali_photos" as const;
export const DENALI_WIZARD_LONG_DESCRIPTION_PATH = "program.longDescription" as const;

/** Default: show full description on step 2 when overlay omits the path. */
export function isDenaliWizardTemplateLongDescriptionVisible(
  fieldRulesOverlay: Readonly<Record<string, unknown>> | undefined
): boolean {
  const patch = parseFieldRulesOverlay(fieldRulesOverlay).get(DENALI_WIZARD_LONG_DESCRIPTION_PATH);
  return patch?.visibility !== "hidden";
}

export function patchDenaliWizardTemplateLongDescriptionVisibility(
  fieldRulesOverlay: Readonly<Record<string, unknown>> | undefined,
  visible: boolean
): Readonly<Record<string, unknown>> {
  const next: Record<string, unknown> = { ...(fieldRulesOverlay ?? {}) };
  if (visible) {
    delete next[DENALI_WIZARD_LONG_DESCRIPTION_PATH];
    return next;
  }
  next[DENALI_WIZARD_LONG_DESCRIPTION_PATH] = { visibility: "hidden" };
  return next;
}

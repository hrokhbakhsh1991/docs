/** INV-WIZ-009 — template palette rows visible but not activatable until registration slice ships. */
export const WIZARD_PALETTE_ROADMAP_TAG = "wizard_palette_roadmap" as const;

export const DENALI_WIZARD_PALETTE_ROADMAP_CANONICAL_PATHS = Object.freeze([
  "participants.medicationsRequired",
  "participants.allergiesRequired",
  "participants.dietaryRequirementsRequired",
  "participants.medicalDeclarationRequired",
  "participants.emergencyContactRequired",
  "participants.physicalLimitationsRequired",
  "participants.evacuationInsuranceRequired",
  "policies.medicalFitnessDeclarationRequired",
] as const);

const ROADMAP_PATH_SET = new Set<string>(DENALI_WIZARD_PALETTE_ROADMAP_CANONICAL_PATHS);

export function isDenaliWizardPaletteRoadmapCanonicalPath(canonicalPath: string): boolean {
  return ROADMAP_PATH_SET.has(canonicalPath.trim());
}

export function isWizardPaletteRoadmapRegistryField(field: {
  readonly tags?: readonly string[];
}): boolean {
  return field.tags?.includes(WIZARD_PALETTE_ROADMAP_TAG) === true;
}

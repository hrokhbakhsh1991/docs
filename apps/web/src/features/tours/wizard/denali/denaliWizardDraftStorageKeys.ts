import { wizardDraftStorageKey } from "@/features/tours/wizard/tourWizardDraftEnvelope";

/** Denali-local draft namespace (template-scoped create, tour-scoped edit). */
export const DENALI_WIZARD_DRAFT_STORAGE_ROOT = "tour-create-wizard-draft-v1:denali" as const;

export function denaliWizardTemplateDraftStorageKey(templateId: string): string {
  const id = templateId.trim();
  if (!id) {
    throw new Error("denaliWizardTemplateDraftStorageKey requires a non-empty templateId");
  }
  return `${DENALI_WIZARD_DRAFT_STORAGE_ROOT}:template:${id}`;
}

export function denaliWizardTourEditDraftStorageKey(tourId: string): string {
  const id = tourId.trim();
  if (!id) {
    throw new Error("denaliWizardTourEditDraftStorageKey requires a non-empty tourId");
  }
  return `${DENALI_WIZARD_DRAFT_STORAGE_ROOT}:tour:${id}`;
}

/** Legacy workspace-scoped create draft key (pre-template scoping). */
export function denaliWizardLegacyWorkspaceDraftStorageKey(workspaceScope: string): string {
  return wizardDraftStorageKey(workspaceScope.trim());
}

export function isDenaliScopedDraftStorageKey(storageKey: string): boolean {
  return storageKey.includes(":denali:");
}

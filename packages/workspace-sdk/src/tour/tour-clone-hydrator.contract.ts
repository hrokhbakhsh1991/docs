/** Phase 11.6 — optional workspace hook for `?clone=tourId` wizard bootstrap (DEC-P11-007). */

/** Phase 13.7 — plugin-neutral clone photo remint plan entry (DEC-P13-009). */
export type WizardPhotoRemintPlanEntry = {
  readonly sourceStorageKey: string;
  readonly destStorageKey: string;
  readonly oldPhotoId: string;
  readonly newPhotoId: string;
  readonly contentType?: string;
};

/** @deprecated Use {@link WizardPhotoRemintPlanEntry}. */
export type DenaliPhotoRemintPlanEntry = WizardPhotoRemintPlanEntry;

export type TourCloneHydrationInput = {
  readonly canonicalData: Record<string, unknown>;
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
  /** Phase 11.13 — wizard duplicate: remint storage keys under this session. */
  readonly wizardSessionId?: string;
  readonly tenantId?: string;
};

export type TourCloneHydrationResult = {
  readonly data: Record<string, unknown>;
  readonly photoRemintPlan?: readonly WizardPhotoRemintPlanEntry[];
};

export type TourCloneHydrator = {
  readonly hydrateWizardDraft: (input: TourCloneHydrationInput) => TourCloneHydrationResult;
  /** Phase 11.12 — optional server `POST /tours/{id}/clone` body (stored canonical shape). */
  readonly prepareServerCloneCreateData?: (
    input: TourCloneHydrationInput
  ) => TourCloneHydrationResult;
};

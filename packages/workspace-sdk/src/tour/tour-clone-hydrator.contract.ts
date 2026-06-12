/** Phase 11.6 — optional workspace hook for `?clone=tourId` wizard bootstrap (DEC-P11-007). */

export type DenaliPhotoRemintPlanEntry = {
  readonly sourceStorageKey: string;
  readonly destStorageKey: string;
  readonly oldPhotoId: string;
  readonly newPhotoId: string;
  readonly contentType?: string;
};

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
  readonly photoRemintPlan?: readonly DenaliPhotoRemintPlanEntry[];
};

export type TourCloneHydrator = {
  readonly hydrateWizardDraft: (input: TourCloneHydrationInput) => TourCloneHydrationResult;
  /** Phase 11.12 — optional server `POST /tours/{id}/clone` body (stored canonical shape). */
  readonly prepareServerCloneCreateData?: (
    input: TourCloneHydrationInput
  ) => TourCloneHydrationResult;
};

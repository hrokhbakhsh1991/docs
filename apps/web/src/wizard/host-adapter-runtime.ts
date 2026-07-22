/**
 * Gap Closure B.20 — neutral shell entry for host-adapter warm/resolve/helpers.
 * Branded binder symbols stay inside *.generated.* (excluded from token ratchet).
 */
export {
  ensureWizardHostAdapters,
  resolveWizardCatalogPrefetchProvider,
  buildWizardFreshStartMeta,
  buildWizardStepZeroMeta,
  buildCreateTourDiscardRemoteDraftInput,
  CREATE_TOUR_SUPPORTS_CLONE,
  createTourRemoteDraftIdentity,
  prepareCreateTourFreshStartEnvelope,
  editTourRemoteDraftIdentity,
  buildFlatEditMetaLine,
  finalizeFlatEditTourLoad,
  mapFlatEditTourHttpStatus,
  localizeWizardValidationIssueMessage,
  readActiveThemeIds,
  localizeExposureCatalogFields,
  readActiveDestinationIds,
  readActiveEquipmentIds,
  resolveActiveCatalogIdsFromResourcePayloads,
  WIZARD_RULES_NOT_READY_CODE,
  type ExposureCatalogFieldForLocalization,
} from "@/bootstrap/workspace-host-adapters.generated";

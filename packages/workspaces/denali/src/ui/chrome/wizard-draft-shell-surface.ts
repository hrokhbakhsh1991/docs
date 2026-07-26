import {
  applyDenaliDefaultTourKind,
  buildDenaliCreatePrefilledForm,
  createDenaliDraftSchemaGate,
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliEditTourDraftKey,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  isDenaliFreshStartEnvelope,
  resolveDenaliDraftMerge,
} from "../../draft";
import { emptyDenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import { DENALI_WORKSPACE_PLUGIN_ID } from "../../denali-identity";
import { getDenaliWorkspacePlugin } from "../../denali.plugin";

export type DenaliWizardDraftShellSurface = {
  readonly pluginId: typeof DENALI_WORKSPACE_PLUGIN_ID;
  readonly getWorkspacePlugin: typeof getDenaliWorkspacePlugin;
  readonly createTourDraftKey: typeof DENALI_CREATE_TOUR_DRAFT_KEY;
  readonly editTourDraftKey: typeof denaliEditTourDraftKey;
  readonly operatorDraftNamespace: typeof DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE;
  readonly createWizardDraftSessionId: typeof createDenaliWizardDraftSessionId;
  readonly createDraftSchemaGate: typeof createDenaliDraftSchemaGate;
  readonly hydrateDraftEnvelope: typeof denaliHydrateDraftEnvelope;
  readonly prepareDraftEnvelope: typeof denaliPrepareDraftEnvelope;
  readonly isFreshStartEnvelope: typeof isDenaliFreshStartEnvelope;
  readonly resolveDraftMerge: typeof resolveDenaliDraftMerge;
  readonly emptyTourWizardDraft: typeof emptyDenaliTourWizardDraft;
  readonly applyDefaultTourKind: typeof applyDenaliDefaultTourKind;
  readonly buildCreatePrefilledFormCore: typeof buildDenaliCreatePrefilledForm;
  readonly buildCreatePrefilledForm: typeof buildDenaliCreatePrefilledForm;
};

export const denaliWizardDraftShellSurface: DenaliWizardDraftShellSurface = Object.freeze({
  pluginId: DENALI_WORKSPACE_PLUGIN_ID,
  getWorkspacePlugin: getDenaliWorkspacePlugin,
  createTourDraftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
  editTourDraftKey: denaliEditTourDraftKey,
  operatorDraftNamespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  createWizardDraftSessionId: createDenaliWizardDraftSessionId,
  createDraftSchemaGate: createDenaliDraftSchemaGate,
  hydrateDraftEnvelope: denaliHydrateDraftEnvelope,
  prepareDraftEnvelope: denaliPrepareDraftEnvelope,
  isFreshStartEnvelope: isDenaliFreshStartEnvelope,
  resolveDraftMerge: resolveDenaliDraftMerge,
  emptyTourWizardDraft: emptyDenaliTourWizardDraft,
  applyDefaultTourKind: applyDenaliDefaultTourKind,
  buildCreatePrefilledFormCore: buildDenaliCreatePrefilledForm,
  buildCreatePrefilledForm: buildDenaliCreatePrefilledForm,
});

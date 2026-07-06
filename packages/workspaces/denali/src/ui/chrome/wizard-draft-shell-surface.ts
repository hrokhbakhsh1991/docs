import {
  createDenaliDraftSchemaGate,
  createDenaliWizardDraftSessionId,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  isDenaliFreshStartEnvelope,
  resolveDenaliDraftMerge,
} from "../../draft";
import { emptyDenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import { getDenaliWorkspacePlugin } from "../../denali.plugin";
import { buildDenaliCreatePrefilledForm as buildDenaliCreatePrefilledFormCore } from "./draft-binding";
import { applyDenaliDefaultTourKind } from "../logic/denali-default-tour-kind";

export type DenaliWizardDraftShellSurface = {
  readonly getWorkspacePlugin: typeof getDenaliWorkspacePlugin;
  readonly createTourDraftKey: typeof DENALI_CREATE_TOUR_DRAFT_KEY;
  readonly operatorDraftNamespace: typeof DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE;
  readonly createWizardDraftSessionId: typeof createDenaliWizardDraftSessionId;
  readonly createDraftSchemaGate: typeof createDenaliDraftSchemaGate;
  readonly hydrateDraftEnvelope: typeof denaliHydrateDraftEnvelope;
  readonly prepareDraftEnvelope: typeof denaliPrepareDraftEnvelope;
  readonly isFreshStartEnvelope: typeof isDenaliFreshStartEnvelope;
  readonly resolveDraftMerge: typeof resolveDenaliDraftMerge;
  readonly emptyTourWizardDraft: typeof emptyDenaliTourWizardDraft;
  readonly applyDefaultTourKind: typeof applyDenaliDefaultTourKind;
  readonly buildCreatePrefilledFormCore: typeof buildDenaliCreatePrefilledFormCore;
};

export const denaliWizardDraftShellSurface: DenaliWizardDraftShellSurface = Object.freeze({
  getWorkspacePlugin: getDenaliWorkspacePlugin,
  createTourDraftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
  operatorDraftNamespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  createWizardDraftSessionId: createDenaliWizardDraftSessionId,
  createDraftSchemaGate: createDenaliDraftSchemaGate,
  hydrateDraftEnvelope: denaliHydrateDraftEnvelope,
  prepareDraftEnvelope: denaliPrepareDraftEnvelope,
  isFreshStartEnvelope: isDenaliFreshStartEnvelope,
  resolveDraftMerge: resolveDenaliDraftMerge,
  emptyTourWizardDraft: emptyDenaliTourWizardDraft,
  applyDefaultTourKind: applyDenaliDefaultTourKind,
  buildCreatePrefilledFormCore: buildDenaliCreatePrefilledFormCore,
});

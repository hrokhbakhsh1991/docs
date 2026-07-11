import { DraftEngine } from "@app-tour/draft-engine";
import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali/host/draft";

import { createWorkspaceDraftAdapter } from "../../src/draft/create-workspace-draft-adapter";
import { isDenaliFreshStartEnvelope, mergeDenaliWizardDraftEnvelope } from "@app-tour/workspace-denali/host/draft";
import { applyDenaliDefaultTourKind } from "@app-tour/workspace-denali/host/ui/logic/denali-default-tour-kind";
import { emptyTourWizardDraft } from "../../src/tours/tour-wizard-draft";

import { createMockWorkspaceDraftServer, createSlowPatchGate } from "./mock-workspace-draft-server";

export type DenaliWizardDraftEnvelope = ReturnType<typeof denaliPrepareDraftEnvelope>;

export const DENALI_WIZARD_DRAFT_TEST_IDS = {
  workspaceId: "ws-denali-dev",
  namespace: "operator.wizard",
  draftKey: "denali-create",
} as const;

/** Minimal template steps for step-inference contract tests. */
export const DENALI_WIZARD_TEMPLATE_STEPS = [
  {
    stepId: "denali_basic",
    label: "Basic",
    enabled: true,
    fields: [{ canonicalPath: "title" }, { canonicalPath: "category" }],
  },
  {
    stepId: "denali_program",
    label: "Program",
    enabled: true,
    fields: [{ canonicalPath: "program.difficultyLevel" }],
  },
  {
    stepId: "denali_logistics",
    label: "Logistics",
    enabled: true,
    fields: [{ canonicalPath: "transport.mode" }],
  },
] as const;

export function denaliStepFiveEnvelope(sessionId: string): DenaliWizardDraftEnvelope {
  return denaliPrepareDraftEnvelope(
    {
      data: {
        basics: { title: "تور نیمه‌کاره", featured: "false" },
        details: { summary: "saved", status: "draft" },
        title: "تور نیمه‌کاره",
        program: { difficultyLevel: 6 },
      },
    },
    { currentStepIndex: 4, wizardSessionId: sessionId }
  );
}

export function denaliFreshStartEnvelope(sessionId: string): DenaliWizardDraftEnvelope {
  return denaliPrepareDraftEnvelope(applyDenaliDefaultTourKind(emptyTourWizardDraft()), {
    currentStepIndex: 0,
    wizardSessionId: sessionId,
    freshStart: true,
  });
}

export function createDenaliWizardDraftTestEngine(options?: {
  readonly sessionId?: string;
  readonly slowPatchGate?: ReturnType<typeof createSlowPatchGate>;
  readonly withMerge?: boolean;
}) {
  const server = createMockWorkspaceDraftServer<DenaliWizardDraftEnvelope>({
    workspaceId: DENALI_WIZARD_DRAFT_TEST_IDS.workspaceId,
    namespace: DENALI_WIZARD_DRAFT_TEST_IDS.namespace,
    key: DENALI_WIZARD_DRAFT_TEST_IDS.draftKey,
    ...(options?.slowPatchGate != null ? { slowPatchGate: options.slowPatchGate } : {}),
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = server.fetchImpl;

  const adapter = createWorkspaceDraftAdapter<DenaliWizardDraftEnvelope>({
    workspaceId: DENALI_WIZARD_DRAFT_TEST_IDS.workspaceId,
    namespace: DENALI_WIZARD_DRAFT_TEST_IDS.namespace,
    draftKey: DENALI_WIZARD_DRAFT_TEST_IDS.draftKey,
    conflictStrategy: "REFETCH_REAPPLY",
    ...(options?.withMerge === true ? { merge: mergeDenaliWizardDraftEnvelope } : {}),
    shouldBypassServerVersionAdoption: isDenaliFreshStartEnvelope,
  });

  const engine = new DraftEngine<DenaliWizardDraftEnvelope>(adapter);

  return {
    engine,
    server,
    restoreFetch: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

export function createFreshDenaliWizardDraftAdapter() {
  return createWorkspaceDraftAdapter<DenaliWizardDraftEnvelope>({
    workspaceId: DENALI_WIZARD_DRAFT_TEST_IDS.workspaceId,
    namespace: DENALI_WIZARD_DRAFT_TEST_IDS.namespace,
    draftKey: DENALI_WIZARD_DRAFT_TEST_IDS.draftKey,
    conflictStrategy: "REFETCH_REAPPLY",
    shouldBypassServerVersionAdoption: isDenaliFreshStartEnvelope,
  });
}

export function createDenaliWizardDraftMergeAdapter() {
  return createWorkspaceDraftAdapter<DenaliWizardDraftEnvelope>({
    workspaceId: DENALI_WIZARD_DRAFT_TEST_IDS.workspaceId,
    namespace: DENALI_WIZARD_DRAFT_TEST_IDS.namespace,
    draftKey: DENALI_WIZARD_DRAFT_TEST_IDS.draftKey,
    conflictStrategy: "REFETCH_REAPPLY",
    merge: mergeDenaliWizardDraftEnvelope,
    shouldBypassServerVersionAdoption: isDenaliFreshStartEnvelope,
  });
}

export { createSlowPatchGate, journalMethodsAfter } from "./mock-workspace-draft-server";

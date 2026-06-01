import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliClonePresetFromTripDetails,
  cloneTripDetailsWithRemap,
  denaliDraftOrchestrator,
  DenaliTemplateOrchestratorFactory,
  listDenaliSettingsOverlayStoragePaths,
} from "@repo/denali-domain";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { resolveDenaliRuleSetFromTemplate } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import {
  buildDenaliSubmitPayloadProjection,
  mapDenaliCreateTourPayloadProjectionToDto,
} from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";
import { prepareDenaliSubmitArtifact } from "@/features/tours/wizard/domain/submit-orchestrator";
import { submitValidDenaliWizardDefaults } from "@/features/tours/testing/denaliSubmitTestHelpers";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { DENALI_WIZARD_RAIL_LAYOUT_VERSION } from "./sanitizeDenaliWizardDraftSnapshot";
import { sanitizeDenaliWizardDraftSnapshot } from "./sanitizeDenaliWizardDraftSnapshot";
import {
  collectSubmitCloneDivergences,
  formatParityDivergenceReport,
} from "./draft-submit-clone-parity.util";

const GHOST_GATHERING_KEY = "__ghostGatheringPointRowKey";

function buildCloneStyleCreateTourDto(input: {
  projection: ReturnType<typeof buildDenaliSubmitPayloadProjection>;
  clonedTripDetails: Record<string, unknown>;
  sourceTitle: string;
  sourceCapacity: number;
}): Record<string, unknown> {
  return {
    title: `${input.sourceTitle} (Copy)`,
    total_capacity: input.sourceCapacity,
    lifecycle_status: "Draft",
    description: input.projection.description,
    tourType: input.projection.tourType,
    destinationId: input.projection.destinationId,
    transportModes: input.projection.transportModes,
    autoAcceptRegistrations: input.projection.autoAcceptRegistrations,
    tripDetails: input.clonedTripDetails,
    ...(input.projection.customServiceLabels?.length
      ? { customServiceLabels: [...input.projection.customServiceLabels] }
      : {}),
  };
}

test("overlay RuleSet: adapter getRuleSet closure matches resolveDenaliRuleSetFromTemplate", () => {
  const template = {
    fieldRulesOverlay: { "basicInfo.tourType": { visible: true } },
    canonicalData: {},
  };
  const ruleSet = resolveDenaliRuleSetFromTemplate(template);
  let captured: typeof ruleSet | undefined;
  const getRuleSet = () => {
    captured = ruleSet;
    return ruleSet;
  };
  getRuleSet();
  assert.equal(captured, ruleSet);
  assert.notEqual(captured, denaliRuleSet);
});

test("draft-push path strips gatheringPoints row ghost keys (prepareDraftForSync + sanitize)", () => {
  const form = submitValidDenaliWizardDefaults();
  form.tripDetails = {
    ...form.tripDetails,
    logistics: {
      ...form.tripDetails.logistics,
      gatheringPoints: [
        {
          title: "Meet",
          time: "08:00",
          location: { addressText: "Station", latitude: 35.7, longitude: 51.4 },
          [GHOST_GATHERING_KEY]: "must not reach draft server",
        } as NonNullable<
          DenaliCreateTourWizardForm["tripDetails"]["logistics"]
        >["gatheringPoints"][number] & { [GHOST_GATHERING_KEY]: string },
      ],
    },
  };

  const prepared = denaliDraftOrchestrator.prepareDraftForSync(form, { currentStepIndex: 2 });
  const pushed = sanitizeDenaliWizardDraftSnapshot(
    {
      form: prepared.form,
      currentStepIndex: prepared.currentStepIndex,
      railLayoutVersion: prepared.railLayoutVersion,
    },
    denaliRuleSet,
  );

  const row = pushed.form.tripDetails.logistics?.gatheringPoints?.[0] as Record<string, unknown>;
  assert.equal(row?.title, "Meet");
  assert.equal(row?.[GHOST_GATHERING_KEY], undefined);
});

test("submit artifact and draft-sanitized form share core fields after same RuleSet", () => {
  const raw = submitValidDenaliWizardDefaults();
  const ruleSet = denaliRuleSet;

  const submitArtifact = prepareDenaliSubmitArtifact(raw, {
    ruleSet,
    catalog: { destinationIds: new Set(), themeIds: new Set() },
  });

  const prepared = denaliDraftOrchestrator.prepareDraftForSync(raw, { currentStepIndex: 0 });
  const draftForm = sanitizeDenaliWizardDraftSnapshot(
    {
      form: prepared.form,
      currentStepIndex: 0,
      railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
    },
    ruleSet,
  ).form;

  assert.equal(submitArtifact.basicInfo.title, draftForm.basicInfo.title);
  assert.equal(submitArtifact.basicInfo.tourType, draftForm.basicInfo.tourType);
});

test("parity proof: submit CreateTourDto vs clone-service DTO — divergences only on allowlisted paths", async () => {
  const raw = submitValidDenaliWizardDefaults();
  const ruleSet = denaliRuleSet;

  const submitArtifact = prepareDenaliSubmitArtifact(raw, {
    ruleSet,
    catalog: { destinationIds: new Set(), themeIds: new Set() },
  });
  const submitProjection = buildDenaliSubmitPayloadProjection(submitArtifact, {});
  const submitDto = mapDenaliCreateTourPayloadProjectionToDto(submitProjection) as Record<
    string,
    unknown
  >;

  const sourceTripDetails = submitProjection.tripDetails as Record<string, unknown> | undefined;
  assert.ok(sourceTripDetails);

  const cloneRemint = cloneTripDetailsWithRemap(sourceTripDetails);
  assert.ok(cloneRemint);

  const factory = new DenaliTemplateOrchestratorFactory();
  buildDenaliClonePresetFromTripDetails(
    cloneRemint.tripDetails as Record<string, unknown>,
    { storagePaths: listDenaliSettingsOverlayStoragePaths() },
  );
  const templateCanonical = {
    category: "mountain",
    duration: "single",
    title: String(submitProjection.title ?? submitArtifact.basicInfo.title ?? "Parity Tour"),
    program: {
      shortDescription: submitArtifact.programNature.shortDescription ?? "Parity short",
      themeIds: submitArtifact.programNature.themeIds ?? [],
    },
  };

  const orchestration = await factory.createDraftFromTemplate(
    {
      workspaceId: "tenant-parity",
      templateId: "tpl-parity",
      canonicalData: templateCanonical,
      fieldRulesOverlay: {},
    },
    { submitGradeProjection: true, defaultValues: submitArtifact },
  );

  assert.equal(
    orchestration.success,
    true,
    `orchestration failed: ${JSON.stringify(orchestration.errors ?? [])}`,
  );
  const cloneDto = buildCloneStyleCreateTourDto({
    projection: orchestration.payload,
    clonedTripDetails: cloneRemint.tripDetails as Record<string, unknown>,
    sourceTitle: String(submitProjection.title ?? "Tour"),
    sourceCapacity: 99,
  });

  const submitComparable = {
    ...submitDto,
    total_capacity: submitDto.capacity,
  };

  const divergences = collectSubmitCloneDivergences(submitComparable, cloneDto);

  assert.equal(
    divergences.length,
    0,
    `unexpected submit/clone DTO divergence outside allowlist:\n${formatParityDivergenceReport(divergences)}`,
  );

  assert.notEqual(cloneDto.title, submitDto.title);
  assert.match(String(cloneDto.title), /\(Copy\)$/);
  assert.notEqual(
    JSON.stringify(cloneDto.tripDetails),
    JSON.stringify(submitDto.tripDetails),
    "clone persists Safe-Remint trip_details, not submit projection tripDetails",
  );
  assert.notEqual(cloneDto.total_capacity, submitComparable.total_capacity);
});

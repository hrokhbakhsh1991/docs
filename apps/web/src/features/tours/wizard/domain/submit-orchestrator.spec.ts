import assert from "node:assert/strict";
import test from "node:test";

import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { submitValidDenaliWizardDefaults } from "@/features/tours/testing/denaliSubmitTestHelpers";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { DenaliProductionErrorCode } from "@/features/tours/wizard/errors/denali-production-errors";

import { FatalProjectionError } from "./buildDenaliCreateTourPayloadProjection";
import { prepareDenaliSubmitArtifact } from "./submit-orchestrator";

function buildDirtyForm(clean: DenaliCreateTourWizardForm): DenaliCreateTourWizardForm {
  const dirty = structuredClone(clean) as DenaliCreateTourWizardForm & Record<string, unknown>;
  dirty.__unregisteredWizardRoot = "smuggle";
  return dirty;
}

/** Simulates RHF `setValues` / `reset(merge)` smuggling a root key onto live form state. */
function simulateSetValuesRootGhost(
  base: DenaliCreateTourWizardForm,
  ghostKey: string,
  ghostValue: unknown,
): DenaliCreateTourWizardForm {
  return Object.assign(structuredClone(base), { [ghostKey]: ghostValue });
}

test("prepareDenaliSubmitArtifact throws FatalProjectionError on non-registry root keys", () => {
  const dirty = buildDirtyForm(submitValidDenaliWizardDefaults());
  assert.throws(
    () =>
      prepareDenaliSubmitArtifact(dirty, {
        ruleSet: denaliRuleSet,
        catalog: { destinationIds: new Set(), themeIds: new Set() },
      }),
    (error: unknown) => error instanceof FatalProjectionError,
  );
});

test("prepareDenaliSubmitArtifact throws before API egress when setValues injects root ghost", () => {
  const smuggled = simulateSetValuesRootGhost(
    submitValidDenaliWizardDefaults(),
    "__setValuesRootGhost",
    "workspace-a-smuggle",
  );

  assert.throws(
    () =>
      prepareDenaliSubmitArtifact(smuggled, {
        ruleSet: denaliRuleSet,
        workspaceId: "tenant-a",
        catalog: { destinationIds: new Set(["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"]), themeIds: new Set() },
      }),
    (error: unknown) => {
      if (!(error instanceof FatalProjectionError)) {
        return false;
      }
      assert.equal(error.code, DenaliProductionErrorCode.FATAL_PROJECTION_REGISTRY_ROOT);
      assert.deepEqual(error.offendingKeys, ["__setValuesRootGhost"]);
      return true;
    },
  );
});

test("workspace switch reset baseline drops workspace A field values and root ghosts", () => {
  const workspaceAForm = buildDenaliTourCreateDefaultValues();
  workspaceAForm.basicInfo.title = "Workspace A exclusive title";
  (workspaceAForm as DenaliCreateTourWizardForm & Record<string, unknown>).__workspaceMarker = "A";

  const afterReset = buildDenaliTourCreateDefaultValues();

  assert.notEqual(workspaceAForm.basicInfo.title, afterReset.basicInfo.title);
  assert.equal(afterReset.basicInfo.title, "");
  assert.equal(
    (afterReset as DenaliCreateTourWizardForm & Record<string, unknown>).__workspaceMarker,
    undefined,
  );
});

test("prepareDenaliSubmitArtifact returns registry-clean form for valid defaults", () => {
  const clean = submitValidDenaliWizardDefaults();
  const artifact = prepareDenaliSubmitArtifact(clean, {
    ruleSet: denaliRuleSet,
    catalog: { destinationIds: new Set(), themeIds: new Set() },
  });
  assert.equal((artifact as Record<string, unknown>).__unregisteredWizardRoot, undefined);
  assert.equal(typeof artifact.basicInfo.title, "string");
});

const TRIP_DETAILS_ARRAY_GHOST_KEY = "__ghostGatheringPointRowKey";

test("prepareDenaliSubmitArtifact strips ghost keys inside tripDetails.logistics.gatheringPoints rows", () => {
  const clean = submitValidDenaliWizardDefaults();
  const dirty = structuredClone(clean) as DenaliCreateTourWizardForm;
  dirty.tripDetails = {
    ...dirty.tripDetails,
    logistics: {
      ...dirty.tripDetails.logistics,
      gatheringPoints: [
        {
          title: "Smuggled row",
          time: "08:00",
          location: { addressText: "Station", latitude: 35.7, longitude: 51.4 },
          [TRIP_DETAILS_ARRAY_GHOST_KEY]: "must not reach submit artifact",
        } as NonNullable<
          DenaliCreateTourWizardForm["tripDetails"]["logistics"]
        >["gatheringPoints"][number] & { [TRIP_DETAILS_ARRAY_GHOST_KEY]: string },
      ],
    },
  };

  const artifact = prepareDenaliSubmitArtifact(dirty, {
    ruleSet: denaliRuleSet,
    catalog: { destinationIds: new Set(), themeIds: new Set() },
  });
  const rows = artifact.tripDetails.logistics?.gatheringPoints;
  assert.equal(rows?.length, 1);
  const row = rows![0] as Record<string, unknown>;
  assert.equal(row.title, "Smuggled row");
  assert.equal(row[TRIP_DETAILS_ARRAY_GHOST_KEY], undefined);
});

const STALE_DESTINATION_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

test("prepareDenaliSubmitArtifact clears destinationId absent from workspace catalog", () => {
  const clean = submitValidDenaliWizardDefaults();
  const dirty = structuredClone(clean) as DenaliCreateTourWizardForm;
  dirty.basicInfo.destinationId = STALE_DESTINATION_ID;

  const artifact = prepareDenaliSubmitArtifact(dirty, {
    ruleSet: denaliRuleSet,
    catalog: { destinationIds: new Set(), themeIds: new Set() },
  });

  assert.equal(artifact.basicInfo.destinationId, undefined);
});

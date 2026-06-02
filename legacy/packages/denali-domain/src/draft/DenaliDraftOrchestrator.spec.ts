import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import { DENALI_REGISTRY_LAYOUT_VERSION } from "./denaliRegistryLayout";
import { DenaliDraftOrchestrator } from "./DenaliDraftOrchestrator";
import { DENALI_WIZARD_RAIL_LAYOUT_VERSION } from "./denaliRailLayout";

test("prepareDraftForSync prunes unknown keys and attaches registry layout version", () => {
  const orchestrator = new DenaliDraftOrchestrator();
  const source = buildDenaliTourCreateDefaultValues();
  (source as unknown as Record<string, unknown>).ghostField = "stale";

  const prepared = orchestrator.prepareDraftForSync(source, { currentStepIndex: 2 });

  assert.equal(prepared.registryLayoutVersion, DENALI_REGISTRY_LAYOUT_VERSION);
  assert.equal(prepared.railLayoutVersion, DENALI_WIZARD_RAIL_LAYOUT_VERSION);
  assert.equal(prepared.currentStepIndex, 2);
  assert.equal(
    (prepared.form as unknown as Record<string, unknown>).ghostField,
    undefined,
  );
});

test("hydrateDraftFromSync discards when remote registry version is newer", () => {
  const warnings: string[] = [];
  const orchestrator = new DenaliDraftOrchestrator({
    registryLayoutVersion: 1,
    onWarning: (message) => warnings.push(message),
  });
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Remote future draft";

  const result = orchestrator.hydrateDraftFromSync({
    form,
    currentStepIndex: 3,
    registryLayoutVersion: 99,
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  });

  assert.equal(result.status, "discarded");
  assert.equal(result.snapshot.form.basicInfo.title, "");
  assert.equal(result.snapshot.currentStepIndex, 0);
  assert.ok(warnings.some((w) => w.includes("newer than client")));
});

test("hydrateDraftFromSync migrates older registry versions", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Legacy draft";

  const orchestrator = new DenaliDraftOrchestrator({ registryLayoutVersion: 2 });
  const result = orchestrator.hydrateDraftFromSync({
    form,
    currentStepIndex: 1,
    registryLayoutVersion: 1,
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  });

  assert.equal(result.status, "migrated");
  assert.equal(result.snapshot.form.basicInfo.title, "Legacy draft");
  assert.equal(result.snapshot.registryLayoutVersion, 2);
});

test("resetWizardToRegistryDefaults returns registry baseline", () => {
  const orchestrator = new DenaliDraftOrchestrator();
  const reset = orchestrator.resetWizardToRegistryDefaults();
  assert.equal(reset.basicInfo.title, "");
  assert.equal(reset.basicInfo.publishStatus, "draft");
});

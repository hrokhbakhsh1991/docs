import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWizardConfig,
  getWizardConfig,
  isDenaliWizardModeFromProfile,
  isDenaliWizardProfile,
} from "./workspace-wizard.config";

test("getWizardConfig resolves denali rail for denali_pilot and urban_event", () => {
  assert.equal(getWizardConfig("denali_pilot").wizardMode, "denali");
  assert.equal(getWizardConfig("urban_event").wizardMode, "denali");
  assert.ok(isDenaliWizardProfile("denali_pilot"));
  assert.ok(isDenaliWizardProfile("urban_event"));
});

test("getWizardConfig resolves classic rail for general and arctic nature_trip", () => {
  assert.equal(getWizardConfig("general").wizardMode, "classic");
  assert.equal(getWizardConfig("nature_trip").wizardMode, "classic");
  assert.equal(isDenaliWizardModeFromProfile("general"), false);
});

test("buildWizardConfig exposes descriptor inactive groups and workspace roots", () => {
  const denali = buildWizardConfig("denali_pilot");
  assert.ok(denali.roots.length > 0);
  assert.equal(denali.workspaceDefinitionVersion, 1);

  const urban = buildWizardConfig("urban_event");
  assert.equal(urban.wizardMode, "denali");
  assert.equal(urban.wizardMode, denali.wizardMode);
});

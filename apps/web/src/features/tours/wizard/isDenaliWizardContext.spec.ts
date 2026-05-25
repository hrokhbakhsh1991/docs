import assert from "node:assert/strict";
import test from "node:test";

import {
  isDenaliWizardContext,
  isDenaliWizardMode,
  resolveTourWizardMode,
} from "./isDenaliWizardContext";

test("isDenaliWizardMode", () => {
  assert.equal(isDenaliWizardMode("denali"), true);
  assert.equal(isDenaliWizardMode("classic"), false);
});

test("isDenaliWizardContext: template profile and explicit mode only", () => {
  assert.equal(isDenaliWizardContext({ wizardMode: "denali" }), true);
  assert.equal(
    isDenaliWizardContext({ wizardMode: "classic", formProfile: "denali_pilot", tenantSlug: "ws1-rbac" }),
    true,
  );
  assert.equal(
    isDenaliWizardContext({ wizardMode: "classic", formProfile: "urban_event" }),
    true,
  );
  assert.equal(isDenaliWizardContext({ wizardMode: "classic", tenantSlug: "denali" }), false);
  assert.equal(isDenaliWizardContext({ wizardMode: "classic", tenantSlug: "ws1-rbac" }), false);
  assert.equal(resolveTourWizardMode({ wizardMode: "classic", formProfile: "denali_pilot" }), "denali");
  assert.equal(resolveTourWizardMode({ wizardMode: "classic", formProfile: "urban_event" }), "denali");
});

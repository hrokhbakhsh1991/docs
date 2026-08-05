import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { loadDenaliWizardRulesModule } from "@app-tour/workspace-denali/host/wizard/host-hooks";
import { buildDenaliWizardRuleEvalContext } from "@app-tour/workspace-denali/host/wizard/submit";
import { validateDenaliWizardDraftSyncFromHostInput } from "@app-tour/workspace-denali/host/wizard/validation";

import { buildWizardStepValidationCallInput } from "../src/wizard/build-wizard-step-validation-call-input";

const here = dirname(fileURLToPath(import.meta.url));

describe("workspace-wizard-host step evalContext (INV-DENALI-WIZ-014)", () => {
  it("WEB-WIZ-014-01 buildWizardStepValidationCallInput forwards evalContext", () => {
    const evalContext = { uiOptions: { workspaceFormProfile: "denali_pilot" }, ruleSet: {} };
    const input = buildWizardStepValidationCallInput({
      plugin: { id: "denali" },
      draft: { data: {} },
      rulesModule: null,
      tenantId: "tenant",
      stepId: "denali_photos",
      visibleSteps: [],
      evalContext,
    });
    assert.equal(input.evalContext, evalContext);
    assert.equal(input.scope.stepId, "denali_photos");
  });

  it("WEB-WIZ-014-02 host Continue wiring uses helper + wizardRuleEvalContext", () => {
    const src = readFileSync(join(here, "../src/wizard/workspace-wizard-host.tsx"), "utf8");
    assert.match(src, /buildWizardStepValidationCallInput/);
    assert.match(
      src,
      /buildWizardStepValidationCallInput\(\{[\s\S]*?evalContext:\s*wizardRuleEvalContext/
    );
    assert.match(src, /wizardRuleEvalContext,/);
  });

  it("WEB-WIZ-014-03 host-shaped validate call honors overlay via evalContext", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        program: {
          themeIds: ["theme-1"],
          shortDescription: "",
        },
        photos: [],
      },
    };
    const visibleSteps = [
      {
        stepId: "denali_photos",
        fields: [
          {
            fieldId: "denali.program-content",
            canonicalPath: "program.themeIds",
            kind: "text" as const,
            required: true,
            hidden: false,
            stepId: "denali_photos",
          },
        ],
      },
    ];

    const without = validateDenaliWizardDraftSyncFromHostInput(
      buildWizardStepValidationCallInput({
        plugin,
        draft,
        rulesModule: rules,
        tenantId: "tenant",
        stepId: "denali_photos",
        visibleSteps,
        evalContext: undefined,
      })
    );
    assert.ok(
      without.violations.some(
        (v) =>
          v.code === "REQUIRED_FIELD_EMPTY" &&
          (v.fieldId === "program.shortDescription" ||
            v.fieldId?.includes("shortDescription") === true)
      ),
      without.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );

    const evalContext = buildDenaliWizardRuleEvalContext({
      fieldRulesOverlay: {
        "program.shortDescription": { visibility: "hidden" },
      },
    });
    const withOverlay = validateDenaliWizardDraftSyncFromHostInput(
      buildWizardStepValidationCallInput({
        plugin,
        draft,
        rulesModule: rules,
        tenantId: "tenant",
        stepId: "denali_photos",
        visibleSteps,
        evalContext,
      })
    );
    assert.equal(
      withOverlay.violations.some(
        (v) =>
          v.code === "REQUIRED_FIELD_EMPTY" &&
          (v.fieldId === "program.shortDescription" ||
            v.fieldId?.includes("shortDescription") === true)
      ),
      false,
      withOverlay.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });
});

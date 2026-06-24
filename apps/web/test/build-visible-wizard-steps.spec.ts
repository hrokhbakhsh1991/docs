import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  buildDenaliTenantWizardTemplatePayload,
  getDenaliWorkspacePlugin,
} from "@app-tour/workspace-denali";

import { appendWorkspaceReviewStepToRenderPlan } from "../src/tours/wizard-template-gate-logic";
import { buildVisibleWizardSteps } from "../src/wizard/build-visible-wizard-steps";

function stripWizardHost<T extends { wizardHost?: unknown }>(plugin: T): Omit<T, "wizardHost"> {
  const { wizardHost: _wizardHost, ...rest } = plugin;
  return rest;
}

describe("build-visible-wizard-steps.spec.ts", () => {
  it("WEB-REVIEW-01 appendWorkspaceReviewStepToRenderPlan injects publishStatus from engine plan", () => {
    const contentSteps = [
      {
        stepId: "denali_basic",
        fields: [{ canonicalPath: "title", fieldId: "title", kind: "text", required: true, hidden: false }],
      },
    ];
    const engineSteps = [
      ...contentSteps,
      {
        stepId: "review",
        fields: [
          {
            canonicalPath: "publishStatus",
            fieldId: "publishStatus",
            kind: "enum",
            required: false,
            hidden: false,
          },
        ],
      },
    ];

    const visible = appendWorkspaceReviewStepToRenderPlan(
      contentSteps,
      engineSteps,
      "review",
      "publishStatus"
    );
    assert.equal(visible.at(-1)?.stepId, "review");
    assert.equal(visible.at(-1)?.fields[0]?.canonicalPath, "publishStatus");
    assert.equal(visible.at(-1)?.fields[0]?.required, true);
  });

  it("WEB-REVIEW-02 tenant template without review gets review appended by host pipeline", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const engine = PlatformWizardEngine.create(stripWizardHost(plugin));
    engine.init();
    const basePlan = engine.buildRenderPlan({
      tenantId: "tenant",
      dimensions: { category: "mountain", duration: "single_day" },
    });
    const templateSteps = buildDenaliTenantWizardTemplatePayload().steps;
    assert.ok(!templateSteps.some((step) => step.stepId === "review"));

    const visible = buildVisibleWizardSteps({
      baseSteps: basePlan,
      templateSteps,
      draft: { data: { category: "mountain_day" } },
      rulesModule: null,
      wizardHost: plugin.wizardHost,
    });

    assert.equal(visible.at(-1)?.stepId, "review");
    assert.equal(visible.at(-1)?.fields[0]?.canonicalPath, "publishStatus");
    assert.ok(visible.some((step) => step.stepId === "denali_basic"));
  });
});

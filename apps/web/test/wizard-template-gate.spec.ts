/**
 * Phase 9.6 W-track — wizard template publish gate (empty /tours/new until published)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";

import {
  applyWizardTemplateToRenderPlan,
  buildDefaultPublishedWizardSteps,
  ensureWizardTemplatePublishablePayload,
  filterRenderPlanByCanonicalPaths,
  isWizardTemplatePublished,
  resolveWizardTemplateAllowedPaths,
  resolveWizardTemplateGateState,
  resolveInitialWorkspaceFormProfile,
  WIZARD_TEMPLATE_GATE_TEST_IDS,
} from "../src/tours/wizard-template-gate-logic";

describe("wizard-template-gate.spec.ts — W-track", () => {
  it("WEB-9.6-WIZ-01 exposes empty wizard gate test ids", () => {
    assert.equal(WIZARD_TEMPLATE_GATE_TEST_IDS.emptyState, "operator-wizard-template-empty-state");
    assert.equal(
      WIZARD_TEMPLATE_GATE_TEST_IDS.configureLink,
      "operator-wizard-template-configure-link"
    );
  });

  it("WEB-9.6-WIZ-02 unpublished template yields empty allowed paths", () => {
    const gate = resolveWizardTemplateGateState(
      {
        configKey: "wizard_template",
        configVersion: 1,
        source: "tenant",
        updatedAt: null,
        payload: { seedLabel: "SMK-P9-SEED", sections: [] },
      },
      "denali",
      getDenaliWorkspacePlugin()
    );
    assert.equal(gate.published, false);
    assert.equal(gate.allowedCanonicalPaths.length, 0);
    assert.equal(isWizardTemplatePublished({ seedLabel: "", sections: [] }), false);
  });

  it("WEB-9.6-WIZ-03 published denali template injects mandatory category field", () => {
    const steps = buildDefaultPublishedWizardSteps("denali", getDenaliWorkspacePlugin());
    assert.equal(steps[0]?.fields[0]?.canonicalPath, "title");

    const gate = resolveWizardTemplateGateState(
      {
        configKey: "wizard_template",
        configVersion: 1,
        source: "tenant",
        updatedAt: null,
        payload: { seedLabel: "", sections: [], published: true },
      },
      "denali",
      getDenaliWorkspacePlugin()
    );
    assert.equal(gate.published, true);
    assert.ok(gate.allowedCanonicalPaths.includes("category"));
    assert.ok(gate.allowedCanonicalPaths.includes("title"));
    assert.equal(gate.templateSteps[0]?.fields[0]?.canonicalPath, "category");
  });

  it("WEB-9.6-WIZ-04 filterRenderPlanByCanonicalPaths keeps only allowed fields", () => {
    const filtered = filterRenderPlanByCanonicalPaths(
      [
        {
          stepId: "denali_basic",
          fields: [
            { canonicalPath: "title", fieldId: "title", kind: "text" },
            { canonicalPath: "basicInfo.capacityMax", fieldId: "cap", kind: "text" },
          ],
        },
      ],
      ["title"]
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.fields.length, 1);
    assert.equal(filtered[0]?.fields[0]?.canonicalPath, "title");
  });

  it("WEB-9.6-WIZ-05 ensureWizardTemplatePublishablePayload injects steps when publishing", () => {
    const next = ensureWizardTemplatePublishablePayload(
      { seedLabel: "X", sections: [], published: true, steps: [] },
      "starter"
    );
    assert.equal(resolveWizardTemplateAllowedPaths(next).length, 1);
    assert.equal(next.steps?.[0]?.fields[0]?.canonicalPath, "basics.title");
  });

  it("WEB-9.6-WIZ-06 applyWizardTemplateToRenderPlan orders fields per template steps", () => {
    const enginePlan = [
      {
        stepId: "basics",
        fields: [
          { canonicalPath: "basics.title", fieldId: "basics.title", kind: "text", required: false },
          {
            canonicalPath: "basics.featured",
            fieldId: "basics.featured",
            kind: "boolean",
            required: false,
          },
        ],
      },
      {
        stepId: "details",
        fields: [
          {
            canonicalPath: "details.summary",
            fieldId: "details.summary",
            kind: "text",
            required: false,
          },
        ],
      },
    ];
    const templateSteps = [
      {
        stepId: "details",
        label: "Details",
        enabled: true,
        fields: [{ canonicalPath: "details.summary" }],
      },
      {
        stepId: "basics",
        label: "Basics",
        enabled: true,
        fields: [
          { canonicalPath: "basics.featured" },
          { canonicalPath: "basics.title" },
        ],
      },
    ];
    const ordered = applyWizardTemplateToRenderPlan(enginePlan, templateSteps);
    assert.equal(ordered.length, 2);
    assert.equal(ordered[0]?.stepId, "details");
    assert.equal(ordered[1]?.stepId, "basics");
    assert.deepEqual(
      ordered[1]?.fields.map((field) => field.canonicalPath),
      ["basics.featured", "basics.title"]
    );
  });

  it("WEB-9.6-WIZ-09 applyWizardTemplateToRenderPlan includes injected category", () => {
    const plugin = getDenaliWorkspacePlugin();
    const normalized = plugin.wizardHost?.normalizeWizardTemplateGate?.({
      templateSteps: [
        {
          stepId: "denali_basic",
          enabled: true,
          fields: [{ canonicalPath: "title", required: true }],
        },
      ],
      allowedCanonicalPaths: ["title"],
      workspaceFormProfile: "",
    });
    const templateSteps = normalized?.templateSteps ?? [];
    const plan = applyWizardTemplateToRenderPlan(
      [
        {
          stepId: "denali_basic",
          fields: [
            { canonicalPath: "category", fieldId: "denali.tour-kind-basics", kind: "enum" },
            { canonicalPath: "title", fieldId: "title", kind: "text" },
          ],
        },
      ],
      templateSteps
    );
    assert.equal(plan[0]?.fields[0]?.canonicalPath, "category");
  });

  it("P14-0b-08 resolveInitialWorkspaceFormProfile uses plugin hook default", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.equal(resolveInitialWorkspaceFormProfile(plugin), "denali_pilot");
    assert.equal(resolveInitialWorkspaceFormProfile(), "platform_default");
  });

  it("WEB-9.6-WIZ-08 applyWizardTemplateToRenderPlan keeps template-only review step", () => {
    const ordered = applyWizardTemplateToRenderPlan(
      [
        {
          stepId: "denali_basic",
          fields: [
            {
              canonicalPath: "publishStatus",
              fieldId: "publishStatus",
              kind: "enum",
              required: true,
            },
            { canonicalPath: "title", fieldId: "title", kind: "text", required: true },
          ],
        },
      ],
      [
        {
          stepId: "review",
          label: "Review",
          enabled: true,
          fields: [{ canonicalPath: "publishStatus", required: true }],
        },
      ]
    );
    assert.equal(ordered.length, 1);
    assert.equal(ordered[0]?.stepId, "review");
    assert.equal(ordered[0]?.fields[0]?.canonicalPath, "publishStatus");
    assert.equal(ordered[0]?.fields[0]?.required, true);
  });
});

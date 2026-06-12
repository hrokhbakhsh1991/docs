import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { validateDenaliWizardDraftSync } from "../src/wizard/denali-wizard-validation";

describe("denali-wizard-step-validation.spec.ts", () => {
  it("DN-WIZARD-STEP-01 composite-backed basic step validates after fill", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2026-07-01T08:00:00.000Z",
        capacityMax: "20",
        leaderUserIds: [],
        tripDetails: { overview: { peakHeight: "4000" } },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_basic")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_basic",
      visibleSteps: [{ stepId: "denali_basic", fields: stepFields }],
    });
    assert.equal(
      result.ok,
      true,
      result.violations.map((v) => `${v.fieldId}:${v.code}:${v.message}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-02 composite-backed photos step validates after fill", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2026-07-01T08:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        program: {
          themeIds: ["theme-1"],
          shortDescription: "خلاصه تور",
          difficultyLevel: 5,
          guideLanguageIds: [],
          itinerary: [],
        },
        photos: {
          photos: [{ id: "p1", url: "https://example.com/photo.jpg", sortOrder: 0 }],
        },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_photos")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_photos",
      visibleSteps: [{ stepId: "denali_photos", fields: stepFields }],
    });
    assert.equal(
      result.ok,
      true,
      result.violations.map((v) => `${v.fieldId}:${v.code}:${v.message}`).join("; ")
    );
  });
});

/**
 * Phase 11.7 — Denali wizard client validation
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { mapValidationResultToIssues } from "@app-tour/wizard-navigation";

import { loadDenaliWizardRulesModule } from "@app-tour/workspace-denali/host/wizard/host-hooks";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  buildDenaliFullWizardTemplateSteps,
  getDenaliWorkspacePlugin,
} from "@app-tour/workspace-denali";

import { applyWizardTemplateToRenderPlan } from "../src/tours/wizard-template-gate-logic";
import {
  buildFieldStepResolverFromTemplate,
  validateDenaliWizardDraftSync,
} from "@app-tour/workspace-denali/host/ui/chrome/wizard-validation";
import { groupValidationIssuesByStep } from "../src/wizard/group-validation-issues-by-step";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";

/** Relative future ISO — hardcoded calendar days go stale and trip DENALI_TOUR_START_BEFORE_TODAY. */
function futureTourStartIso(daysAhead = 14): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(8, 0, 0, 0);
  return date.toISOString();
}

function futureTourEndIso(startIso: string, daysAfterStart = 2): string {
  const date = new Date(startIso);
  date.setUTCDate(date.getUTCDate() + daysAfterStart);
  date.setUTCHours(18, 0, 0, 0);
  return date.toISOString();
}

function stripWizardHost(plugin: ReturnType<typeof getDenaliWorkspacePlugin>) {
  const {
    tourList: _a,
    tourClone: _b,
    publicCatalog: _c,
    wizardHost: _d,
    ...rest
  } = plugin;
  return rest;
}

describe("denali-wizard-validation.spec.ts — Phase 11.7", () => {
  it("WEB-P11-7-01 empty draft fails validateCanonical", () => {
    const plugin = getDenaliWorkspacePlugin();
    const result = validateDenaliWizardDraftSync(
      plugin,
      emptyTourWizardDraft(),
      null,
      "00000000-0000-4000-8000-000000000014"
    );
    assert.equal(result.ok, false);
    assert.ok(result.violations.length > 0);
  });

  it("WEB-P11-7-02 template resolver maps canonical path to step", () => {
    const resolveStepId = buildFieldStepResolverFromTemplate([
      {
        stepId: "denali_basic",
        enabled: true,
        fields: [{ canonicalPath: "title" }],
      },
      {
        stepId: "review",
        enabled: true,
        fields: [{ canonicalPath: "publishStatus" }],
      },
    ]);
    assert.equal(resolveStepId("title"), "denali_basic");
    assert.equal(resolveStepId("publishStatus"), "review");
    // INV-DENALI-WIZ-011 — dependents absent from template still resolve via registry.
    assert.equal(resolveStepId("program.shortDescription"), "denali_photos");
    assert.equal(resolveStepId("pricing.basePricePerPerson"), "denali_pricing");
    assert.equal(resolveStepId("participants.fitnessLevel"), "denali_pricing");
  });

  it("WEB-P11-7-04 filled denali_basic step passes per-step validation", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const draft = {
      data: {
        category: "mountain_day",
        title: "تور تست",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: futureTourStartIso(),
        capacityMax: "20",
        leaderUserIds: ["u1"],
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
    assert.equal(result.ok, true, result.violations.map((v) => `${v.fieldId}:${v.message}`).join("; "));
  });

  it("WEB-P11-7-05 legal step allows continue toward review with filled prior steps", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const engine = PlatformWizardEngine.create(stripWizardHost(plugin));
    engine.init();
    const basePlan = engine.buildRenderPlan({
      tenantId: "tenant",
      dimensions: { category: "mountain", duration: "single_day" },
    });
    const draft = {
      data: {
        category: "mountain_day",
        title: "تور تست",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: futureTourStartIso(),
        capacityMax: "20",
        tripDetails: {
          overview: { peakHeight: "4000" },
          logistics: { includedServices: [], excludedServices: [] },
        },
        program: {
          themeIds: ["theme-1"],
          shortDescription: "خلاصه",
          difficultyLevel: 5,
          guideLanguageIds: [],
          itinerary: [],
        },
        photos: {
          photos: [{ id: "p1", url: "https://example.com/photo.jpg", sortOrder: 0 }],
        },
        pricing: { requiresPayment: false },
        participants: { minimumAge: "18" },
      },
    };
    const steps = plugin.wizardHost!.applyContextualFieldRules!({
      steps: applyWizardTemplateToRenderPlan(basePlan, buildDenaliFullWizardTemplateSteps()),
      draft,
      rulesModule: rules,
      evalContext: null,
    }) as ReturnType<typeof applyWizardTemplateToRenderPlan>;
    assert.equal(steps.at(-1)?.stepId, "review");
    const legalStep = steps.find((step) => step.stepId === "denali_legal");
    assert.notEqual(legalStep, undefined);

    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: legalStep!.stepId,
      visibleSteps: steps,
    });
    assert.equal(
      result.ok,
      true,
      result.violations.map((v) => `${v.fieldId}:${v.code}:${v.message}`).join("; ")
    );
  });

  it("WEB-P11-7-06 pricing step allows continue when template fields are filled", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const engine = PlatformWizardEngine.create(stripWizardHost(plugin));
    engine.init();
    const basePlan = engine.buildRenderPlan({
      tenantId: "tenant",
      dimensions: { category: "mountain", duration: "single_day" },
    });
    const draft = {
      data: {
        category: "mountain_day",
        title: "تور تست",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: futureTourStartIso(),
        capacityMax: "20",
        tripDetails: {
          overview: { peakHeight: "4000" },
          logistics: { includedServices: [], excludedServices: [] },
        },
        program: {
          themeIds: ["theme-1"],
          shortDescription: "خلاصه",
          difficultyLevel: 5,
          guideLanguageIds: [],
          itinerary: [],
        },
        photos: {
          photos: [{ id: "p1", url: "https://example.com/photo.jpg", sortOrder: 0 }],
        },
        pricing: { requiresPayment: false },
        participants: { minimumAge: "18", fitnessLevel: "medium" },
      },
    };
    const steps = plugin.wizardHost!.applyContextualFieldRules!({
      steps: applyWizardTemplateToRenderPlan(basePlan, buildDenaliFullWizardTemplateSteps()),
      draft,
      rulesModule: rules,
      evalContext: null,
    }) as ReturnType<typeof applyWizardTemplateToRenderPlan>;
    const pricingStep = steps.find((step) => step.stepId === "denali_pricing");
    assert.notEqual(pricingStep, undefined);

    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: pricingStep!.stepId,
      visibleSteps: steps,
    });
    assert.equal(
      result.ok,
      true,
      result.violations.map((v) => `${v.fieldId}:${v.code}:${v.message}`).join("; ")
    );
  });

  it("WEB-P11-7-07 empty minimumAge blocks pricing step (MD-11)", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const engine = PlatformWizardEngine.create(stripWizardHost(plugin));
    engine.init();
    const basePlan = engine.buildRenderPlan({
      tenantId: "tenant",
      dimensions: { category: "mountain", duration: "multi_day" },
    });
    const startDateTime = futureTourStartIso();
    const draft = {
      data: {
        category: "mountain_multi",
        title: "تور چندروزه",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime,
        endDateTime: futureTourEndIso(startDateTime),
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        participants: { minimumAge: "" },
      },
    };
    const steps = plugin.wizardHost!.applyContextualFieldRules!({
      steps: applyWizardTemplateToRenderPlan(basePlan, buildDenaliFullWizardTemplateSteps()),
      draft,
      rulesModule: rules,
      evalContext: null,
    }) as ReturnType<typeof applyWizardTemplateToRenderPlan>;
    const pricingStep = steps.find((step) => step.stepId === "denali_pricing");
    assert.notEqual(pricingStep, undefined);
    assert.equal(
      pricingStep!.fields.some((field) => field.canonicalPath === "participants.minimumAge"),
      true
    );

    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: pricingStep!.stepId,
      visibleSteps: steps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.fieldId === "participants.minimumAge" ||
          violation.fieldId === "denali.pricing-participants"
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("WEB-P11-7-08 empty endDateTime blocks basic step for multi-day (MD-02)", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const engine = PlatformWizardEngine.create(stripWizardHost(plugin));
    engine.init();
    const basePlan = engine.buildRenderPlan({
      tenantId: "tenant",
      dimensions: { category: "mountain", duration: "multi_day" },
    });
    const draft = {
      data: {
        category: "mountain_multi",
        title: "تور چندروزه",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: futureTourStartIso(),
        endDateTime: "",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
      },
    };
    const steps = plugin.wizardHost!.applyContextualFieldRules!({
      steps: applyWizardTemplateToRenderPlan(basePlan, buildDenaliFullWizardTemplateSteps()),
      draft,
      rulesModule: rules,
      evalContext: null,
    }) as ReturnType<typeof applyWizardTemplateToRenderPlan>;
    const basicStep = steps.find((step) => step.stepId === "denali_basic");
    assert.notEqual(basicStep, undefined);
    assert.equal(
      basicStep!.fields.some((field) => field.canonicalPath === "endDateTime"),
      true
    );

    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: basicStep!.stepId,
      visibleSteps: steps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.fieldId === "endDateTime" || violation.fieldId === "denali.datetime-end"
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("WEB-P11-7-03 groupValidationIssuesByStep preserves template order", () => {
    const issues = mapValidationResultToIssues(
      {
        ok: false,
        violations: [
          { code: "REQUIRED", fieldId: "title", message: "Title required" },
          { code: "REQUIRED", fieldId: "publishStatus", message: "Publish required" },
        ],
      },
      {
        resolveStepId: (fieldId) =>
          fieldId === "title" ? "denali_basic" : fieldId === "publishStatus" ? "review" : undefined,
      }
    );
    const groups = groupValidationIssuesByStep(issues, [
      { stepId: "denali_basic", label: "Basic" },
      { stepId: "review", label: "Review" },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.stepId, "denali_basic");
    assert.equal(groups[1]?.stepId, "review");
  });
});

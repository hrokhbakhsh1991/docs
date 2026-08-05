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
        startDateTime: "2027-07-01T08:00:00.000Z",
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
        startDateTime: "2027-07-01T08:00:00.000Z",
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

  it("DN-WIZARD-STEP-03 photos step blocks empty shortDescription via composite expand", async () => {
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
          themeIds: [],
          shortDescription: "",
        },
        photos: { photos: [] },
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
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "program.shortDescription" ||
            violation.fieldId?.includes("shortDescription") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-04 program step blocks empty difficulty and hiking hours", async () => {
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
          shortDescription: "s",
          difficultyLevel: "",
          hikingHoursApprox: "",
        },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_program")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_program",
      visibleSteps: [{ stepId: "denali_program", fields: stepFields }],
    });
    assert.equal(result.ok, false);
    const codes = result.violations.map((v) => `${v.fieldId}:${v.code}`);
    assert.ok(
      codes.some((c) => c.includes("difficulty") && c.includes("REQUIRED_FIELD_EMPTY")),
      codes.join("; ")
    );
    assert.ok(
      codes.some((c) => c.includes("hikingHoursApprox") && c.includes("REQUIRED_FIELD_EMPTY")),
      codes.join("; ")
    );
  });

  it("DN-WIZARD-STEP-05 multi-day program blocks empty itinerary array", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const draft = {
      data: {
        category: "mountain_multi",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        endDateTime: "2027-07-03T18:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        program: {
          shortDescription: "s",
          difficultyLevel: "5",
          hikingHoursApprox: "6",
          itinerary: [],
        },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_program")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_program" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_program", fields: baseFields }],
      draft,
      rules
    );
    const itinerary = visibleSteps[0]?.fields.find((f) => f.canonicalPath === "program.itinerary");
    assert.equal(itinerary?.required, true);
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_program",
      visibleSteps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "program.itinerary" ||
            violation.fieldId === "denali.itinerary" ||
            violation.fieldId?.includes("itinerary") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-06 sanitize-scaffolded itinerary shells still block Continue", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const { buildDenaliWizardRuleEvalContext } = await import(
      "../src/wizard/denali-wizard-rule-eval-context.ts"
    );
    const draft = {
      data: {
        category: "mountain_multi",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        endDateTime: "2027-07-03T18:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        program: {
          shortDescription: "s",
          difficultyLevel: "5",
          hikingHoursApprox: "6",
          itinerary: [],
        },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_program")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_program" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_program", fields: baseFields }],
      draft,
      rules
    );
    const evalContext = buildDenaliWizardRuleEvalContext();
    const result = validateDenaliWizardDraftSync(
      plugin,
      draft,
      rules,
      "tenant",
      { stepId: "denali_program", visibleSteps },
      evalContext
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "program.itinerary" ||
            violation.fieldId === "denali.itinerary" ||
            violation.fieldId?.includes("itinerary") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-07 incomplete itinerary day titles block program step", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const draft = {
      data: {
        category: "mountain_multi",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        endDateTime: "2027-07-03T18:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        program: {
          shortDescription: "s",
          difficultyLevel: "5",
          hikingHoursApprox: "6",
          itinerary: [
            {
              dayNumber: 1,
              title: "",
              segments: [{ id: "s1", kind: "activity", title: "" }],
            },
            {
              dayNumber: 2,
              title: "روز دوم",
              segments: [{ id: "s2", kind: "activity", title: "صعود" }],
            },
          ],
        },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_program")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_program" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_program", fields: baseFields }],
      draft,
      rules
    );
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_program",
      visibleSteps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "program.itinerary" ||
            violation.fieldId === "denali.itinerary" ||
            violation.fieldId?.includes("itinerary") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-08 paid pricing blocks empty basePricePerPerson via contextual expand", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        pricing: {
          requiresPayment: true,
          basePricePerPerson: "",
        },
        participants: {
          minimumAge: "16",
          fitnessLevel: "medium",
        },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_pricing")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_pricing" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_pricing", fields: baseFields }],
      draft,
      rules
    );
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_pricing",
      visibleSteps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "pricing.basePricePerPerson" ||
            violation.fieldId?.includes("basePrice") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-09 pricing step blocks empty minimumAge", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        pricing: {
          requiresPayment: false,
        },
        participants: {
          minimumAge: "",
          fitnessLevel: "medium",
        },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_pricing")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_pricing" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_pricing", fields: baseFields }],
      draft,
      rules
    );
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_pricing",
      visibleSteps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "participants.minimumAge" ||
            violation.fieldId === "denali.pricing-participants" ||
            violation.fieldId?.includes("minimumAge") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-10 sanitize seeds fitnessLevel medium when visible and empty", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const { buildDenaliWizardRuleEvalContext } = await import(
      "../src/wizard/denali-wizard-rule-eval-context.ts"
    );
    const { sanitizeDenaliWizardDraftRecord } = await import(
      "../src/wizard/denali-wizard-draft-sanitize.ts"
    );
    const { getCanonicalStringFromDraft } = await import(
      "../src/wizard/canonical-draft-access.ts"
    );
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMax: "20",
        participants: {
          minimumAge: "16",
          fitnessLevel: "",
        },
      },
    };
    const sanitized = sanitizeDenaliWizardDraftRecord(
      draft,
      rules,
      buildDenaliWizardRuleEvalContext()
    );
    assert.equal(
      getCanonicalStringFromDraft(sanitized as { data?: Record<string, unknown> }, "participants.fitnessLevel"),
      "medium"
    );
  });

  it("DN-WIZARD-STEP-11 logistics transport.mode none is valid Continue", async () => {
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
        transport: { mode: "none" },
      },
    };
    const stepFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_logistics")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
      }));
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_logistics",
      visibleSteps: [{ stepId: "denali_logistics", fields: stepFields }],
    });
    assert.equal(
      result.ok,
      true,
      result.violations.map((v) => `${v.fieldId}:${v.code}:${v.message}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-12 expand re-apply honors overlay via evalContext", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { buildDenaliWizardRuleEvalContext } = await import(
      "../src/wizard/denali-wizard-rule-eval-context.ts"
    );
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
    // Anchor only — shortDescription is a composite dependent synthesized by expand.
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
    const withoutOverlay = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_photos",
      visibleSteps,
    });
    assert.ok(
      withoutOverlay.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "program.shortDescription" ||
            violation.fieldId?.includes("shortDescription") === true)
      ),
      withoutOverlay.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );

    const evalContext = buildDenaliWizardRuleEvalContext({
      fieldRulesOverlay: {
        "program.shortDescription": { visibility: "hidden" },
      },
    });
    const withOverlay = validateDenaliWizardDraftSync(
      plugin,
      draft,
      rules,
      "tenant",
      { stepId: "denali_photos", visibleSteps },
      evalContext
    );
    assert.equal(
      withOverlay.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "program.shortDescription" ||
            violation.fieldId?.includes("shortDescription") === true)
      ),
      false,
      withOverlay.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-13 logistics blocks empty dongAmount for shared_cars", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        transport: { mode: "shared_cars", dongAmount: "" },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_logistics")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_logistics" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_logistics", fields: baseFields }],
      draft,
      rules
    );
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_logistics",
      visibleSteps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "transport.dongAmount" ||
            violation.fieldId?.includes("dongAmount") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });

  it("DN-WIZARD-STEP-14 logistics blocks empty seatPreference for train", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const { applyDenaliConditionalFieldRules } = await import(
      "../src/wizard/apply-contextual-render-plan.ts"
    );
    const draft = {
      data: {
        category: "mountain_day",
        title: "Tour",
        destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        startDateTime: "2027-07-01T08:00:00.000Z",
        capacityMax: "20",
        tripDetails: { overview: { peakHeight: "4000" } },
        transport: { mode: "train", seatPreference: "" },
      },
    };
    const baseFields = plugin.fieldRegistry.fields
      .filter((field) => field.stepId === "denali_logistics")
      .map((field) => ({
        fieldId: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        required: field.required,
        hidden: false,
        stepId: "denali_logistics" as const,
      }));
    const visibleSteps = applyDenaliConditionalFieldRules(
      [{ stepId: "denali_logistics", fields: baseFields }],
      draft,
      rules
    );
    const result = validateDenaliWizardDraftSync(plugin, draft, rules, "tenant", {
      stepId: "denali_logistics",
      visibleSteps,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (violation) =>
          violation.code === "REQUIRED_FIELD_EMPTY" &&
          (violation.fieldId === "transport.seatPreference" ||
            violation.fieldId?.includes("seatPreference") === true)
      ),
      result.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });
});

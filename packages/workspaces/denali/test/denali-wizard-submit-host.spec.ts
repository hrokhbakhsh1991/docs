import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { tourWizardDraftToDenaliForm } from "../src/wizard/denali-wizard-form-adapter";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import {
  prepareDenaliTourCreatePayload,
  submitDenaliCreateTourViaWizardHost,
  submitDenaliCreateTourViaWizardHostWithCatalogLoader,
} from "../src/wizard/denali-wizard-submit-payload";
import { validateDenaliCreateTourSubmitSync } from "../src/wizard/denali-wizard-validation";

describe("denali-wizard-submit-host.spec.ts (P15-W-C1)", () => {
  it("submitDenaliCreateTourViaWizardHost throws when wizardHost hook missing", async () => {
    const plugin = { wizardHost: undefined } as unknown as WorkspacePlugin;
    const rulesModule = await loadDenaliWizardRulesModule();
    assert.throws(
      () =>
        submitDenaliCreateTourViaWizardHost({
          plugin,
          draft: { data: { title: "Test" } },
          rulesModule,
          evalContext: buildDenaliWizardRuleEvalContext(),
          catalog: {},
        }),
      /WIZARD_SUBMIT_NOT_CONFIGURED/
    );
  });

  it("submitDenaliCreateTourViaWizardHostWithCatalogLoader loads catalog then submits", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const evalContext = buildDenaliWizardRuleEvalContext();
    let catalogLoaded = false;

    const payload = await submitDenaliCreateTourViaWizardHostWithCatalogLoader({
      plugin,
      draft: {
        data: {
          title: "Alborz hike",
          category: "mountain_day",
          publishStatus: "draft",
        },
      },
      rulesModule: rules,
      evalContext,
      loadCatalog: async () => {
        catalogLoaded = true;
        return { activeThemeIds: ["t1"] };
      },
    });

    assert.equal(catalogLoaded, true);
    assert.equal((payload as CreateTourPayload).schemaVersion, 1);
    assert.equal((payload.data as Record<string, unknown>).title, "Alborz hike");
  });

  it("ED-GATHER-PERSIST-01 nested-only gathering promotes into create payload", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const station = {
      name: "میدان دربند",
      address: "دربند، تهران",
      isPrimary: true,
    };
    const draft = {
      data: {
        title: "صعود یک‌روزه توچال از دربند",
        category: "mountain_day",
        publishStatus: "draft",
        tripDetails: {
          logistics: {
            gatheringPoints: [station],
          },
        },
      },
    };
    const formBefore = tourWizardDraftToDenaliForm(draft, rules) as {
      tripDetails?: { logistics?: { gatheringPoints?: unknown[] } };
    };
    assert.equal((formBefore.tripDetails?.logistics?.gatheringPoints ?? []).length, 0);

    const evalContext = buildDenaliWizardRuleEvalContext({ draft, rulesModule: rules });
    const payload = prepareDenaliTourCreatePayload(draft, plugin, rules, evalContext);
    const points = payload.data.gatheringPoints as Array<Record<string, unknown>> | undefined;
    assert.equal(Array.isArray(points), true);
    assert.equal(points?.[0]?.name, "میدان دربند");
    assert.equal(points?.[0]?.address, "دربند، تهران");
  });
});

describe("denali-wizard-submit-validation.spec.ts (P15-W-C1)", () => {
  it("validateDenaliCreateTourSubmitSync requires eval context for active publish", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const result = validateDenaliCreateTourSubmitSync({
      plugin,
      draft: { data: { publishStatus: "active", title: "x", category: "mountain_day" } },
      rulesModule: rules,
      tenantId: "tenant",
      evalContext: undefined,
    });
    assert.equal(result.kind, "rules-not-ready");
  });

  it("validateDenaliCreateTourSubmitSync validates draft publishStatus without eval context", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const result = validateDenaliCreateTourSubmitSync({
      plugin,
      draft: { data: { publishStatus: "draft", title: "x", category: "mountain_day" } },
      rulesModule: rules,
      tenantId: "tenant",
      evalContext: undefined,
    });
    assert.equal(result.kind, "ok");
    assert.equal(typeof result.validation.ok, "boolean");
  });

  it("DEN-WIZ-SUBMIT-03 active publish sees composite shortDescription from draft", async () => {
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
          shortDescription: "توضیح کوتاه داریم اینجا",
          difficultyLevel: 5,
          hikingHoursApprox: 6,
          guideLanguageIds: [],
          itinerary: [],
        },
        photos: {
          photos: [{ id: "p1", url: "https://example.com/photo.jpg", sortOrder: 0 }],
        },
        transport: { mode: "private_car" },
        pricing: { requiresPayment: false },
        participants: { minimumAge: "18" },
        publishStatus: "active",
      },
    };
    const evalContext = buildDenaliWizardRuleEvalContext({ draft, rulesModule: rules });
    const form = tourWizardDraftToDenaliForm({ data: draft.data }, rules);
    assert.equal(
      (form as { programNature?: { shortDescription?: string } }).programNature?.shortDescription,
      "توضیح کوتاه داریم اینجا"
    );

    const result = validateDenaliCreateTourSubmitSync({
      plugin,
      draft,
      rulesModule: rules,
      tenantId: "tenant",
      evalContext,
    });
    assert.equal(result.kind, "ok");
    assert.equal(
      result.validation.violations.some((violation) => violation.fieldId === "program.shortDescription"),
      false,
      result.validation.violations.map((v) => `${v.fieldId}:${v.code}`).join("; ")
    );
  });
});

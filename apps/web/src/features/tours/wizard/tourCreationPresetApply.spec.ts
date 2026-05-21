import assert from "node:assert/strict";
import test from "node:test";

import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { parseWizardDraftRecord } from "@/features/tours/wizard/tourWizardDraftEnvelope";

import { applyClassicWizardPreset, applyTourCreationPreset } from "./tourCreationPresetApply";
import { loadWizardPrefill } from "./sources/loadWizardPrefill";

const emptyContract = {} as TenantTourFormContract;

const presetDefaults = {
  overview: {
    title: "Unified preset title",
    tourType: "mountain",
    mainTourThemeId: "33333333-3333-4333-8333-333333333333",
  },
  pricing: { basePrice: 1_500_000 },
};

test("banner and URL bootstrap share applyClassicWizardPreset pipeline", async () => {
  const baseValues = buildTourCreateFormDefaultValues();
  const profile = "mountain_outdoor" as const;
  const ctx = { matchTourType: "mountain", matchMainTourThemeId: null };

  const fromBanner = applyTourCreationPreset({
    resolvedFormProfile: profile,
    defaults: presetDefaults,
    baseValues,
    themeCatalog: [],
    ctx,
    tenantFormContract: emptyContract,
  });

  const fromUrl = await loadWizardPrefill(
    { kind: "preset", presetId: "preset-urban" },
    {
      tenantSlug: "urban-demo",
      tenantFormContract: emptyContract,
      fetchPreset: async () => ({
        defaults: presetDefaults,
        matchTourType: "mountain",
        matchMainTourThemeId: null,
      }),
      fetchThemes: async () => [],
      fetchWizardTemplate: async () => ({
        template: {
          baseProfile: profile,
          id: "t1",
          workspaceId: "w1",
          stepOverrides: { skip: [], insert: [] },
          fieldRulesOverlay: {},
          presetId: null,
          wizardContractVersion: 1,
          formProfileVersion: 1,
        },
      }),
    },
  );

  assert.ok(fromUrl);
  assert.equal(fromUrl.rail, "classic");
  const parsed = parseWizardDraftRecord(fromUrl.serializedDraft);
  assert.ok(parsed);

  const fromUrlMerged = applyClassicWizardPreset({
    workspaceFormProfile: profile,
    defaults: presetDefaults,
    ctx,
    baseValues,
    themeCatalog: [],
    tenantFormContract: emptyContract,
  });

  assert.deepEqual(fromBanner, fromUrlMerged);
  assert.deepEqual(parsed?.formPatch.overview, fromBanner.overview);
  assert.deepEqual(parsed?.formPatch.pricing, fromBanner.pricing);
  assert.equal(parsed?.formPatch.overview?.title, fromBanner.overview?.title);
  assert.equal(parsed?.formPatch.overview?.tourType, fromBanner.overview?.tourType);
  assert.equal(parsed?.formPatch.pricing?.basePrice, fromBanner.pricing?.basePrice);
});

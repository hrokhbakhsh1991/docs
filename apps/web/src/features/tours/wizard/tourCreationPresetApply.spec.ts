import assert from "node:assert/strict";
import test from "node:test";

import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { DENALI_ROOTS } from "@repo/shared-contracts";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { parseDenaliWizardDraftRecord } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { parseWizardDraftRecord } from "@/features/tours/wizard/tourWizardDraftEnvelope";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

import { applyClassicWizardPreset, applyDenaliWizardPreset, applyTourCreationPreset } from "./tourCreationPresetApply";
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

const denaliPresetCanonical = {
  category: "mountain" as const,
  duration: "single" as const,
  program: {
    shortDescription: "Denali preset short description",
    themeIds: ["33333333-3333-4333-8333-333333333333"],
  },
  transport: { mode: "organizer_vehicle" as const },
  pricing: {
    requiresPayment: true,
    basePricePerPerson: 500_000,
    paymentMode: "offline_receipt" as const,
  },
  participants: { minimumAge: 18 },
  policies: { policiesText: "لغو" },
};

/** Legacy roots must never be merged when canonicalData is authoritative. */
const denaliLegacyDefaults = {
  overview: { shortDescription: "legacy must drop" },
  pricing: { basePrice: 99 },
};

const LEGACY_ROOTS = new Set([
  "overview",
  "pricing",
  "schedule",
  "location",
  "itinerary",
  "participation",
  "logistics",
  "discount",
  "onlinePayment",
  "onlinePayments",
  "autoAcceptRegistrations",
]);

function assertOnlyDenaliRoots(patch: Record<string, unknown>): void {
  for (const key of Object.keys(patch)) {
    assert.ok(
      (DENALI_ROOTS as readonly string[]).includes(key),
      `unexpected root "${key}" in Denali preset patch`,
    );
  }
  for (const legacy of LEGACY_ROOTS) {
    assert.equal(patch[legacy], undefined, `legacy root "${legacy}" must not appear`);
  }
}

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

test("banner and URL bootstrap share applyDenaliWizardPreset pipeline", async () => {
  const baseValues = buildDenaliTourCreateDefaultValues();
  const profile = "denali_pilot" as const;
  const ctx = {
    matchTourType: "mountain",
    matchMainTourThemeId: "33333333-3333-4333-8333-333333333333",
  };

  const fromBanner = applyDenaliWizardPreset({
    workspaceFormProfile: profile,
    ruleSet: denaliRuleSet,
    canonicalData: denaliPresetCanonical,
    defaults: denaliLegacyDefaults,
    baseValues,
    ctx,
  });

  const fromUrl = await loadWizardPrefill(
    { kind: "preset", presetId: "preset-denali-mountain-day" },
    {
      tenantSlug: "denali",
      tenantFormContract: emptyContract,
      fetchPreset: async () => ({
        canonicalData: denaliPresetCanonical,
        defaults: {},
        matchTourType: "mountain",
        matchMainTourThemeId: "33333333-3333-4333-8333-333333333333",
      }),
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
  assert.equal(fromUrl.rail, "denali");
  const parsed = parseDenaliWizardDraftRecord(fromUrl.serializedDraft);
  assert.ok(parsed);

  const fromUrlMerged = applyDenaliWizardPreset({
    workspaceFormProfile: profile,
    ruleSet: denaliRuleSet,
    canonicalData: denaliPresetCanonical,
    ctx,
    baseValues,
  });

  assert.deepEqual(fromBanner.basicInfo?.tourType, fromUrlMerged.basicInfo?.tourType);
  assert.deepEqual(fromBanner.basicInfo?.title, fromUrlMerged.basicInfo?.title);
  assert.deepEqual(fromBanner.programNature?.shortDescription, fromUrlMerged.programNature?.shortDescription);
  assert.deepEqual(fromBanner.programNature?.themeIds, fromUrlMerged.programNature?.themeIds);
  assert.deepEqual(fromBanner.pricingPayment, fromUrlMerged.pricingPayment);
  assert.equal(fromBanner.basicInfo?.tourType, "mountain_day");
  assert.equal(fromBanner.programNature?.shortDescription, "Denali preset short description");
  assert.equal(parsed?.formPatch.basicInfo?.tourType, fromBanner.basicInfo?.tourType);
  assert.equal(parsed?.formPatch.programNature?.shortDescription, fromBanner.programNature?.shortDescription);

  assertOnlyDenaliRoots(fromBanner as unknown as Record<string, unknown>);
  assertOnlyDenaliRoots(parsed!.formPatch as unknown as Record<string, unknown>);
});

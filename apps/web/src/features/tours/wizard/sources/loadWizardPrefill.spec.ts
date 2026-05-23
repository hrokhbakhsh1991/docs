import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { parseDenaliWizardDraftRecord } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { parseWizardDraftRecord } from "@/features/tours/wizard/tourWizardDraftEnvelope";

import { loadWizardPrefill } from "./loadWizardPrefill";

const emptyContract = {} as TenantTourFormContract;

const denaliTemplate = async () => ({
  template: { baseProfile: "denali_pilot" as const, id: "t1", workspaceId: "w1" } as any,
} as any);

test("loadWizardPrefill: blank returns null", async () => {
  const result = await loadWizardPrefill(
    { kind: "blank" },
    { tenantSlug: "denali", tenantFormContract: emptyContract },
  );
  assert.equal(result, null);
});

test("loadWizardPrefill: preset denali writes 6-tab draft", async () => {
  const result = await loadWizardPrefill(
    { kind: "preset", presetId: "preset-1" },
    {
      tenantSlug: "denali",
      tenantFormContract: emptyContract,
      fetchPreset: async () => ({
        formProfile: "denali_pilot",
        defaults: {
          basicInfo: { tourType: "mountain_day", title: "preset title twelve" },
        },
        matchTourType: "mountain_day",
      }),
      fetchWizardTemplate: denaliTemplate,
    },
  );
  assert.ok(result);
  assert.equal(result.rail, "denali");
  const parsed = parseDenaliWizardDraftRecord(result.serializedDraft);
  assert.equal(parsed?.wizardMeta?.sourcePresetId, "preset-1");
  assert.equal(parsed?.wizardMeta?.resolvedFormProfile, "denali_pilot");
  assert.equal(parsed?.wizardMeta?.formProfileVersion, TOUR_FORM_PROFILE_VERSION);
  assert.match(parsed?.formPatch.basicInfo?.title ?? "", /preset title/);
});

test("loadWizardPrefill: clone denali merges tour title", async () => {
  const result = await loadWizardPrefill(
    { kind: "clone", cloneTourId: "tour-uuid" },
    {
      tenantSlug: "denali",
      tenantFormContract: emptyContract,
      fetchTour: async () => ({
        title: "cloned tour title here",
        tourType: "mountain",
        formProfileSnapshot: "denali_pilot",
        details: {
          tripDetails: {
            overview: { denaliTourKind: "mountain_day", shortIntro: "hi" },
            logistics: {
              departureDate: "2026-08-10",
              departureMeetingTime: "08:00",
              groupSizeMax: 10,
            },
          },
        },
      }),
      fetchWizardTemplate: denaliTemplate,
    },
  );
  assert.ok(result);
  assert.equal(result.rail, "denali");
  const parsed = parseDenaliWizardDraftRecord(result.serializedDraft);
  assert.equal(parsed?.wizardMeta?.sourceTourId, "tour-uuid");
  assert.equal(parsed?.formPatch.basicInfo?.title, "cloned tour title here");
  assert.ok(typeof parsed?.wizardMeta?.savedAt === "string");
});

test("loadWizardPrefill: clone denali carries 5-zone locations and itinerary geo in patch", async () => {
  const result = await loadWizardPrefill(
    { kind: "clone", cloneTourId: "tour-full" },
    {
      tenantSlug: "denali",
      tenantFormContract: emptyContract,
      fetchTour: async () => ({
        title: "Full clone tour title here",
        tourType: "mountain",
        details: {
          tripDetails: {
            overview: {
              denaliTourKind: "mountain_multi",
              gatheringPoint: { addressText: "Tehran", latitude: 35.7, longitude: 51.4 },
              startPoint: { addressText: "Rineh", latitude: 35.9, longitude: 52.1 },
              summitPoint: { addressText: "Peak", latitude: 35.95, longitude: 52.11 },
              campPoint: { addressText: "Camp", latitude: 35.92, longitude: 52.05 },
              endPoint: { addressText: "Return", latitude: 35.7, longitude: 51.4 },
              difficultyLevel: 7,
            },
            logistics: {
              departureDate: "2026-08-10",
              returnDate: "2026-08-12",
              departureMeetingTime: "08:00",
            },
            itinerary: {
              dayPlans: [
                {
                  day: 1,
                  title: "Stop",
                  description: "Walk",
                  location: { addressText: "Stop", latitude: 36, longitude: 52.2 },
                  photos: [
                    {
                      id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33",
                      url: "https://example.com/d1.jpg",
                      filename: "d1.jpg",
                      size: 100,
                      mimeType: "image/jpeg",
                      uploadedAt: "2026-06-01T00:00:00.000Z",
                    },
                  ],
                },
              ],
            },
            photos: [
              {
                id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
                url: "https://example.com/t.jpg",
                filename: "t.jpg",
                size: 200,
                mimeType: "image/jpeg",
                uploadedAt: "2026-06-01T00:00:00.000Z",
              },
            ],
          },
        },
      }),
      fetchWizardTemplate: denaliTemplate,
    },
  );
  assert.ok(result);
  const parsed = parseDenaliWizardDraftRecord(result!.serializedDraft);
  assert.equal(
    parsed?.formPatch.tripDetails?.logistics?.gatheringPoints?.[0]?.location?.latitude,
    35.7,
  );
  assert.equal(parsed?.formPatch.basicInfo?.summitPoint?.addressText, "Peak");
  assert.equal(parsed?.formPatch.programNature?.itinerary?.[0]?.location?.latitude, 36);
  assert.equal(parsed?.formPatch.programNature?.itinerary?.[0]?.photos?.length, 1);
  assert.equal(parsed?.formPatch.photosData?.photos?.length, 1);
});

test("loadWizardPrefill: preset classic uses mapWizardPrefill + applyTourWizardPatch pipeline", async () => {
  const result = await loadWizardPrefill(
    { kind: "preset", presetId: "preset-classic" },
    {
      tenantSlug: "urban-demo",
      tenantFormContract: emptyContract,
      fetchPreset: async () => ({
        defaults: {
          overview: { title: "Classic preset URL", tourType: "city" },
          pricing: { basePrice: 900_000 },
        },
        matchTourType: "city",
        matchMainTourThemeId: null,
      }),
      fetchThemes: async () => [],
      fetchWizardTemplate: async () => ({
        template: {
          baseProfile: "urban_event" as const,
          id: "t-urban",
          workspaceId: "w-urban",
          stepOverrides: { skip: [], insert: [] },
          fieldRulesOverlay: {},
          presetId: null,
          wizardContractVersion: 1,
          formProfileVersion: 1,
        },
      }),
    },
  );
  assert.ok(result);
  assert.equal(result.rail, "classic");
  const parsed = parseWizardDraftRecord(result.serializedDraft);
  assert.equal(parsed?.wizardMeta?.sourcePresetId, "preset-classic");
  assert.equal(parsed?.wizardMeta?.resolvedFormProfile, "urban_event");
  assert.equal(parsed?.formPatch.overview?.title, "Classic preset URL");
});

test("loadWizardPrefill: clone classic rail for non-denali tenant", async () => {
  const result = await loadWizardPrefill(
    { kind: "clone", cloneTourId: "tour-2" },
    {
      tenantSlug: "urban-demo",
      tenantFormContract: emptyContract,
      fetchTour: async () => ({
        title: "Urban clone",
        tourType: "mountain",
        details: {
          tripDetails: {
            overview: { tourType: "mountain", shortIntro: "s" },
            logistics: { departureDate: "2026-08-10", groupSizeMax: 8 },
          },
        },
      }),
      fetchThemes: async () => [],
      fetchWizardTemplate: async () => ({
        template: { baseProfile: "general" as const, id: "t2", workspaceId: "w2" } as any,
      } as any),
    },
  );
  assert.ok(result);
  assert.equal(result.rail, "classic");
  const parsed = parseWizardDraftRecord(result.serializedDraft);
  assert.equal(parsed?.wizardMeta?.sourceTourId, "tour-2");
});

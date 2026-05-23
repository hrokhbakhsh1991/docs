import assert from "node:assert/strict";
import test from "node:test";

import { DENALI_ROOTS } from "@repo/shared-contracts";

import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";

import { mapToDenaliWizardPatch } from "./mapToDenaliWizardPatch";

const THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const DEST_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function cloneFixture(): TourCloneSourceDto {
  return {
    title: "abcdefghijklmnop",
    tourType: "mountain",
    destinationId: DEST_ID,
    costContext: { totalCost: 500_000, requiresPayment: true },
    transportModes: ["bus", "private_car"],
    details: {
      tripDetails: {
        overview: {
          denaliTourKind: "mountain_day",
          shortIntro: "short intro text",
          tourThemeIds: [THEME_ID],
        },
        logistics: {
          departureDate: "2026-08-10",
          departureMeetingTime: "08:30",
          primaryTransportMode: "bus",
          privateCarMode: "car_share_fixed_dong",
          fuelShareToman: 120_000,
          groupSizeMax: 15,
          meetingPoint: "Tehran",
        },
        participation: {
          minimumAge: 18,
          fitnessLevel: "moderate",
          experienceLevel: "basic",
          sportsInsuranceRequired: true,
        },
        policies: {
          cancellationPolicy: "cancel policy",
        },
        photos: [
          {
            id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
            url: "https://example.com/t.jpg",
            filename: "t.jpg",
            size: 100,
            mimeType: "image/jpeg",
            uploadedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    },
  };
}

function presetDefaultsEquivalent(): Record<string, unknown> {
  return {
    basicInfo: {
      title: "abcdefghijklmnop",
      tourType: "mountain_day",
      destinationId: DEST_ID,
    },
    programNature: {
      mainTourThemeId: THEME_ID,
      shortDescription: "short intro text",
    },
    transport: {
      transportMode: "shared_cars",
      dongAmount: 120_000,
    },
    pricingPayment: {
      requiresPayment: true,
      basePricePerPerson: 500_000,
    },
    participantRequirements: {
      minimumAge: 18,
      fitnessLevel: "medium",
      sportsInsuranceRequired: true,
    },
    policies: {
      cancellationPolicy: "cancel policy",
    },
    photosData: {
      photos: [
        {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
          url: "https://example.com/t.jpg",
          filename: "t.jpg",
          size: 100,
          mimeType: "image/jpeg",
          uploadedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    },
    tripDetails: {
      logistics: {
        gatheringPoints: [],
      },
    },
  };
}

function rootKeys(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter((k) => DENALI_ROOTS.includes(k as (typeof DENALI_ROOTS)[number]));
}

test("mapToDenaliWizardPatch: clone and preset share the same Denali root keys", () => {
  const fromClone = mapToDenaliWizardPatch({ kind: "clone", tour: cloneFixture() });
  const fromPreset = mapToDenaliWizardPatch({
    kind: "preset",
    defaults: presetDefaultsEquivalent(),
  });

  const cloneRoots = rootKeys(fromClone as Record<string, unknown>).sort();
  const presetRoots = rootKeys(fromPreset as Record<string, unknown>).sort();
  assert.deepEqual(cloneRoots, presetRoots);
  assert.deepEqual(cloneRoots, [...DENALI_ROOTS].sort());
});

test("mapToDenaliWizardPatch: clone matches transformTourToDenaliWizardValues", () => {
  const tour = cloneFixture();
  const unified = mapToDenaliWizardPatch({ kind: "clone", tour });
  const direct = transformTourToDenaliWizardValues(tour);
  assert.equal(unified.basicInfo?.tourType, direct.basicInfo?.tourType);
  assert.equal(unified.basicInfo?.title, direct.basicInfo?.title);
  assert.equal((unified.programNature as any)?.mainTourThemeId, (direct.programNature as any)?.mainTourThemeId);
  assert.equal(
    unified.pricingPayment?.basePricePerPerson,
    direct.pricingPayment?.basePricePerPerson,
  );
});

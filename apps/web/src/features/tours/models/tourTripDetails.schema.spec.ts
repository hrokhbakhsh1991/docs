import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { TourFormProfile } from "@repo/types";

import type { TourTripDetails } from "./tourTripDetails.schema";
import { applyTripDetailsRequirednessToSchema, compactTripDetailsForApi, TourTripDetailsSchema } from "./tourTripDetails.schema";
import { getTripDetailsFieldConfigForProfile } from "../config/tripDetailsFieldConfigAdapter";

/** Matches RHF root: `tripDetails` is nested under the form object; issue paths are `tripDetails.…`. */
function tripDetailsFormSchema(profile: TourFormProfile) {
  return z.object({
    tripDetails: applyTripDetailsRequirednessToSchema(getTripDetailsFieldConfigForProfile(profile)),
  });
}

/** Future date so the "departure not in the past" cross-field rule never trips fixtures. */
const FUTURE_DEPARTURE_YMD = "2099-05-01";

/** Valid v4 UUID for fixture equipment ids. */
const GEAR_ID_FIXTURE = "11111111-1111-4111-8111-111111111111";

/** All five mountain-required TripDetails fields populated. */
const validMountainTripDetails = {
  overview: { difficultyLevel: 5 },
  participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
  logistics: { meetingPoint: "Azadi", departureDate: FUTURE_DEPARTURE_YMD },
};

function hasPath(issues: z.ZodIssue[], dottedPath: string): boolean {
  return issues.some((issue) => issue.path.join(".") === dottedPath);
}

test("compactTripDetailsForApi returns undefined for empty / whitespace-only payload", () => {
  assert.equal(compactTripDetailsForApi(undefined), undefined);
  assert.equal(compactTripDetailsForApi({} as TourTripDetails), undefined);
  assert.equal(
    compactTripDetailsForApi({
      overview: { mainDestination: "   " },
    } as TourTripDetails),
    undefined,
  );
});

/** Valid v4 UUID for fixture tour theme ids. */
const THEME_ID_FIXTURE = "22222222-2222-4222-8222-222222222222";

test("compactTripDetailsForApi trims strings, filters empty list entries, and keeps enums", () => {
  const out = compactTripDetailsForApi({
    overview: {
      mainDestination: "  Damavand  ",
      tourThemeIds: [THEME_ID_FIXTURE],
      tourThemeLabels: { [THEME_ID_FIXTURE]: "Photography trips" },
      tripStyles: ["adventure", "photography"],
    },
    itinerary: {
      highlights: ["sunrise", "  "],
      dayPlans: [
        { day: 1, title: " Hike ", distanceKm: 8, elevationGainM: 100 },
        { day: Number.NaN, title: "x" } as never,
        { day: 2 },
      ],
    },
  } as unknown as TourTripDetails);
  assert.deepEqual(out, {
    overview: {
      mainDestination: "Damavand",
      tourThemeIds: [THEME_ID_FIXTURE],
      tourThemeLabels: { [THEME_ID_FIXTURE]: "Photography trips" },
      tripStyles: ["adventure", "photography"],
    },
    itinerary: {
      highlights: ["sunrise"],
      dayPlans: [{ day: 1, title: "Hike", distanceKm: 8, elevationGainM: 100 }, { day: 2 }],
    },
  });
});

test("compactTripDetailsForApi drops dayPlans rows without a valid day", () => {
  const out = compactTripDetailsForApi({
    itinerary: {
      dayPlans: [{ title: "Only title" } as never],
    },
  } as unknown as TourTripDetails);
  assert.equal(out, undefined);
});

test('mountain: missing overview.difficultyLevel → error on tripDetails.overview.difficultyLevel', () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
      logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.overview.difficultyLevel"), true);
});

test('mountain: missing logistics.departureDate → error on tripDetails.logistics.departureDate', () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
      logistics: { meetingPoint: "Azadi" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.logistics.departureDate"), true);
});

test('mountain: missing logistics.meetingPoint → error on tripDetails.logistics.meetingPoint', () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
      logistics: { departureDate: "2099-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.logistics.meetingPoint"), true);
});

test('mountain: empty logistics.meetingPoint → error on tripDetails.logistics.meetingPoint', () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
      logistics: { meetingPoint: "", departureDate: "2099-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.logistics.meetingPoint"), true);
});

test("mountain_outdoor: missing participation.minimumAge is allowed by profile rules", () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { gearRequiredIds: [GEAR_ID_FIXTURE] },
      logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
    },
  });
  assert.equal(result.success, true);
});

test("mountain_outdoor: omitted participation.gearRequiredIds is allowed by profile rules", () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18 },
      logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
    },
  });
  assert.equal(result.success, true);
});

test("mountain_outdoor: empty participation.gearRequiredIds is allowed by profile rules", () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: [] },
      logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
    },
  });
  assert.equal(result.success, true);
});

test("mountain: invalid gearRequiredIds entry → error", () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: 5 },
      participation: { minimumAge: 18, gearRequiredIds: ["not-a-uuid"] },
      logistics: { meetingPoint: "Azadi", departureDate: FUTURE_DEPARTURE_YMD },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(
    result.error.issues.some((i) => i.path.join(".").startsWith("tripDetails.participation.gearRequiredIds")),
  );
});

test("generic: invalid overview.tourThemeIds entry → error", () => {
  const schema = tripDetailsFormSchema("general");
  const result = schema.safeParse({
    tripDetails: {
      overview: { tourThemeIds: ["not-a-uuid"] },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(
    result.error.issues.some((i) => i.path.join(".").startsWith("tripDetails.overview.tourThemeIds")),
  );
});

test('mountain: all required TripDetails fields present → validation passes', () => {
  const schema = tripDetailsFormSchema("mountain_outdoor");
  const result = schema.safeParse({ tripDetails: validMountainTripDetails });
  assert.equal(result.success, true);
});

test("generic: payloads that fail mountain for each required field still validate", () => {
  const schema = tripDetailsFormSchema("general");
  const cases: { name: string; tripDetails: Record<string, unknown> }[] = [
    {
      name: "no overview.difficultyLevel",
      tripDetails: {
        participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
        logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
      },
    },
    {
      name: "no logistics.departureDate",
      tripDetails: {
        overview: { difficultyLevel: 5 },
        participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
        logistics: { meetingPoint: "Azadi" },
      },
    },
    {
      name: "no logistics.meetingPoint",
      tripDetails: {
        overview: { difficultyLevel: 5 },
        participation: { minimumAge: 18, gearRequiredIds: [GEAR_ID_FIXTURE] },
        logistics: { departureDate: "2099-05-01" },
      },
    },
    {
      name: "no participation.minimumAge",
      tripDetails: {
        overview: { difficultyLevel: 5 },
        participation: { gearRequiredIds: [GEAR_ID_FIXTURE] },
        logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
      },
    },
    {
      name: "no participation.gearRequiredIds",
      tripDetails: {
        overview: { difficultyLevel: 5 },
        participation: { minimumAge: 18 },
        logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
      },
    },
    {
      name: "empty participation.gearRequiredIds",
      tripDetails: {
        overview: { difficultyLevel: 5 },
        participation: { minimumAge: 18, gearRequiredIds: [] },
        logistics: { meetingPoint: "Azadi", departureDate: "2099-05-01" },
      },
    },
  ];
  for (const { name, tripDetails } of cases) {
    const result = schema.safeParse({ tripDetails });
    assert.equal(result.success, true, `generic should accept: ${name}`);
  }
});

test("audience overlap → error on tripDetails.participation.notSuitableFor", () => {
  const result = TourTripDetailsSchema.safeParse({
    participation: { suitableFor: ["kids"], notSuitableFor: ["kids"] },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "participation.notSuitableFor"), true);
});

test("shortIntro over 250 characters fails", () => {
  const result = TourTripDetailsSchema.safeParse({
    overview: { shortIntro: "x".repeat(251) },
  });
  assert.equal(result.success, false);
});

test("compactTripDetailsForApi drops deprecated overview.bestFor", () => {
  const raw = {
    overview: { bestFor: ["legacy"], shortIntro: "ok" },
  } as unknown as TourTripDetails;
  const out = compactTripDetailsForApi(raw);
  assert.ok(out && typeof out.overview === "object" && out.overview !== null);
  assert.equal("bestFor" in (out!.overview as Record<string, unknown>), false);
  assert.equal((out!.overview as Record<string, unknown>).shortIntro, "ok");
});

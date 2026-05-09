import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import type { TourTripDetails } from "./tourTripDetails.schema";
import { applyTripDetailsRequirednessToSchema, compactTripDetailsForApi, TourTripDetailsRootSchema } from "./tourTripDetails.schema";
import { getTripDetailsFieldConfigForKind } from "../config/tripDetailsFieldConfig";
import type { EventKind } from "../policies/tour-kind-policy";

/** Matches RHF root: `tripDetails` is nested under the form object; issue paths are `tripDetails.…`. */
function tripDetailsFormSchema(kind: EventKind) {
  return z.object({
    tripDetails: applyTripDetailsRequirednessToSchema(
      TourTripDetailsRootSchema,
      getTripDetailsFieldConfigForKind(kind),
    ),
  });
}

/** All five mountain-required TripDetails fields populated. */
const validMountainTripDetails = {
  overview: { difficultyLevel: "moderate" as const },
  participation: { minimumAge: 18, gearRequired: ["boots"] },
  logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
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

test("compactTripDetailsForApi trims strings, filters empty list entries, and keeps enums", () => {
  const out = compactTripDetailsForApi({
    overview: {
      mainDestination: "  Damavand  ",
      tourTheme: [" a ", "", "photo"],
      tripStyle: "nature",
    },
    itinerary: {
      highlights: ["sunrise", "  "],
      dayPlans: [
        { day: 1, title: " Hike ", distanceKm: 8, elevationGainM: 100 },
        { day: Number.NaN, title: "x" } as never,
        { day: 2 },
      ],
    },
  } as TourTripDetails);
  assert.deepEqual(out, {
    overview: {
      mainDestination: "Damavand",
      tourTheme: ["a", "photo"],
      tripStyle: "nature",
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
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      participation: { minimumAge: 18, gearRequired: ["boots"] },
      logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.overview.difficultyLevel"), true);
});

test('mountain: missing logistics.departureDate → error on tripDetails.logistics.departureDate', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: "moderate" },
      participation: { minimumAge: 18, gearRequired: ["boots"] },
      logistics: { meetingPoint: "Azadi" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.logistics.departureDate"), true);
});

test('mountain: missing logistics.meetingPoint → error on tripDetails.logistics.meetingPoint', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: "moderate" },
      participation: { minimumAge: 18, gearRequired: ["boots"] },
      logistics: { departureDate: "2026-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.logistics.meetingPoint"), true);
});

test('mountain: empty logistics.meetingPoint → error on tripDetails.logistics.meetingPoint', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: "moderate" },
      participation: { minimumAge: 18, gearRequired: ["boots"] },
      logistics: { meetingPoint: "", departureDate: "2026-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.logistics.meetingPoint"), true);
});

test('mountain: missing participation.minimumAge → error on tripDetails.participation.minimumAge', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: "moderate" },
      participation: { gearRequired: ["boots"] },
      logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.participation.minimumAge"), true);
});

test('mountain: participation.gearRequired omitted → error on tripDetails.participation.gearRequired', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: "moderate" },
      participation: { minimumAge: 18 },
      logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.participation.gearRequired"), true);
});

test('mountain: participation.gearRequired empty array → error on tripDetails.participation.gearRequired', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({
    tripDetails: {
      overview: { difficultyLevel: "moderate" },
      participation: { minimumAge: 18, gearRequired: [] },
      logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
    },
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(hasPath(result.error.issues, "tripDetails.participation.gearRequired"), true);
});

test('mountain: all required TripDetails fields present → validation passes', () => {
  const schema = tripDetailsFormSchema("mountain");
  const result = schema.safeParse({ tripDetails: validMountainTripDetails });
  assert.equal(result.success, true);
});

test("generic: payloads that fail mountain for each required field still validate", () => {
  const schema = tripDetailsFormSchema("generic");
  const cases: { name: string; tripDetails: Record<string, unknown> }[] = [
    {
      name: "no overview.difficultyLevel",
      tripDetails: {
        participation: { minimumAge: 18, gearRequired: ["boots"] },
        logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
      },
    },
    {
      name: "no logistics.departureDate",
      tripDetails: {
        overview: { difficultyLevel: "moderate" },
        participation: { minimumAge: 18, gearRequired: ["boots"] },
        logistics: { meetingPoint: "Azadi" },
      },
    },
    {
      name: "no logistics.meetingPoint",
      tripDetails: {
        overview: { difficultyLevel: "moderate" },
        participation: { minimumAge: 18, gearRequired: ["boots"] },
        logistics: { departureDate: "2026-05-01" },
      },
    },
    {
      name: "no participation.minimumAge",
      tripDetails: {
        overview: { difficultyLevel: "moderate" },
        participation: { gearRequired: ["boots"] },
        logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
      },
    },
    {
      name: "no participation.gearRequired",
      tripDetails: {
        overview: { difficultyLevel: "moderate" },
        participation: { minimumAge: 18 },
        logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
      },
    },
    {
      name: "empty participation.gearRequired",
      tripDetails: {
        overview: { difficultyLevel: "moderate" },
        participation: { minimumAge: 18, gearRequired: [] },
        logistics: { meetingPoint: "Azadi", departureDate: "2026-05-01" },
      },
    },
  ];
  for (const { name, tripDetails } of cases) {
    const result = schema.safeParse({ tripDetails });
    assert.equal(result.success, true, `generic should accept: ${name}`);
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import { tourCreateSchema } from "./tourCreateSchema";

test("tourCreateSchema rejects endDate before startDate", () => {
  const result = tourCreateSchema.safeParse({
    overview: {
      title: "abcdefghij",
      shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی",
      longDescription: "",
    },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-09" },
    location: {
      regionId: "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      secondaryDestinationIds: [],
    },
    itinerary: {
      days: [
        {
          dayNumber: 1,
          title: "روز اول",
          segments: [{ activityType: "other", title: "بخش", description: "", locationName: "" }],
        },
      ],
    },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "schedule.endDate"));
  }
});

test("itinerary.days requires at least one day", () => {
  const result = tourCreateSchema.safeParse({
    overview: { title: "abcdefghij", shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی", longDescription: "" },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-10" },
    location: {
      regionId: "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      secondaryDestinationIds: [],
    },
    itinerary: { days: [] },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "itinerary.days"));
  }
});

test("itinerary day requires title and at least one segment", () => {
  const result = tourCreateSchema.safeParse({
    overview: { title: "abcdefghij", shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی", longDescription: "" },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-10" },
    location: {
      regionId: "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      secondaryDestinationIds: [],
    },
    itinerary: {
      days: [{ dayNumber: 1, title: "", description: "", segments: [] }],
    },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join("."));
    assert.ok(paths.includes("itinerary.days.0.title"));
    assert.ok(paths.includes("itinerary.days.0.segments"));
  }
});

test("itinerary numeric segment fields must be >= 0 when provided", () => {
  const result = tourCreateSchema.safeParse({
    overview: { title: "abcdefghij", shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی", longDescription: "" },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-10" },
    location: {
      regionId: "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      secondaryDestinationIds: [],
    },
    itinerary: {
      days: [
        {
          dayNumber: 1,
          title: "روز اول",
          description: "",
          segments: [
            {
              title: "segment",
              activityType: "hike",
              estimatedDurationHours: -1,
              distanceKm: -2,
              elevationGainMeters: -3,
            },
          ],
        },
      ],
    },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join("."));
    assert.ok(paths.includes("itinerary.days.0.segments.0.estimatedDurationHours"));
    assert.ok(paths.includes("itinerary.days.0.segments.0.distanceKm"));
    assert.ok(paths.includes("itinerary.days.0.segments.0.elevationGainMeters"));
  }
});

test("location.regionId is required when mainDestinationId is set", () => {
  const result = tourCreateSchema.safeParse({
    overview: { title: "abcdefghij", shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی", longDescription: "" },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-10" },
    location: { mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", secondaryDestinationIds: [] },
    itinerary: { days: [{ dayNumber: 1, title: "روز اول", segments: [{ title: "بخش" }] }] },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "location.regionId"));
  }
});

test("location.regionId must be UUID when provided", () => {
  const result = tourCreateSchema.safeParse({
    overview: { title: "abcdefghij", shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی", longDescription: "" },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-10" },
    location: {
      regionId: "not-a-uuid",
      mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      secondaryDestinationIds: [],
    },
    itinerary: { days: [{ dayNumber: 1, title: "روز اول", segments: [{ title: "بخش" }] }] },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "location.regionId"));
  }
});

test("private_car transport mode requires fuel share value", () => {
  const result = tourCreateSchema.safeParse({
    overview: { title: "abcdefghij", shortDescription: "خلاصه کوتاه برای تست اعتبارسنجی", longDescription: "" },
    pricing: { basePrice: 0 },
    schedule: { startDate: "2026-02-10", endDate: "2026-02-10" },
    location: {
      regionId: "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      mainDestinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      secondaryDestinationIds: [],
    },
    itinerary: { days: [{ dayNumber: 1, title: "روز اول", segments: [{ title: "بخش" }] }] },
    participation: {},
    logistics: { primaryTransportMode: "private_car" },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "logistics.fuelShareToman"));
  }
});

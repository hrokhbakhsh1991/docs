import test from "node:test";
import assert from "node:assert/strict";

import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";

import { buildTourCreateSchemaForFormProfile, tourCreateSchema } from "./tourCreateSchema";
import {
  resetTourCreateWizardValidationFlags,
  setTourCreateWizardValidationFlags,
} from "./tourCreateValidationPolicy";

test("logistics.primaryTransportMode empty string is accepted when relaxLogisticsPrimary", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: true, relaxLogisticsPrimary: true });
  try {
    const base = buildTourCreateFormDefaultValues();
    const v = {
      ...base,
      overview: {
        ...base.overview,
        title: "abcdefghijabcdefghij",
        shortDescription: "s",
        longDescription: "l",
      },
      logistics: {
        ...base.logistics,
        primaryTransportMode: "" as unknown as (typeof base.logistics)["primaryTransportMode"],
      },
    };
    const schema = buildTourCreateSchemaForFormProfile("general");
    const r = schema.safeParse(v);
    assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

test("mainTourThemeId empty string is accepted (RHF + select sentinel)", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: true, relaxLogisticsPrimary: true });
  try {
    const base = buildTourCreateFormDefaultValues();
    const v = {
      ...base,
      overview: {
        ...base.overview,
        title: "abcdefghijabcdefghij",
        shortDescription: "s",
        longDescription: "l",
        mainTourThemeId: "" as unknown as (typeof base.overview)["mainTourThemeId"],
      },
    };
    const schema = buildTourCreateSchemaForFormProfile("general");
    const r = schema.safeParse(v);
    assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

test("wizard defaultValues + basic-step relax flags validates (Playwright smoke parity)", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: true, relaxLogisticsPrimary: true });
  try {
    const base = buildTourCreateFormDefaultValues();
    const v = {
      ...base,
      overview: {
        ...base.overview,
        title: "abcdefghijabcdefghij",
        shortDescription: "خلاصه برای تست پروفایل سینما",
        longDescription: "توضیح کامل برای عبور از اعتبارسنجی گام اول.",
      },
    };
    const schema = buildTourCreateSchemaForFormProfile("general");
    const r = schema.safeParse(v);
    assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues));
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

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

test("itinerary.days requires at least one day when relaxItineraryMinDays is off", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: false, relaxLogisticsPrimary: false });
  try {
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
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

test("itinerary.days may be empty when relaxItineraryMinDays is on (cinema/urban profiles)", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: true, relaxLogisticsPrimary: false });
  try {
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
    assert.equal(result.success, true);
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

test("itinerary day requires title and at least one segment", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: false, relaxLogisticsPrimary: false });
  try {
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
        days: [{ dayNumber: 1, title: "", description: "", segments: [{}] }],
      },
      participation: {},
      logistics: { primaryTransportMode: "bus" },
      policies: {},
    });
    assert.equal(result.success, false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      assert.ok(paths.includes("itinerary.days.0.title"));
    }
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

test("logistics primary optional when relaxLogisticsPrimary (urban_event)", () => {
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: true, relaxLogisticsPrimary: true });
  try {
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
      logistics: {},
      policies: {},
    });
    assert.equal(result.success, true);
  } finally {
    resetTourCreateWizardValidationFlags();
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

test("supplemental private car next to bus requires fuel share", () => {
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
    logistics: { primaryTransportMode: "bus", supplementalPrivateCar: true },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "logistics.fuelShareToman"));
  }
});

test("private_car primary cannot combine with supplemental private car flag", () => {
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
    logistics: {
      primaryTransportMode: "private_car",
      supplementalPrivateCar: true,
      fuelShareToman: 100_000,
    },
    policies: {},
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((i) => i.path.join(".") === "logistics.supplementalPrivateCar"));
  }
});

test("buildTourCreateSchemaForFormProfile(cinema_event): empty itinerary.days without wizard flags", () => {
  resetTourCreateWizardValidationFlags();
  try {
    const schema = buildTourCreateSchemaForFormProfile("cinema_event");
    const result = schema.safeParse({
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
    assert.equal(result.success, true);
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

test("buildTourCreateSchemaForFormProfile(urban_event): skips logistics primaryTransport when logistics inactive", () => {
  resetTourCreateWizardValidationFlags();
  try {
    const schema = buildTourCreateSchemaForFormProfile("urban_event");
    const result = schema.safeParse({
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
      logistics: {},
      policies: {},
    });
    assert.equal(result.success, true);
  } finally {
    resetTourCreateWizardValidationFlags();
  }
});

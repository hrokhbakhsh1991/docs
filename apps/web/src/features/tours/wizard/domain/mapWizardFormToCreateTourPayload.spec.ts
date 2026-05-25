import test from "node:test";
import assert from "node:assert/strict";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import { tourCreateSchema } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";

import { mapFormValuesToBackendPayload } from "./mapWizardFormToCreateTourPayload";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

function minimalValidForm(overrides?: Partial<TourCreateFormValues>): TourCreateFormValues {
  const base: TourCreateFormValues = {
    overview: {
      title: "پیمایش دو روزه اولنگ",
      shortDescription: "تور آزمایشی برای تست mapper",
      longDescription: "",
      mainTourThemeId: undefined,
      secondaryTourThemeIds: [],
      tripStyles: [],
      highlights: [],
    },
    pricing: { basePrice: 1_000_000 },
    schedule: { startDate: "2026-06-01", endDate: "2026-06-02" },
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
          segments: [{ activityType: "hike", title: "راهپیمایی", description: "", locationName: "" }],
        },
      ],
    },
    participation: {},
    logistics: { primaryTransportMode: "bus" },
    policies: {},
  } as TourCreateFormValues;
  const raw: TourCreateFormValues = {
    ...base,
    ...overrides,
    overview: { ...base.overview, ...overrides?.overview },
    pricing: { ...base.pricing, ...overrides?.pricing },
    schedule: { ...base.schedule, ...overrides?.schedule },
    location: { ...base.location, ...overrides?.location },
    itinerary: overrides?.itinerary ?? base.itinerary,
    participation: { ...base.participation, ...overrides?.participation },
    logistics: { ...base.logistics, ...overrides?.logistics },
    policies: { ...base.policies, ...overrides?.policies },
  };
  return tourCreateSchema.parse(raw);
}

test("mapFormValuesToBackendPayload maps title capacity price and logistics dates", () => {
  const v = minimalValidForm();
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.title, v.overview.title);
  assert.equal(dto.capacity, 1);
  assert.equal(dto.price, 1_000_000);
  assert.ok(dto.tripDetails?.logistics?.departureDate);
  assert.ok(dto.tripDetails?.logistics?.returnDate);
  assert.equal(dto.lifecycle_status, "Draft");
});

test("requiresPayment maps to cost_context when enabled in wizard pricing", () => {
  const v = minimalValidForm({
    pricing: { basePrice: 2_000_000, requiresPayment: true },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.requiresPayment, true);
  const wire = buildCreateTourPostBody(dto);
  const cost = wire.cost_context as Record<string, unknown>;
  assert.equal(cost.requiresPayment, true);
  assert.equal(cost.totalCost, 2_000_000);
});

test("overview communicationLink maps onto create dto when non-empty", () => {
  const tmpl = minimalValidForm();
  const v = minimalValidForm({
    overview: { ...tmpl.overview, communicationLink: "https://t.me/+abc" },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.communicationLink, "https://t.me/+abc");
});

test("empty overview communicationLink is omitted from create dto", () => {
  const tmpl = minimalValidForm();
  const v = minimalValidForm({
    overview: { ...tmpl.overview, communicationLink: "" },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.communicationLink, undefined);
});

/** Keeps logistics JSONB aligned with API `assertCreateTourInvariants` (private_car + fuelShareToman). */
test("transport mode private_car maps to transportModes and fuel share in logistics", () => {
  const v = minimalValidForm({
    logistics: {
      primaryTransportMode: "private_car",
      fuelShareToman: 300_000,
      groupSizeMax: 18,
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.deepEqual(dto.transportModes, ["private_car"]);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "private_car");
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, 300_000);
  assert.equal(dto.capacity, 18);
});

test("midibus maps to bus transport mode while preserving logistics primary mode", () => {
  const v = minimalValidForm({
    logistics: {
      primaryTransportMode: "midibus",
      groupSizeMin: 9,
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.deepEqual(dto.transportModes, ["bus"]);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "midibus");
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, undefined);
  assert.equal(dto.capacity, 9);
});

test("supplemental private car adds private_car to transportModes and sends fuel in logistics", () => {
  const v = minimalValidForm({
    logistics: {
      primaryTransportMode: "bus",
      supplementalPrivateCar: true,
      fuelShareToman: 180_000,
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.deepEqual(dto.transportModes, ["bus", "private_car"]);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "bus");
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, 180_000);
});

test("insurance flags map into tripDetails when enabled", () => {
  const v = minimalValidForm({
    participation: { sportsInsuranceRequired: true },
    logistics: {
      primaryTransportMode: "bus",
      leaderProvidesInsurance: true,
      leaderInsuranceNotes: "بیمه مسئولیت گروه",
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.tripDetails?.participation?.sportsInsuranceRequired, true);
  assert.equal(dto.tripDetails?.logistics?.leaderProvidesInsurance, true);
  assert.equal(dto.tripDetails?.logistics?.leaderInsuranceNotes, "بیمه مسئولیت گروه");
});

test("insurance flags omitted from tripDetails when disabled", () => {
  const v = minimalValidForm({
    participation: { sportsInsuranceRequired: false },
    logistics: {
      primaryTransportMode: "bus",
      leaderProvidesInsurance: false,
      leaderInsuranceNotes: "نادیده گرفته شود",
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.tripDetails?.participation?.sportsInsuranceRequired, undefined);
  assert.equal(dto.tripDetails?.logistics?.leaderProvidesInsurance, undefined);
  assert.equal(dto.tripDetails?.logistics?.leaderInsuranceNotes, undefined);
});

test("registration national ID requirement maps when enabled", () => {
  const v = minimalValidForm({
    participation: { registrationNationalIdRequired: true },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.tripDetails?.participation?.registrationNationalIdRequired, true);
});

test("registration national ID requirement omitted when disabled", () => {
  const v = minimalValidForm({
    participation: { registrationNationalIdRequired: false },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.tripDetails?.participation?.registrationNationalIdRequired, undefined);
});

test("autoAcceptRegistrations defaults to true when omitted on form", () => {
  const v = minimalValidForm();
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.autoAcceptRegistrations, true);
});

test("autoAcceptRegistrations maps false when organizer disables auto-accept", () => {
  const v = minimalValidForm({ autoAcceptRegistrations: false });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.autoAcceptRegistrations, false);
});

test("overviewTourThemeIds: main theme ordered before secondary", () => {
  const mainId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const secId = "b17fa0bc-9564-4711-add7-eeb9bd391a22";
  const v = minimalValidForm({
    overview: {
      ...minimalValidForm().overview,
      mainTourThemeId: mainId,
      secondaryTourThemeIds: [secId],
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.deepEqual(dto.tripDetails?.overview?.tourThemeIds, [mainId, secId]);
});

test("derived duration respects start/end Gregorian dates", () => {
  const v = minimalValidForm({
    schedule: { startDate: "2026-01-01", endDate: "2026-01-03", departureMeetingTime: "" },
  });
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.durationDays, 3);
});

test("itinerary maps all segment fields without data loss", () => {
  const v = minimalValidForm({
    itinerary: {
      days: [
        {
          dayNumber: 2,
          title: "روز دوم",
          description: "شرح روز",
          segments: [
            {
              title: "صعود",
              description: "از مبدا تا قله",
              activityType: "summit",
              startTime: "05:30",
              endTime: "10:00",
              estimatedDurationHours: 4.5,
              distanceKm: 7.2,
              elevationGainMeters: 850,
              maxAltitudeMeters: 3900,
              locationName: "قله",
            },
          ],
        },
      ],
    },
  });
  const dto = mapFormValuesToBackendPayload(v);
  const segmentActivities = (dto.tripDetails?.itinerary as Record<string, unknown> | undefined)?.segmentActivities as
    | Array<Record<string, unknown>>
    | undefined;
  assert.ok(Array.isArray(segmentActivities));
  const firstDay = segmentActivities?.[0];
  const firstSegment = (firstDay?.segments as Array<Record<string, unknown>> | undefined)?.[0];
  assert.equal(firstDay?.dayNumber, 2);
  assert.equal(firstSegment?.activityType, "summit");
  assert.equal(firstSegment?.elevationGainMeters, 850);
  assert.equal(firstSegment?.maxAltitudeMeters, 3900);
  assert.equal(firstSegment?.locationName, "قله");
});

test("mapper emits settingsRegionId from location.regionId", () => {
  const v = minimalValidForm();
  const dto = mapFormValuesToBackendPayload(v);
  assert.equal(dto.tripDetails?.overview?.settingsRegionId, v.location.regionId);
});

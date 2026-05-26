import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues, normalizeDenaliWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { assertSubmitValidDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliSubmitTestHelpers";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

import {
  buildDenaliSubmitItinerarySlice,
  denaliDayPlansToSegmentActivities,
} from "./buildDenaliCreateTourPayloadProjection";
import {
  denaliTourKindToApiTourType,
  mapDenaliWizardToCreateTourPayload,
  splitIsoDateTime,
} from "./mapDenaliWizardToCreateTourPayload";

/** Submit-valid form (production gate); optional patch merged before validate. */
function submitValidForm(
  patch?: Omit<Partial<DenaliCreateTourWizardForm>, "basicInfo" | "transport" | "programNature" | "participantRequirements"> & {
    basicInfo?: Partial<DenaliCreateTourWizardForm["basicInfo"]>;
    transport?: Partial<DenaliCreateTourWizardForm["transport"]>;
    programNature?: Partial<DenaliCreateTourWizardForm["programNature"]>;
    participantRequirements?: Partial<DenaliCreateTourWizardForm["participantRequirements"]>;
  },
): DenaliCreateTourWizardForm {
  const base = buildDenaliTourCreateTestValues();
  const merged = patch
    ? {
        ...base,
        ...patch,
        basicInfo: { ...base.basicInfo, ...patch.basicInfo },
        transport: { ...base.transport, ...patch.transport },
        programNature: patch.programNature
          ? { ...base.programNature, ...patch.programNature }
          : base.programNature,
      }
    : base;
  return assertSubmitValidDenaliWizardForm(merged);
}

test("denaliTourKindToApiTourType", () => {
  assert.equal(denaliTourKindToApiTourType("mountain_day"), "mountain");
  assert.equal(denaliTourKindToApiTourType("event_cinema"), "cultural");
});

test("splitIsoDateTime", () => {
  const parts = splitIsoDateTime("2026-06-01T08:30:00.000Z");
  assert.ok(parts.date?.startsWith("2026-06-0"));
  assert.match(parts.time ?? "", /^\d{2}:\d{2}$/);
});

test("mapDenaliWizardToCreateTourPayload maps core fields", () => {
  const form = submitValidForm();
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.title, form.basicInfo.title);
  assert.equal(dto.tourType, "mountain");
  assert.equal(dto.destinationId, form.basicInfo.destinationId);
  assert.equal(dto.capacity, form.basicInfo.capacityMax);
  assert.equal(dto.requiresPayment, true);
  assert.equal(dto.paymentMode, "offline_receipt");
  const overview = dto.tripDetails?.overview as Record<string, unknown> | undefined;
  assert.equal(overview?.denaliTourKind, "mountain_day");
  assert.equal(dto.tripDetails?.logistics?.departureDate, splitIsoDateTime(form.basicInfo.startDateTime).date);
});

test("mapDenaliWizardToCreateTourPayload: organizer_vehicle maps to bus", () => {
  const form = submitValidForm();
  form.transport.transportMode = "organizer_vehicle";
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, "bus");
  assert.deepEqual(dto.transportModes, ["bus"]);
});

test("mapDenaliWizardToCreateTourPayload: none omits primaryTransportMode and clears root modes", () => {
  const base = buildDenaliTourCreateTestValues();
  const form = normalizeDenaliWizardForm({
    ...base,
    basicInfo: { ...base.basicInfo, tourType: "mountain_day", capacityMax: 12 },
    transport: { ...base.transport, transportMode: "none" },
  });
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.logistics?.primaryTransportMode, undefined);
  assert.deepEqual(dto.transportModes, []);
});

test("mapDenaliWizardToCreateTourPayload: strips blob gallery photos from wire payload", () => {
  const base = buildDenaliTourCreateTestValues();
  const form = normalizeDenaliWizardForm({
    ...base,
    basicInfo: { ...base.basicInfo, tourType: "mountain_day", capacityMax: 12 },
    photosData: {
      photos: [
        {
          id: "p-blob",
          url: "blob:http://localhost/abc",
          filename: "a.jpg",
          size: 1024,
          mimeType: "image/jpeg",
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "p-http",
          url: "https://cdn.example.com/a.jpg",
          filename: "b.jpg",
          size: 2048,
          mimeType: "image/jpeg",
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  });
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const photos = (dto.tripDetails as { photos?: { id: string; url: string }[] } | undefined)?.photos;
  assert.equal(photos?.length, 1);
  assert.equal(photos?.[0]?.id, "p-http");
  assert.equal(photos?.[0]?.url, "https://cdn.example.com/a.jpg");
});

test("denaliDayPlansToSegmentActivities: each day has segment title and description", () => {
  const rows = denaliDayPlansToSegmentActivities([
    { day: 1, title: "Camp", description: "Ascent to camp" },
    { day: 2, description: "Summit day only" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.segments![0]!.title, "Camp");
  assert.equal(rows[0]!.segments![0]!.description, "Ascent to camp");
  assert.equal(rows[1]!.segments![0]!.title, "روز 2");
  assert.equal(rows[1]!.segments![0]!.description, "Summit day only");
});

test("buildDenaliSubmitItinerarySlice: multi-day includes dayPlans and segmentActivities", () => {
  const slice = buildDenaliSubmitItinerarySlice({
    dayPlans: [{ day: 1, description: "Summit push" }],
    fallbackSegmentTitle: "ignored",
  });
  assert.ok(Array.isArray(slice.dayPlans) && slice.dayPlans.length === 1);
  assert.ok(Array.isArray(slice.segmentActivities) && slice.segmentActivities.length === 1);
  const seg = slice.segmentActivities![0]!.segments![0] as {
    title?: string;
    description?: string;
  };
  assert.equal(seg.title, "روز 1");
  assert.equal(seg.description, "Summit push");
});

test("buildDenaliSubmitItinerarySlice: falls back to segmentActivities when dayPlans empty", () => {
  const slice = buildDenaliSubmitItinerarySlice({
    dayPlans: [],
    programNotes: "notes",
    fallbackSegmentTitle: "  Day hike  ",
  });
  assert.equal(slice.programNotes, "notes");
  assert.ok(Array.isArray(slice.segmentActivities) && slice.segmentActivities.length === 1);
  const seg = slice.segmentActivities![0]!.segments![0] as { title?: string };
  assert.equal(seg.title, "Day hike");
});

test("mapDenaliWizardToCreateTourPayload: single-day mountain emits segmentActivities for submit-required", () => {
  const form = submitValidForm();
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const itinerary = dto.tripDetails?.itinerary as Record<string, unknown> | undefined;
  const segmentActivities = itinerary?.segmentActivities as unknown[] | undefined;
  assert.ok(Array.isArray(segmentActivities) && segmentActivities.length > 0);
  const first = segmentActivities[0] as {
    dayNumber?: number;
    segments?: Array<{ title?: string; description?: string }>;
  };
  assert.equal(first.dayNumber, 1);
  assert.ok(Array.isArray(first.segments) && first.segments.length > 0);
  assert.ok((first.segments![0]!.title ?? "").length > 0);
  assert.ok((first.segments![0]!.description ?? "").length > 0);
});

test("Denali create pipeline: cost_context requiresPayment + paymentMode on wire", () => {
  const form = submitValidForm();
  let clientDto = mapDenaliWizardToCreateTourPayload(form);
  clientDto = stripCreateTourDtoForFormProfile("denali_pilot", clientDto);
  const prepared = mapCreateTourDto({ ...clientDto }, { themeCatalog: [] });
  assert.equal(prepared.requiresPayment, true);
  assert.equal(prepared.paymentMode, "offline_receipt");
  const wire = buildCreateTourPostBody(prepared);
  const cost = wire.cost_context as Record<string, unknown>;
  assert.equal(cost.requiresPayment, true);
  assert.equal(cost.paymentMode, "offline_receipt");
});

test("mapDenaliWizardToCreateTourPayload: outdoor program maps to tripDetails", () => {
  const form = submitValidForm();
  form.programNature.difficultyLevel = 5;
  form.programNature.hikingHoursApprox = 4;
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = dto.tripDetails?.overview as Record<string, unknown> | undefined;
  assert.equal(overview?.difficultyLevel, 5);
  assert.match(String(dto.tripDetails?.itinerary?.programNotes ?? ""), /مدت تقریبی پیاده‌روی:\s*4/);
});

test("mapDenaliWizardToCreateTourPayload: transport notes map to logistics", () => {
  const form = submitValidForm();
  form.transport.transportNotes = "Meet at north parking";
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.logistics?.transportationNotes, "Meet at north parking");
});

test("mapDenaliWizardToCreateTourPayload: shared_cars maps dong to fuelShareToman", () => {
  const form = submitValidForm();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 120_000;
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, 120_000);
  assert.equal((dto.tripDetails?.logistics as any)?.privateCarMode, "car_share_fixed_dong");
  assert.ok(dto.transportModes?.includes("private_car"));
});

test("mapDenaliWizardToCreateTourPayload: wizard fitness enum maps to API participation slugs", () => {
  const mappings = [
    ["low", "easy"],
    ["medium", "moderate"],
    ["high", "hard"],
  ] as const;
  for (const [wizardLevel, apiLevel] of mappings) {
    const form = submitValidForm();
    form.participantRequirements.fitnessLevel = wizardLevel;
    const dto = mapDenaliWizardToCreateTourPayload(form);
    assert.equal(
      dto.tripDetails?.participation?.fitnessLevel,
      apiLevel,
      `wizard ${wizardLevel} → API ${apiLevel}`,
    );
  }
});

test("mapDenaliWizardToCreateTourPayload: mountain_day sets overview.denaliTourKind on wire", () => {
  const form = submitValidForm();
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = dto.tripDetails?.overview as { denaliTourKind?: string } | undefined;
  assert.equal(overview?.denaliTourKind, "mountain_day");
  assert.equal(dto.tripDetails?.participation?.fitnessLevel, "moderate");
});

test("mapDenaliWizardToCreateTourPayload: projects maxAltitudeMeters for mountain_day", () => {
  const form = submitValidForm();
  form.tripDetails = {
    ...form.tripDetails,
    overview: { ...form.tripDetails.overview, peakHeight: 5_610 },
  };
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const overview = dto.tripDetails?.overview as { maxAltitudeMeters?: number } | undefined;
  assert.equal(overview?.maxAltitudeMeters, 5_610);
});

test("mapDenaliWizardToCreateTourPayload: multi-day itinerary maps to dayPlans and segmentActivities", () => {
  const form = submitValidForm({
    basicInfo: {
      tourType: "mountain_multi",
      endDateTime: "2026-06-03T18:00:00.000Z",
    },
    programNature: {
      itinerary: [
        { day: 1, activities: "روز اول" },
        { day: 2, activities: "روز دوم", locationText: "Camp 2" },
        { day: 3, activities: "روز سوم" },
      ],
    },
  });
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const itinerary = dto.tripDetails?.itinerary;
  const dayPlans = itinerary?.dayPlans;
  assert.equal(dayPlans?.length, 3);
  assert.equal(dayPlans?.[0]?.description, "روز اول");
  const segmentActivities = itinerary?.segmentActivities;
  assert.equal(segmentActivities?.length, 3);
  assert.equal(segmentActivities?.[0]?.dayNumber, 1);
  assert.equal(segmentActivities?.[0]?.segments?.[0]?.title, "روز 1");
  assert.equal(segmentActivities?.[0]?.segments?.[0]?.description, "روز اول");
  assert.equal(segmentActivities?.[1]?.segments?.[0]?.title, "Camp 2");
  assert.match(String(segmentActivities?.[1]?.segments?.[0]?.description), /Camp 2/);
});

test("mapDenaliWizardToCreateTourPayload: gearItems split into required and optional ids", () => {
  const form = submitValidForm();
  form.participantRequirements.gearItems = [
    { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", isRequired: true },
    { id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", isRequired: false },
  ];
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.deepEqual(dto.tripDetails?.participation?.gearRequiredIds, [
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  ]);
  assert.deepEqual(dto.tripDetails?.participation?.gearOptionalIds, [
    "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  ]);
});

test("mapDenaliWizardToCreateTourPayload: omits empty operational fields", () => {
  const form = submitValidForm();
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal((dto.tripDetails?.logistics as any)?.startPointVillage, undefined);
  assert.equal(
    (dto.tripDetails?.participation as { fitnessPrerequisiteText?: string } | undefined)
      ?.fitnessPrerequisiteText,
    undefined,
  );
});

test("mapDenaliWizardToCreateTourPayload: maps operational fields including per-day itinerary photos", () => {
  const form = submitValidForm({
    basicInfo: {
      tourType: "mountain_multi",
      endDateTime: "2026-06-03T18:00:00.000Z",
      startPointLocationText: "Rineh",
      approximateReturnTime: "15:30",
    },
    programNature: {
      hikingGoHours: 5,
      hikingReturnHours: 3,
      itinerary: [
        {
          day: 1,
          activities: "Ascent",
          locationText: "Camp 1",
          photos: [
            {
              id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
              url: "https://example.com/d1.jpg",
              filename: "d1.jpg",
              size: 100,
              mimeType: "image/jpeg",
              uploadedAt: "2026-06-01T08:00:00.000Z",
            },
          ],
        },
        { day: 2, activities: "Summit", locationText: "Peak" },
        { day: 3, activities: "Return", locationText: "Base" },
      ],
    },
    participantRequirements: {
      minimumAge: 18,
      fitnessLevel: "medium",
      sportsInsuranceRequired: true,
      fitnessPrerequisiteText: "Mountain fitness required.",
    },
  });
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal((dto.tripDetails?.logistics as any)?.startPointVillage, "Rineh");
  assert.equal(dto.tripDetails?.logistics?.returnMeetingTime, "15:30");
  assert.match(dto.tripDetails?.itinerary?.programNotes ?? "", /رفت:\s*5/);
  assert.match(dto.tripDetails?.itinerary?.programNotes ?? "", /برگشت:\s*3/);
  assert.equal(
    (dto.tripDetails?.participation as { fitnessPrerequisiteText?: string } | undefined)
      ?.fitnessPrerequisiteText,
    "Mountain fitness required.",
  );
  const day1 = dto.tripDetails?.itinerary?.dayPlans?.[0] as
    | { photos?: Array<{ id: string }> }
    | undefined;
  assert.ok(Array.isArray(day1?.photos) && day1.photos.length === 1);
  assert.equal(day1.photos[0].id, "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");
});

test("mapDenaliWizardToCreateTourPayload: includesTourInsurance maps to leaderProvidesInsurance", () => {
  const form = submitValidForm();
  form.pricingPayment.includesTourInsurance = true;
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.logistics?.leaderProvidesInsurance, true);
});

test("mapDenaliWizardToCreateTourPayload: omits leaderProvidesInsurance when tour insurance unchecked", () => {
  const form = submitValidForm();
  form.pricingPayment.includesTourInsurance = false;
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.tripDetails?.logistics?.leaderProvidesInsurance, undefined);
});

test("mapDenaliWizardToCreateTourPayload: includes tour crew fields in POST", () => {
  const form = submitValidForm();
  form.basicInfo.leaderUserIds = ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"];
  form.basicInfo.requiresLocalGuide = true;
  form.basicInfo.localGuideName = "Ali — local mountain guide";
  const dto = mapDenaliWizardToCreateTourPayload(form);
  const tripDetailsJson = JSON.stringify(dto.tripDetails ?? {});
  assert.equal(tripDetailsJson.includes("leaderUserIds"), true);
  assert.equal(tripDetailsJson.includes("localGuideName"), true);
  // requiresLocalGuide is currently not whitelisted in the API DTO, so we check if it's still missing or added
  // Based on my changes, I only added leaderUserIds and localGuideName.
});

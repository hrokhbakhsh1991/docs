import assert from "node:assert/strict";
import test from "node:test";

import { CREATE_TOUR_DTO_WIRE_KEYS } from "@repo/shared-contracts";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { tourCreateSchema } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { mapFormValuesToBackendPayload } from "@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

function minimalValidForm(): TourCreateFormValues {
  const raw: TourCreateFormValues = {
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
  return tourCreateSchema.parse(raw);
}

const wireKeySet = new Set<string>(CREATE_TOUR_DTO_WIRE_KEYS);

test("wizard → mapCreateTourDto → POST body uses only CreateTourDto wire keys", () => {
  const form = minimalValidForm();
  const clientDto = mapFormValuesToBackendPayload(form);
  const prepared = mapCreateTourDto(clientDto, { themeCatalog: [] });
  const wire = buildCreateTourPostBody(prepared);
  for (const key of Object.keys(wire)) {
    assert.ok(
      wireKeySet.has(key),
      `unexpected POST key "${key}" — add to server CreateTourDto or fix client serializer; ` +
        `canonical list is CREATE_TOUR_DTO_WIRE_KEYS (@repo/shared-contracts)`
    );
  }
});

test("wizard with communication link sends chat_link on wire contract", () => {
  const form = minimalValidForm();
  const withLink = tourCreateSchema.parse({
    ...form,
    overview: { ...form.overview, communicationLink: "https://t.me/+abc" },
  });
  const clientDto = mapFormValuesToBackendPayload(withLink);
  const prepared = mapCreateTourDto(clientDto, { themeCatalog: [] });
  const wire = buildCreateTourPostBody(prepared);
  assert.equal(wire.chat_link, "https://t.me/+abc");
  for (const key of Object.keys(wire)) {
    assert.ok(wireKeySet.has(key));
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { CREATE_TOUR_POST_WIRE_KEYS } from "@repo/shared-contracts";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { tourCreateSchema } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { mapDenaliWizardToCreateTourPayload } from "@/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload";
import { mapFormValuesToBackendPayload } from "@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload";
import { submitValidDenaliWizardDefaults } from "@/features/tours/wizard/denali/validation/denaliSubmitTestHelpers";
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

const wireKeySet = new Set<string>(CREATE_TOUR_POST_WIRE_KEYS);

test("wizard → mapCreateTourDto → POST body uses only client POST wire keys", () => {
  const form = minimalValidForm();
  const clientDto = mapFormValuesToBackendPayload(form);
  const prepared = mapCreateTourDto(clientDto, { themeCatalog: [] });
  const wire = buildCreateTourPostBody(prepared);
  for (const key of Object.keys(wire)) {
    assert.ok(
      wireKeySet.has(key),
      `unexpected POST key "${key}" — add to server CreateTourDto or fix client serializer; ` +
        `canonical list is CREATE_TOUR_POST_WIRE_KEYS (@repo/shared-contracts)`
    );
  }
  assert.equal("formProfile" in wire, false, "create POST must not include formProfile");
});

test("buildCreateTourPostBody strips formProfile when DTO still carries it", () => {
  const form = minimalValidForm();
  const clientDto = mapFormValuesToBackendPayload(form);
  const prepared = mapCreateTourDto(
    { ...clientDto, formProfile: "denali_pilot" } as typeof clientDto & { formProfile: string },
    { themeCatalog: [] },
  );
  assert.equal(prepared.formProfile, undefined);
  const wire = buildCreateTourPostBody({ ...prepared, formProfile: "denali_pilot" });
  assert.equal("formProfile" in wire, false);
});

test("Denali wizard → mapCreateTourDto → POST body uses only client POST wire keys", () => {
  const form = submitValidDenaliWizardDefaults();
  let clientDto = mapDenaliWizardToCreateTourPayload(form);
  clientDto = stripCreateTourDtoForFormProfile("denali_pilot", clientDto);
  const prepared = mapCreateTourDto({ ...clientDto }, { themeCatalog: [] });
  const wire = buildCreateTourPostBody(prepared);
  for (const key of Object.keys(wire)) {
    assert.ok(
      wireKeySet.has(key),
      `unexpected Denali POST key "${key}" — UI-only Denali tab fields must not leak past mapper`,
    );
  }
  assert.equal("formProfile" in wire, false);
  const overview = (wire.tripDetails as { overview?: Record<string, unknown> } | undefined)?.overview;
  assert.equal(overview?.denaliTourKind, "mountain_day");
  const cost = wire.cost_context as Record<string, unknown> | undefined;
  assert.equal(cost?.requiresPayment, true);
  assert.equal(cost?.paymentMode, "offline_receipt");
});

test("create tour POST body never includes formProfile (contract regression)", () => {
  const pipelines: Array<Record<string, unknown>> = [];

  const classicForm = minimalValidForm();
  pipelines.push(
    buildCreateTourPostBody(
      mapCreateTourDto(mapFormValuesToBackendPayload(classicForm), { themeCatalog: [] }),
    ),
  );

  const denaliForm = submitValidDenaliWizardDefaults();
  let denaliDto = mapDenaliWizardToCreateTourPayload(denaliForm);
  denaliDto = stripCreateTourDtoForFormProfile("denali_pilot", denaliDto);
  pipelines.push(buildCreateTourPostBody(mapCreateTourDto({ ...denaliDto }, { themeCatalog: [] })));

  pipelines.push(
    buildCreateTourPostBody({
      ...mapCreateTourDto(mapFormValuesToBackendPayload(classicForm), { themeCatalog: [] }),
      formProfile: "urban_event",
    } as Parameters<typeof buildCreateTourPostBody>[0]),
  );

  for (const wire of pipelines) {
    assert.equal(
      "formProfile" in wire,
      false,
      `formProfile must not appear on POST /tours; keys=${Object.keys(wire).join(",")}`,
    );
    assert.equal(wire.formProfile, undefined);
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

import assert from "node:assert/strict";
import test from "node:test";

import { stripInactiveTourCreateGroupsForProfile } from "@/features/tours/wizard/fieldGroups";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { wizardFormToCreateTourApiPayload } from "@/features/tours/wizard/contract/tour-wizard-contract";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

test("wizardFormToCreateTourApiPayload: urban_event wire omits phantom participation and extra logistics", () => {
  const v = buildTourCreateFormDefaultValues();
  v.overview.title = "1234567890 عنوان urban wire";
  v.overview.shortDescription = "short";
  v.overview.longDescription = "long";
  v.overview.tourType = "city";
  v.schedule.startDate = "2026-08-10";
  v.schedule.endDate = "2026-08-11";
  v.location.regionId = "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  v.location.mainDestinationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  v.pricing.basePrice = 100_000;
  v.itinerary.days[0]!.title = "ghost-day";
  v.participation.requirements = "ghost-participation";
  v.logistics.primaryTransportMode = "bus";
  v.logistics.fuelShareToman = 300_000;
  v.logistics.groupSizeMax = 18;

  const stripped = stripInactiveTourCreateGroupsForProfile("urban_event", v);
  const dto = wizardFormToCreateTourApiPayload("urban_event", stripped);
  const wire = buildCreateTourPostBody(mapCreateTourDto({ ...dto, formProfile: "urban_event" }));
  const json = JSON.stringify(wire);

  assert.ok(!json.includes("ghost-participation"));
  assert.ok(!json.includes("ghost-day"));
  assert.ok(!json.includes("groupSizeMax"));
  assert.ok(!json.includes("fuelShareToman"));
  assert.ok(!json.includes("primaryTransportMode"));
  assert.ok(json.includes("departureDate") || json.includes("departure_date"));
});

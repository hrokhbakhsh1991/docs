import assert from "node:assert/strict";
import test from "node:test";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { stripInactiveTourCreateGroupsForProfile } from "@/features/tours/wizard/fieldGroups";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { wizardFormToCreateTourApiPayload } from "@/features/tours/wizard/contract/tour-wizard-contract";

test("wizardFormToCreateTourApiPayload: cinema_event wire omits fuelShareToman", () => {
  const v = buildTourCreateFormDefaultValues();
  v.overview.title = "1234567890 عنوان cinema wire";
  v.overview.shortDescription = "short";
  v.overview.longDescription = "long";
  v.schedule.startDate = "2026-08-10";
  v.schedule.endDate = "2026-08-11";
  v.location.regionId = "c70ebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  v.location.mainDestinationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  v.pricing.basePrice = 100_000;
  v.logistics.primaryTransportMode = "bus";
  v.logistics.fuelShareToman = 300_000;

  const stripped = stripInactiveTourCreateGroupsForProfile("cinema_event", v);
  const dto = wizardFormToCreateTourApiPayload("cinema_event", stripped);
  const json = JSON.stringify(dto);

  assert.ok(!json.includes("fuelShareToman"));
});

test("stripCreateTourDtoForFormProfile: general evicts stale fuelShareToman silently", () => {
  const stripped = stripCreateTourDtoForFormProfile("general", {
    title: "1234567890ab",
    total_capacity: 10,
    tripDetails: {
      logistics: { primaryTransportMode: "bus", fuelShareToman: 300_000 },
    },
  } as never);
  assert.equal(
    (stripped.tripDetails?.logistics as Record<string, unknown> | undefined)?.fuelShareToman,
    undefined,
  );
});

test("stripCreateTourDtoForFormProfile: cinema_event deletes stale fuelShareToman", () => {
  const dto = {
    title: "1234567890 cinema",
    total_capacity: 10,
    tripDetails: {
      logistics: {
        primaryTransportMode: "bus",
        fuelShareToman: 5000,
      },
    },
  };
  const stripped = stripCreateTourDtoForFormProfile("cinema_event", dto as never);
  assert.equal(
    (stripped.tripDetails?.logistics as Record<string, unknown> | undefined)?.fuelShareToman,
    undefined,
  );
});

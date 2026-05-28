import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
  TripDetailsDayPlanDto,
  TripDetailsLogisticsDto,
  TripDetailsOverviewDto,
  TripDetailsParticipationDto,
} from "./trip-details.dto";

/* merged from trip-details-denali-fields.dto.spec.ts */

test("TripDetailsOverviewDto: accepts denaliTourKind", async () => {
  const dto = plainToInstance(TripDetailsOverviewDto, {
    denaliTourKind: "mountain_day",
    shortIntro: "Denali day hike",
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.denaliTourKind, "mountain_day");
});

test("TripDetailsOverviewDto: accepts nonAttendanceDetails", async () => {
  const dto = plainToInstance(TripDetailsOverviewDto, {
    nonAttendanceDetails: "No-show policy for late arrivals.",
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.nonAttendanceDetails, "No-show policy for late arrivals.");
});

test("TripDetailsOverviewDto: rejects unknown denaliTourKind", async () => {
  const dto = plainToInstance(TripDetailsOverviewDto, {
    denaliTourKind: "not_a_denali_kind",
  });
  const errors = await validate(dto);
  assert.ok(errors.length > 0);
});

test("TripDetailsLogisticsDto: accepts privateCarMode", async () => {
  const dto = plainToInstance(TripDetailsLogisticsDto, {
    privateCarMode: "car_share_fixed_dong",
    fuelShareToman: 50_000,
    departureDate: "2026-09-01",
    primaryTransportMode: "bus",
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.privateCarMode, "car_share_fixed_dong");
});

test("TripDetailsLogisticsDto: rejects unknown privateCarMode", async () => {
  const dto = plainToInstance(TripDetailsLogisticsDto, {
    privateCarMode: "invalid_mode",
  });
  const errors = await validate(dto);
  assert.ok(errors.length > 0);
});

test("TripDetailsLogisticsDto: accepts startPointVillage", async () => {
  const dto = plainToInstance(TripDetailsLogisticsDto, {
    startPointVillage: "Rineh",
    meetingPoint: "Tehran",
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.startPointVillage, "Rineh");
});

test("TripDetailsParticipationDto: accepts fitnessPrerequisiteText", async () => {
  const dto = plainToInstance(TripDetailsParticipationDto, {
    fitnessPrerequisiteText: "Prior mountain experience required.",
    minimumAge: 18,
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.fitnessPrerequisiteText, "Prior mountain experience required.");
});

test("TripDetailsDayPlanDto: accepts optional location pin", async () => {
  const dto = plainToInstance(TripDetailsDayPlanDto, {
    day: 1,
    title: "Camp",
    description: "Hike",
    location: { addressText: "Rineh", latitude: 35.9, longitude: 52.1 },
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.location?.latitude, 35.9);
});

test("TripDetailsDayPlanDto: accepts optional photos", async () => {
  const dto = plainToInstance(TripDetailsDayPlanDto, {
    day: 1,
    title: "Base",
    description: "Hike",
    photos: [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        url: "https://example.com/1.jpg",
        filename: "1.jpg",
        size: 1024,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T12:00:00.000Z",
      },
    ],
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.photos?.length, 1);
});


/* merged from trip-details-participation.dto.spec.ts */

test("TripDetailsParticipationDto: overlapping suitableFor / notSuitableFor fails validation", async () => {
  const dto = plainToInstance(TripDetailsParticipationDto, {
    suitableFor: ["families"],
    notSuitableFor: ["families"],
  });
  const errors = await validate(dto);
  assert.ok(errors.length > 0, "expected at least one validation error");
  const flat = errors.flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
  assert.ok(flat.some((m) => typeof m === "string" && m.includes("families")), "expected overlap message");
});

test("TripDetailsParticipationDto: disjoint audience lists pass", async () => {
  const dto = plainToInstance(TripDetailsParticipationDto, {
    suitableFor: ["families"],
    notSuitableFor: ["seniors"],
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
});

test("TripDetailsParticipationDto: normalize drops unknown audience tokens", async () => {
  const dto = plainToInstance(TripDetailsParticipationDto, {
    suitableFor: ["families", "not_a_real_group"],
    notSuitableFor: [],
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.deepEqual(dto.suitableFor, ["families"]);
});

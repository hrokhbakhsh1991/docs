import test from "node:test";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
  TripDetailsDayPlanDto,
  TripDetailsLogisticsDto,
  TripDetailsOverviewDto,
  TripDetailsParticipationDto,
} from "./trip-details.dto";

test("TripDetailsOverviewDto: accepts denaliTourKind", async () => {
  const dto = plainToInstance(TripDetailsOverviewDto, {
    denaliTourKind: "mountain_day",
    shortIntro: "Denali day hike",
  });
  const errors = await validate(dto);
  assert.deepEqual(errors, []);
  assert.equal(dto.denaliTourKind, "mountain_day");
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

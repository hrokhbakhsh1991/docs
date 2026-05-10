import test from "node:test";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { TripDetailsParticipationDto } from "./trip-details.dto";

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

import test from "node:test";
import assert from "node:assert/strict";
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateTourDto, TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "./create-tour.dto";

const validBase = {
  total_capacity: 10,
  lifecycle_status: "Draft" as const
};

async function validatePayload(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateTourDto, payload);
  return validate(dto, { whitelist: true });
}

test("CreateTourDto rejects titles shorter than the minimum length", async () => {
  const errors = await validatePayload({ ...validBase, title: "Short" });
  const titleError = errors.find((e) => e.property === "title");
  assert.ok(titleError, "expected a title validation error");
  assert.match(JSON.stringify(titleError?.constraints ?? {}), /Title must be between/);
});

test("CreateTourDto rejects titles longer than the maximum length", async () => {
  const overlong = "x".repeat(TOUR_TITLE_MAX_LENGTH + 1);
  const errors = await validatePayload({ ...validBase, title: overlong });
  const titleError = errors.find((e) => e.property === "title");
  assert.ok(titleError, "expected a title validation error");
  assert.match(JSON.stringify(titleError?.constraints ?? {}), /Title must be between/);
});

test("CreateTourDto trims surrounding whitespace before length checks", async () => {
  const padded = `   ${"a".repeat(TOUR_TITLE_MIN_LENGTH)}   `;
  const errors = await validatePayload({ ...validBase, title: padded });
  const titleError = errors.find((e) => e.property === "title");
  assert.equal(titleError, undefined);
});

test("CreateTourDto accepts titles within the configured length window", async () => {
  const errors = await validatePayload({
    ...validBase,
    title: "Damavand summit — 2-day climb from south face"
  });
  const titleError = errors.find((e) => e.property === "title");
  assert.equal(titleError, undefined);
  assert.equal(TOUR_TITLE_MIN_LENGTH, 10);
  assert.equal(TOUR_TITLE_MAX_LENGTH, 120);
});

const validTitle = `${"a".repeat(TOUR_TITLE_MIN_LENGTH)} title here`;

test("CreateTourDto accepts transportModes as a multi-select array", async () => {
  const dto = plainToInstance(CreateTourDto, {
    ...validBase,
    title: validTitle,
    transportModes: ["train", "bus"],
  });
  const errors = await validate(dto, { whitelist: true });
  assert.equal(errors.find((e) => e.property === "transportModes"), undefined);
  assert.deepEqual(dto.transportModes, ["bus", "train"]);
});

test("CreateTourDto rejects duplicate transportModes", async () => {
  const dto = plainToInstance(CreateTourDto, {
    ...validBase,
    title: validTitle,
    transportModes: ["bus", "bus"],
  });
  const errors = await validate(dto, { whitelist: true });
  assert.ok(errors.some((e) => e.property === "transportModes"));
});

test("CreateTourDto rejects unknown transportModes entries", async () => {
  const dto = plainToInstance(CreateTourDto, {
    ...validBase,
    title: validTitle,
    transportModes: ["bus", "spaceship"],
  });
  const errors = await validate(dto, { whitelist: true });
  assert.ok(errors.some((e) => e.property === "transportModes"));
});

test("CreateTourDto accepts durationDays within the 1..60 window", async () => {
  const dto = plainToInstance(CreateTourDto, {
    ...validBase,
    title: validTitle,
    durationDays: 3,
  });
  const errors = await validate(dto, { whitelist: true });
  assert.equal(errors.find((e) => e.property === "durationDays"), undefined);
});

test("CreateTourDto rejects durationDays below 1", async () => {
  const dto = plainToInstance(CreateTourDto, {
    ...validBase,
    title: validTitle,
    durationDays: 0,
  });
  const errors = await validate(dto, { whitelist: true });
  assert.ok(errors.some((e) => e.property === "durationDays"));
});

test("CreateTourDto rejects durationDays above 60", async () => {
  const dto = plainToInstance(CreateTourDto, {
    ...validBase,
    title: validTitle,
    durationDays: 61,
  });
  const errors = await validate(dto, { whitelist: true });
  assert.ok(errors.some((e) => e.property === "durationDays"));
});

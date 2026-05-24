import assert from "node:assert/strict";
import test from "node:test";

import { buildRegistrationIntakeSchema } from "./buildRegistrationIntakeSchema";

const messages = {
  fullNameRequired: "name required",
  phoneRequired: "phone required",
  phoneTooLong: "phone too long",
  phoneFormat: "phone format",
  nationalIdRequired: "national id required",
  nationalIdInvalid: "national id invalid",
  peaksRequired: "peaks required",
  seatOnlySelfVehicle: "seat only self vehicle",
  seatRange: "seat range",
  isDriverRequired: "is driver required",
  plateNumberRequired: "plate number required",
  shareFuelCostRequired: "share fuel cost required",
  privateCarNotAllowedOnTour: "private car not allowed",
  personalInsuranceRequired: "insurance required",
};

const basePolicy = {
  nationalIdRequired: false,
  profileNationalIdPresent: false,
  personalInsuranceRequired: false,
  requirePeakHistory: false,
  allowPrivateCar: false,
};

const base = {
  bookingTarget: "guest" as const,
  participantFullName: "Ali",
  participantContactPhone: "09121234567",
  participantNationalId: "",
  transportMode: "group_vehicle" as const,
  userPastPeaksCount: 0,
};

test("guest national id required when tour policy is on", () => {
  const schema = buildRegistrationIntakeSchema(
    { ...basePolicy, nationalIdRequired: true },
    messages,
  );
  const missing = schema.safeParse({ ...base, participantNationalId: "" });
  assert.equal(missing.success, false);
  if (!missing.success) {
    assert.equal(missing.error.issues[0]?.path[0], "participantNationalId");
  }
});

test("self booking skips intake national id when profile already has national id", () => {
  const schema = buildRegistrationIntakeSchema(
    { ...basePolicy, nationalIdRequired: true, profileNationalIdPresent: true },
    messages,
  );
  const result = schema.safeParse({
    ...base,
    bookingTarget: "self",
    participantNationalId: "",
  });
  assert.equal(result.success, true);
});

test("self booking requires national id when profile is missing it", () => {
  const schema = buildRegistrationIntakeSchema(
    { ...basePolicy, nationalIdRequired: true, profileNationalIdPresent: false },
    messages,
  );
  const missing = schema.safeParse({
    ...base,
    bookingTarget: "self",
    participantNationalId: "",
  });
  assert.equal(missing.success, false);
  if (!missing.success) {
    assert.equal(missing.error.issues[0]?.path[0], "participantNationalId");
  }
});

test("peak history required when policy flag is on", () => {
  const schema = buildRegistrationIntakeSchema(
    { ...basePolicy, requirePeakHistory: true },
    messages,
  );
  const missing = schema.safeParse({ ...base, userPastPeaksCount: undefined });
  assert.equal(missing.success, false);
});

test("rejects self_vehicle when allowPrivateCar is false", () => {
  const schema = buildRegistrationIntakeSchema(basePolicy, messages);
  const result = schema.safeParse({
    ...base,
    transportMode: "self_vehicle",
    isDriver: true,
    plateNumber: "12ج345",
    vehicleSeatCapacity: 2,
  });
  assert.equal(result.success, false);
});

test("allows driver plate and seats when allowPrivateCar is true", () => {
  const schema = buildRegistrationIntakeSchema(
    { ...basePolicy, allowPrivateCar: true },
    messages,
  );
  const result = schema.safeParse({
    ...base,
    transportMode: "self_vehicle",
    isDriver: true,
    plateNumber: "12ج345",
    vehicleSeatCapacity: 2,
  });
  assert.equal(result.success, true);
});

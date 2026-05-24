import assert from "node:assert/strict";
import test from "node:test";

import {
  guestIntakeDefaults,
  intakeDefaultsForTarget,
  selfIntakeFromProfile,
} from "./mapMeToIntakePrefill";

test("guestIntakeDefaults clears participant identity fields", () => {
  const values = guestIntakeDefaults();
  assert.equal(values.bookingTarget, "guest");
  assert.equal(values.participantFullName, "");
  assert.equal(values.participantContactPhone, "");
  assert.equal(values.participantNationalId, "");
});

test("selfIntakeFromProfile maps profile fields", () => {
  const values = selfIntakeFromProfile({
    full_name: "  Ali Ahmadi  ",
    phone: " 09121234567 ",
    national_id: "1234567890",
  });
  assert.equal(values.bookingTarget, "self");
  assert.equal(values.participantFullName, "Ali Ahmadi");
  assert.equal(values.participantContactPhone, "09121234567");
  assert.equal(values.participantNationalId, "1234567890");
});

test("intakeDefaultsForTarget switches between self and guest", () => {
  const me = { full_name: "Sara", phone: "09120000000", national_id: null };
  assert.equal(intakeDefaultsForTarget("self", me).participantFullName, "Sara");
  assert.equal(intakeDefaultsForTarget("guest", me).participantFullName, "");
});

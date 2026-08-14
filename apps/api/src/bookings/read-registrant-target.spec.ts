import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isOwnedActiveOtherReclassifyCandidate, readRegistrantTargetFromIntake } from "./read-registrant-target.js";

describe("readRegistrantTargetFromIntake", () => {
  it("defaults missing intake to self", () => {
    assert.equal(readRegistrantTargetFromIntake(undefined), "self");
    assert.equal(readRegistrantTargetFromIntake(null), "self");
    assert.equal(readRegistrantTargetFromIntake({}), "self");
  });

  it("reads other when intake says other", () => {
    assert.equal(readRegistrantTargetFromIntake({ registrantTarget: "other" }), "other");
  });

  it("treats unknown values as self", () => {
    assert.equal(readRegistrantTargetFromIntake({ registrantTarget: "guest" }), "self");
    assert.equal(readRegistrantTargetFromIntake({ registrantTarget: "self" }), "self");
  });
});

describe("isOwnedActiveOtherReclassifyCandidate", () => {
  it("accepts owned active other only", () => {
    assert.equal(
      isOwnedActiveOtherReclassifyCandidate({
        submittedByUserId: "u1",
        expectedSubmitterId: "u1",
        status: "pending",
        registrationIntake: { registrantTarget: "other" },
      }),
      true
    );
    assert.equal(
      isOwnedActiveOtherReclassifyCandidate({
        submittedByUserId: "u1",
        expectedSubmitterId: "u2",
        status: "pending",
        registrationIntake: { registrantTarget: "other" },
      }),
      false
    );
    assert.equal(
      isOwnedActiveOtherReclassifyCandidate({
        submittedByUserId: "u1",
        expectedSubmitterId: "u1",
        status: "cancelled",
        registrationIntake: { registrantTarget: "other" },
      }),
      false
    );
    assert.equal(
      isOwnedActiveOtherReclassifyCandidate({
        submittedByUserId: "u1",
        expectedSubmitterId: "u1",
        status: "pending",
        registrationIntake: { registrantTarget: "self" },
      }),
      false
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasKnownIntakeName,
  resolveIntakeDefaults,
} from "../src/catalog/resolve-intake-defaults";

describe("resolve-intake-defaults", () => {
  it("prefers profile display name over session", () => {
    assert.deepEqual(
      resolveIntakeDefaults({
        profileDisplayName: "Profile Name",
        sessionDisplayName: "Session Name",
      }),
      { name: "Profile Name", nationalId: "", fatherName: "", birthDate: "" }
    );
  });

  it("falls back to session display name", () => {
    assert.deepEqual(
      resolveIntakeDefaults({
        sessionDisplayName: "Session Name",
        sessionNationalId: "1234567890",
        sessionFatherName: "Reza",
        sessionBirthDate: "1990-01-01",
      }),
      {
        name: "Session Name",
        nationalId: "1234567890",
        fatherName: "Reza",
        birthDate: "1990-01-01",
      }
    );
  });

  it("other registrant target clears defaults", () => {
    assert.deepEqual(
      resolveIntakeDefaults({
        profileDisplayName: "Profile Name",
        sessionDisplayName: "Session Name",
        registrantTarget: "other",
      }),
      { name: "", nationalId: "", fatherName: "", birthDate: "" }
    );
  });

  it("hasKnownIntakeName detects non-empty trimmed name", () => {
    assert.equal(hasKnownIntakeName("  Ali  "), true);
    assert.equal(hasKnownIntakeName("   "), false);
  });
});

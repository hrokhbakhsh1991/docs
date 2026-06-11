import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveIntakeDefaults } from "../src/catalog/resolve-intake-defaults";

describe("resolve-intake-defaults.spec.ts", () => {
  it("INTAKE-01 prefers profile fields over session", () => {
    const result = resolveIntakeDefaults({
      profileDisplayName: "Profile Name",
      profileEmail: "profile@example.com",
      sessionDisplayName: "Session Name",
      sessionEmail: "session@example.com",
    });
    assert.equal(result.name, "Profile Name");
    assert.equal(result.email, "profile@example.com");
  });

  it("INTAKE-02 falls back to session for returning user", () => {
    const result = resolveIntakeDefaults({
      sessionDisplayName: "Smoke Member",
      sessionEmail: "member@example.com",
    });
    assert.equal(result.name, "Smoke Member");
    assert.equal(result.email, "member@example.com");
  });

  it("INTAKE-03 profile email pre-fills intake when session email absent", () => {
    const result = resolveIntakeDefaults({
      profileDisplayName: "New Guest",
      profileEmail: "guest@example.com",
      sessionDisplayName: "New Guest",
      sessionEmail: null,
    });
    assert.equal(result.email, "guest@example.com");
  });
});

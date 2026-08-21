import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantBrandingDisplayName } from "../src/theme/tenant-branding-resolver";

describe("tenant-branding-resolver", () => {
  it("prefers fa localized displayName for fa locale", () => {
    const title = resolveTenantBrandingDisplayName(
      { displayNameFa: "دنالی", displayNameEn: "Denali" },
      "fa",
      "Workspace"
    );
    assert.equal(title, "دنالی");
  });

  it("prefers en localized displayName for en locale", () => {
    const title = resolveTenantBrandingDisplayName(
      { displayNameFa: "دنالی", displayNameEn: "Denali" },
      "en",
      "Workspace"
    );
    assert.equal(title, "Denali");
  });

  it("falls back across localized values then legacy then workspace label", () => {
    assert.equal(
      resolveTenantBrandingDisplayName({ displayNameEn: "Denali" }, "fa", "Workspace"),
      "Denali"
    );
    assert.equal(
      resolveTenantBrandingDisplayName({ displayNameFa: "دنالی" }, "en", "Workspace"),
      "دنالی"
    );
    assert.equal(
      resolveTenantBrandingDisplayName({ displayName: "Legacy" }, "fa", "Workspace"),
      "Legacy"
    );
    assert.equal(resolveTenantBrandingDisplayName({}, "en", "Workspace"), "Workspace");
  });
});

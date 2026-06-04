import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseWorkspaceTenantLabelFromHost,
  resolveWorkspaceSlugFromNormalizedHost,
} from "../src/index";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

describe("parseWorkspaceTenantLabelFromHost", () => {
  it("returns label for tenant subdomain", () => {
    const outcome = parseWorkspaceTenantLabelFromHost(
      "acme.localhost",
      "localhost",
      reserved,
    );
    assert.equal(outcome.kind, "label");
    if (outcome.kind === "label") {
      assert.equal(outcome.label, "acme");
    }
  });

  it("rejects reserved api label", () => {
    const outcome = parseWorkspaceTenantLabelFromHost(
      "api.localhost",
      "localhost",
      reserved,
    );
    assert.equal(outcome.kind, "reserved");
  });

  it("resolveWorkspaceSlug returns null for reserved", () => {
    assert.equal(
      resolveWorkspaceSlugFromNormalizedHost("api.localhost", "localhost", reserved),
      null,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseWorkspaceTenantLabelFromHost,
  RLS_TENANT_SETTING,
  SET_LOCAL_RLS_TENANT_SQL,
} from "../src/index";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

/**
 * Phase 4 contract — host ingress + RLS constants (P4-E-HOST-01, P4-E-RLS-02).
 */
describe("phase-4.contract (tenant-kernel)", () => {
  it("P4-E-HOST-01: reserved subdomain is not a tenant label", () => {
    for (const label of ["api", "www", "admin"] as const) {
      const outcome = parseWorkspaceTenantLabelFromHost(
        `${label}.localhost`,
        "localhost",
        reserved,
      );
      assert.notEqual(outcome.kind, "label");
    }
  });

  it("P4-E-HOST-01: valid tenant label parses", () => {
    const outcome = parseWorkspaceTenantLabelFromHost(
      "tenant-a.localhost",
      "localhost",
      reserved,
    );
    assert.deepEqual(outcome, { kind: "label", label: "tenant-a" });
  });

  it("P4-E-RLS-02: set_config uses transaction-local third argument", () => {
    assert.match(SET_LOCAL_RLS_TENANT_SQL, /set_config/);
    assert.equal(RLS_TENANT_SETTING, "app.current_tenant_id");
  });

  it("adversarial: apex host is not a workspace label", () => {
    assert.equal(
      parseWorkspaceTenantLabelFromHost("localhost", "localhost", reserved).kind,
      "apex",
    );
  });
});

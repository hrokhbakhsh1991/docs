import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { assertTenantId } from "../../../src/utils/rule-context-tenant.js";
import { buildRuleContextScopeKey } from "../../../src/utils/rule-context-scope-key.js";
import { normalizeRuleContext } from "../../../src/utils/rule-context.js";

describe("assertTenantId", () => {
  it("rejects leading whitespace consistently for normalize and scope keys", () => {
    const context = { tenantId: " bad", dimensions: { variant: "default" } };
    assert.throws(() => assertTenantId(context), (error: unknown) => {
      assert.ok(error instanceof PlatformCoreError);
      assert.equal(error.code, "TENANT_ISOLATION_VIOLATION");
      return true;
    });
    assert.throws(() => normalizeRuleContext(context), PlatformCoreError);
    assert.throws(
      () => buildRuleContextScopeKey(context, ["variant"]),
      PlatformCoreError,
    );
  });

  it("rejects invalid tenant token format", () => {
    assert.throws(
      () => assertTenantId({ tenantId: "bad tenant!", dimensions: {} }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_CONTEXT");
        return true;
      },
    );
  });
});

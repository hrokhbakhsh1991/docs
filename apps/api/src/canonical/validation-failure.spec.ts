import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashTenantIdForLog } from "../observability/log-safety";
import { runWithTraceContext } from "../observability/trace-request-context";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";
import {
  ValidationFailure,
  enrichValidationFailure,
  toValidationFailureLogFields,
} from "./validation-failure";

describe("validation-failure log safety (LOG-COL-06 / DEC-038)", () => {
  it("toValidationFailureLogFields exposes codes and hash only", async () => {
    const tenantId = integrationTenantId();
    const correlationId = "corr-validation-log";

    const failure = await runWithTraceContext(correlationId, async () =>
      runWithTenantContext(tenantId, async () =>
        enrichValidationFailure(
          new ValidationFailure("CANONICAL_VALIDATION_FAILED: basics.title required", "detail")
        )
      )
    );

    const fields = toValidationFailureLogFields(failure);
    assert.equal(fields.event, "client.validation_failed");
    assert.equal(fields.error_code, "VALIDATION_FAILURE");
    assert.equal(fields.tenant_hash, hashTenantIdForLog(tenantId));
    assert.equal(fields.correlation_id, correlationId);
    assert.equal(fields.message, undefined);
    assert.equal(fields.detail, undefined);
    assert.equal(fields.tenant_id, undefined);
    assert.equal(fields.tenantId, undefined);
  });
});

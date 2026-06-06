import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashTenantIdForLog } from "../observability/log-safety";
import { runWithTraceContext } from "../observability/trace-request-context";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";
import {
  SchemaVersionMismatchError,
  toSchemaVersionMismatchLogFields,
} from "./schema-version-mismatch";

describe("schema-version-mismatch log safety (LOG-COL-07 / DEC-038)", () => {
  it("toSchemaVersionMismatchLogFields exposes codes and hash only", async () => {
    const tenantId = integrationTenantId();
    const correlationId = "corr-schema-mismatch";

    const error = await runWithTraceContext(correlationId, async () =>
      runWithTenantContext(tenantId, async () => {
        const mismatch = new SchemaVersionMismatchError(99, 1);
        mismatch.tenant_id = tenantId;
        mismatch.tenantId = tenantId;
        mismatch.correlation_id = correlationId;
        mismatch.correlationId = correlationId;
        return mismatch;
      })
    );

    const fields = toSchemaVersionMismatchLogFields(error);
    assert.equal(fields.event, "client.schema_version_mismatch");
    assert.equal(fields.error_code, "SCHEMA_VERSION_MISMATCH");
    assert.equal(fields.tenant_hash, hashTenantIdForLog(tenantId));
    assert.equal(fields.correlation_id, correlationId);
    assert.equal(fields.message, undefined);
    assert.equal(fields.requestedVersion, undefined);
    assert.equal(fields.currentVersion, undefined);
    assert.equal(fields.tenant_id, undefined);
  });
});

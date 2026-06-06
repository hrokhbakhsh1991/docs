import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { logger } from "../observability/logger";
import { PROJECTION_HANDLER_FAILED } from "../observability/log-safety";
import {
  recordProjectionInconsistency,
  resetProjectionInconsistencySignalsForTests,
} from "./projection-reconciliation";
import { integrationTenantId } from "../../test/test-helpers";

type CapturedLogRecord = Record<string, unknown>;

function captureWarnLog(run: () => void): CapturedLogRecord[] {
  const records: CapturedLogRecord[] = [];
  const original = logger.warn.bind(logger);
  logger.warn = ((...args: unknown[]) => {
    if (typeof args[0] === "object" && args[0] !== null) {
      records.push(args[0] as CapturedLogRecord);
    }
    return original(...args);
  }) as typeof logger.warn;
  try {
    run();
  } finally {
    logger.warn = original;
  }
  return records;
}

describe("projection-reconciliation log privacy (LOG-COL-02)", () => {
  it("recordProjectionInconsistency logs tenant_hash and reason_code only", () => {
    resetProjectionInconsistencySignalsForTests();
    const tenantId = integrationTenantId();
    const domainEventId = "00000000-0000-4000-8000-000000000099";
    const tourId = "00000000-0000-4000-8000-000000000088";
    const diagnosticReason = "READ_MODEL_PROJECTION_FAILED";

    const records = captureWarnLog(() => {
      recordProjectionInconsistency({
        tenantId,
        domainEventId,
        tourId,
        reasonCode: PROJECTION_HANDLER_FAILED,
        reason: diagnosticReason,
      });
    });

    assert.equal(records.length, 1);
    const record = records[0]!;
    assert.equal(record.event, "projection.inconsistency");
    assert.equal(record.reason_code, PROJECTION_HANDLER_FAILED);
    assert.equal(record.domain_event_id, domainEventId);
    assert.ok(typeof record.tenant_hash === "string");
    assert.notEqual(record.tenant_hash, tenantId);
    assert.equal(record.tenantId, undefined);
    assert.equal(record.tenant_id, undefined);
    assert.equal(record.tourId, undefined);
    assert.equal(record.reason, undefined);
    assert.equal(record.message, undefined);
  });
});

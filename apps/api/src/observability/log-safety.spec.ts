import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INTERNAL_ERROR,
  OUTBOX_RELAY_TICK_FAILED,
  PROJECTION_HANDLER_FAILED,
  hashTenantIdForLog,
  normalizeHttpLogPath,
  resolveInternalErrorCode,
  resolveOutboxRelayErrorCode,
  resolveProjectionReasonCode,
} from "./log-safety";
import { integrationTenantId } from "../../test/test-helpers";

describe("log-safety (DEC-037)", () => {
  it("hashTenantIdForLog is stable and not equal to raw tenant id", () => {
    const tenantId = integrationTenantId();
    const hash1 = hashTenantIdForLog(tenantId);
    const hash2 = hashTenantIdForLog(tenantId);
    assert.equal(hash1, hash2);
    assert.notEqual(hash1, tenantId);
    assert.match(hash1 ?? "", /^[a-f0-9]{64}$/);
  });

  it("hashTenantIdForLog returns undefined for empty input", () => {
    assert.equal(hashTenantIdForLog(undefined), undefined);
    assert.equal(hashTenantIdForLog(""), undefined);
  });

  it("resolveInternalErrorCode maps known errors and defaults to INTERNAL_ERROR", () => {
    assert.equal(
      resolveInternalErrorCode(new Error("WORKSPACE_PLUGIN_NOT_FOUND")),
      "WORKSPACE_PLUGIN_NOT_FOUND"
    );
    assert.equal(
      resolveInternalErrorCode(new Error("simulated prisma fault at SELECT * FROM tours")),
      INTERNAL_ERROR
    );
  });

  it("resolveProjectionReasonCode is always stable", () => {
    assert.equal(
      resolveProjectionReasonCode(new Error("user plugin message leak")),
      PROJECTION_HANDLER_FAILED
    );
  });

  it("normalizeHttpLogPath strips query and redacts UUID segments (LOG-COL-08)", () => {
    const tourId = "a0000000-0000-4000-8000-000000000099";
    assert.equal(normalizeHttpLogPath(`/tours/${tourId}?token=secret`), "/tours/:id");
    assert.equal(normalizeHttpLogPath("/health"), "/health");
  });

  it("resolveOutboxRelayErrorCode maps to stable codes (LOG-COL-09)", () => {
    assert.equal(
      resolveOutboxRelayErrorCode(new Error("simulated prisma fault")),
      OUTBOX_RELAY_TICK_FAILED
    );
    assert.equal(resolveOutboxRelayErrorCode(new Error("DB_POOL_SATURATED")), "DB_POOL_SATURATED");
  });
});

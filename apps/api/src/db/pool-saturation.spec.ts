import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DbPoolSaturatedError,
  asDbPoolSaturatedError,
  isDbPoolSaturatedError,
  isPoolSaturationError,
  resolvePoolSaturationRetryAfterSec,
} from "./pool-saturation";

describe("pool-saturation (DEC-012 / DEC-113)", () => {
  it("isPoolSaturationError matches Prisma pool timeout message", () => {
    assert.equal(
      isPoolSaturationError(
        new Error("Timed out fetching a new connection from the connection pool")
      ),
      true
    );
  });

  it("asDbPoolSaturatedError returns typed error with code prefix", () => {
    const error = asDbPoolSaturatedError(new Error("Timed out fetching"));
    assert.ok(error instanceof DbPoolSaturatedError);
    assert.match(error.message, /^DB_POOL_SATURATED:/);
    assert.equal(error.code, "DB_POOL_SATURATED");
  });

  it("isDbPoolSaturatedError accepts legacy message-only errors", () => {
    assert.equal(isDbPoolSaturatedError(new Error("DB_POOL_SATURATED: legacy")), true);
  });

  it("resolvePoolSaturationRetryAfterSec defaults to 2", () => {
    const prior = process.env.DB_POOL_SATURATED_RETRY_AFTER_SEC;
    delete process.env.DB_POOL_SATURATED_RETRY_AFTER_SEC;
    assert.equal(resolvePoolSaturationRetryAfterSec(), 2);
    process.env.DB_POOL_SATURATED_RETRY_AFTER_SEC = prior;
  });
});

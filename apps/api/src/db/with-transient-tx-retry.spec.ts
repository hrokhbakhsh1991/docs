import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";

import { resetDbCircuitBreakerForTests } from "./db-circuit-breaker";
import {
  resolveCanonicalTxTransientRetryAttempts,
  withTransientTxRetry,
} from "./with-transient-tx-retry";

function p1001(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("can't reach database server", {
    code: "P1001",
    clientVersion: "6.0.0",
  });
}

describe("withTransientTxRetry (DEC-112)", () => {
  it("resolveCanonicalTxTransientRetryAttempts defaults to 2", () => {
    const prior = process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS;
    delete process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS;
    assert.equal(resolveCanonicalTxTransientRetryAttempts(), 2);
    process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS = prior;
  });

  it("retries whole run on transient error then succeeds", async () => {
    resetDbCircuitBreakerForTests();
    let calls = 0;
    const result = await withTransientTxRetry(async () => {
      calls += 1;
      if (calls < 3) {
        throw p1001();
      }
      return "ok";
    });
    assert.equal(result, "ok");
    assert.equal(calls, 3);
  });

  it("does not retry non-transient errors", async () => {
    resetDbCircuitBreakerForTests();
    let calls = 0;
    await assert.rejects(
      () =>
        withTransientTxRetry(async () => {
          calls += 1;
          throw new Error("CANONICAL_TX_VALIDATION_GATE_REQUIRED");
        }),
      /CANONICAL_TX_VALIDATION_GATE_REQUIRED/
    );
    assert.equal(calls, 1);
  });

  it("throws DB_TRANSIENT_UNAVAILABLE after retry budget exhausted", async () => {
    resetDbCircuitBreakerForTests();
    const prior = process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS;
    process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS = "1";
    try {
      await assert.rejects(
        () =>
          withTransientTxRetry(async () => {
            throw p1001();
          }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /^DB_TRANSIENT_UNAVAILABLE:/);
          return true;
        }
      );
    } finally {
      if (prior === undefined) {
        delete process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS;
      } else {
        process.env.CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS = prior;
      }
    }
  });
});

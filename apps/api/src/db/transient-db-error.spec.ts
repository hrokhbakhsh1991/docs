import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";

import {
  DbCircuitOpenError,
  asTransientDbServiceUnavailableError,
  isTransientDbError,
} from "./transient-db-error";
import {
  assertDbCircuitClosed,
  isDbCircuitOpen,
  recordDbTransientFailure,
  resetDbCircuitBreakerForTests,
} from "./db-circuit-breaker";

describe("transient-db-error (DEC-094)", () => {
  it("classifies Prisma P1001/P1017 as transient", () => {
    const p1001 = new Prisma.PrismaClientKnownRequestError("can't reach database server", {
      code: "P1001",
      clientVersion: "6.0.0",
    });
    assert.equal(isTransientDbError(p1001), true);

    const p1017 = new Prisma.PrismaClientKnownRequestError("connection closed", {
      code: "P1017",
      clientVersion: "6.0.0",
    });
    assert.equal(isTransientDbError(p1017), true);
  });

  it("excludes P2002 uniqueness conflicts", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "6.0.0",
    });
    assert.equal(isTransientDbError(p2002), false);
  });

  it("maps transient errors to DB_TRANSIENT_UNAVAILABLE prefix", () => {
    const wrapped = asTransientDbServiceUnavailableError(new Error("ETIMEDOUT"));
    assert.match(wrapped.message, /^DB_TRANSIENT_UNAVAILABLE:/);
  });

  it("opens circuit after three transient failures", () => {
    resetDbCircuitBreakerForTests();
    recordDbTransientFailure(1_000);
    recordDbTransientFailure(2_000);
    assert.equal(isDbCircuitOpen(2_500), false);
    recordDbTransientFailure(3_000);
    assert.equal(isDbCircuitOpen(3_500), true);
    assert.throws(() => assertDbCircuitClosed(3_500), DbCircuitOpenError);
  });
});

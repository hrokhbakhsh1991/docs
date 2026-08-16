import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { describe, it } from "node:test";

import { DATABASE_UNAVAILABLE, isDatabaseConnectionError } from "./database-connection-error";

describe("database-connection-error (API-DB-CONN-01)", () => {
  it("API-DB-CONN-01 maps Prisma P1000 to connection error", () => {
    const Ctor = Prisma.PrismaClientKnownRequestError;
    if (typeof Ctor !== "function") {
      assert.equal(isDatabaseConnectionError(new Error("auth failed")), false);
      return;
    }
    const error = new Ctor("auth failed", {
      code: "P1000",
      clientVersion: "test",
    });
    assert.equal(isDatabaseConnectionError(error), true);
  });

  it("API-DB-CONN-02 maps password authentication message", () => {
    assert.equal(
      isDatabaseConnectionError(new Error("password authentication failed for user app_tour")),
      true
    );
  });

  it("API-DB-CONN-03 does not classify generic transient timeout as auth failure", () => {
    assert.equal(isDatabaseConnectionError(new Error("ETIMEDOUT")), false);
  });

  it("API-DB-CONN-04 exposes stable DATABASE_UNAVAILABLE code constant", () => {
    assert.equal(DATABASE_UNAVAILABLE, "DATABASE_UNAVAILABLE");
  });

  it("API-DB-CONN-05 domain tokens are not connection errors and do not throw", () => {
    assert.equal(isDatabaseConnectionError(new Error("DENALI_REGISTRATION_INVALID")), false);
    assert.equal(isDatabaseConnectionError(new Error("BOOKING_GUEST_DUPLICATE")), false);
  });
});

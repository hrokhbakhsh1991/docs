import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPrismaErrorOfType, readPrismaErrorCode } from "./prisma-error-instance";

class FakePrismaKnownRequestError extends Error {
  readonly code = "P1000";
}

describe("isPrismaErrorOfType (API-DB-CONN-06)", () => {
  it("API-DB-CONN-06a returns false when the constructor is missing", () => {
    assert.equal(isPrismaErrorOfType(new Error("DOMAIN_TOKEN_NOT_PRISMA"), undefined), false);
    assert.equal(isPrismaErrorOfType(new Error("x"), null), false);
    assert.equal(isPrismaErrorOfType(new Error("x"), {}), false);
  });

  it("API-DB-CONN-06b matches only when ctor is a function", () => {
    const error = new FakePrismaKnownRequestError("auth failed");
    assert.equal(isPrismaErrorOfType(error, FakePrismaKnownRequestError), true);
    assert.equal(isPrismaErrorOfType(new Error("auth failed"), FakePrismaKnownRequestError), false);
  });

  it("API-DB-CONN-06c readPrismaErrorCode duck-reads string code", () => {
    assert.equal(readPrismaErrorCode(new FakePrismaKnownRequestError("auth failed")), "P1000");
    assert.equal(readPrismaErrorCode(new Error("x")), undefined);
    assert.equal(readPrismaErrorCode(null), undefined);
    assert.equal(readPrismaErrorCode({ code: 1000 }), undefined);
  });
});

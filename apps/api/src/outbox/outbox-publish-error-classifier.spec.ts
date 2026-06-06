import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";

import { DbCircuitOpenError } from "../db/transient-db-error";
import { classifyOutboxPublishError } from "./outbox-publish-error-classifier";

describe("classifyOutboxPublishError", () => {
  it("classifies OUTBOX_TENANT_PAYLOAD_MISMATCH as poison", () => {
    assert.equal(classifyOutboxPublishError(new Error("OUTBOX_TENANT_PAYLOAD_MISMATCH")), "poison");
  });

  it("classifies Prisma P1001 as transient", () => {
    const error = new Prisma.PrismaClientKnownRequestError("can't reach database server", {
      code: "P1001",
      clientVersion: "test",
    });
    assert.equal(classifyOutboxPublishError(error), "transient");
  });

  it("classifies DbCircuitOpenError as transient", () => {
    assert.equal(classifyOutboxPublishError(new DbCircuitOpenError()), "transient");
  });

  it("classifies ECONNRESET in cause chain as transient", () => {
    const inner = new Error("read ECONNRESET");
    const outer = new Error("publish failed", { cause: inner });
    assert.equal(classifyOutboxPublishError(outer), "transient");
  });

  it("defaults unknown errors to poison", () => {
    assert.equal(classifyOutboxPublishError(new Error("MYSTERY_HANDLER_CRASH")), "poison");
  });
});

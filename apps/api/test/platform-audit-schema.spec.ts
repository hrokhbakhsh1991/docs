import assert from "node:assert";
import { describe, it } from "node:test";
import { getPrismaAdmin } from "../src/db/prisma.ts";

describe("P1-N-054: PlatformAuditEvent schema", () => {
  it("should have platformAuditEvent model in Prisma client", () => {
    const prisma = getPrismaAdmin();

    assert.ok(
      prisma.platformAuditEvent,
      "PlatformAuditEvent model should exist in Prisma client"
    );

    assert.strictEqual(
      typeof prisma.platformAuditEvent.create,
      "function",
      "platformAuditEvent.create should be a function"
    );

    assert.strictEqual(
      typeof prisma.platformAuditEvent.findMany,
      "function",
      "platformAuditEvent.findMany should be a function"
    );
  });
});

// Made with Bob

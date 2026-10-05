import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./prisma-bookings.repository.ts", import.meta.url), "utf8");

describe("Prisma cancellation-work concurrency contract", () => {
  it("acquires a transaction-scoped per-registration lock before reading the snapshot", () => {
    const methodStart = source.indexOf("  async recordCancellationEffect(");
    const methodEnd = source.indexOf("\n  async ", methodStart + 1);
    const methodSource = source.slice(methodStart, methodEnd);
    const lockCall = methodSource.indexOf("await acquireBookingCancellationWorkLock(");
    const snapshotRead = methodSource.indexOf("tx.operatorRegistration.findFirst(");

    assert.ok(methodStart >= 0, "recordCancellationEffect must exist");
    assert.ok(lockCall >= 0, "recordCancellationEffect must acquire the work lock");
    assert.ok(snapshotRead > lockCall, "the lock must be acquired before the snapshot is read");
    assert.match(source, /SELECT pg_advisory_xact_lock\([\s\S]*md5\(\$\{lockKey\}\)/);
    assert.match(source, /booking-cancellation-work/);
  });
});

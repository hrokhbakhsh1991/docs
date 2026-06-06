import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dequeueProjectionAutoReconcileBatch,
  enqueueProjectionAutoReconcile,
  getProjectionReconcileQueueDepthForTests,
  resetProjectionReconcileQueueForTests,
} from "./projection-reconcile-queue";

describe("projection reconcile queue (DEC-115)", () => {
  it("dedupes identical tenant/tour tasks", () => {
    resetProjectionReconcileQueueForTests();
    enqueueProjectionAutoReconcile("tenant-a", "tour-1");
    enqueueProjectionAutoReconcile("tenant-a", "tour-1");
    assert.equal(getProjectionReconcileQueueDepthForTests(), 1);
  });

  it("dequeues batch in FIFO order", () => {
    resetProjectionReconcileQueueForTests();
    enqueueProjectionAutoReconcile("tenant-a");
    enqueueProjectionAutoReconcile("tenant-b", "tour-2");
    const batch = dequeueProjectionAutoReconcileBatch(2);
    assert.equal(batch.length, 2);
    assert.equal(batch[0]?.tenantId, "tenant-a");
    assert.equal(batch[1]?.tourId, "tour-2");
    assert.equal(getProjectionReconcileQueueDepthForTests(), 0);
  });
});

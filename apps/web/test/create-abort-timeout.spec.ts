import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createAbortTimeout } from "../src/utils/create-abort-timeout";

describe("createAbortTimeout", () => {
  const active: Array<ReturnType<typeof createAbortTimeout>> = [];
  afterEach(() => {
    for (const timeout of active.splice(0)) timeout.dispose();
  });

  it("aborts with a timeout reason when its deadline expires", async () => {
    const timeout = createAbortTimeout(5);
    active.push(timeout);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(timeout.signal.aborted, true);
    assert.equal(timeout.signal.reason.name, "TimeoutError");
    assert.equal(timeout.timedOut(), true);
  });

  it("disposes without reporting a timeout", () => {
    const timeout = createAbortTimeout(60_000);
    active.push(timeout);
    timeout.dispose();
    assert.equal(timeout.signal.aborted, true);
    assert.equal(timeout.timedOut(), false);
  });
});

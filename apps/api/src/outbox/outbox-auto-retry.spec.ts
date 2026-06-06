import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseOutboxPublishAttempts } from "./outbox-failed";

describe("outbox auto-retry helpers", () => {
  it("parseOutboxPublishAttempts returns 0 for missing lastError", () => {
    assert.equal(parseOutboxPublishAttempts(null), 0);
    assert.equal(parseOutboxPublishAttempts(undefined), 0);
  });

  it("parseOutboxPublishAttempts reads attempts from last_error JSON", () => {
    assert.equal(parseOutboxPublishAttempts({ code: "x", at: "t", attempts: 3 }), 3);
    assert.equal(parseOutboxPublishAttempts({ attempts: "bad" }), 0);
  });
});

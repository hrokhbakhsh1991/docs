/**
 * Phase 3.17 — production outbox replay safety helpers (no DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyReplayCandidateStatus,
  OUTBOX_REPLAY_BATCH_MAX,
  OUTBOX_REPLAY_CONFIRM_PHRASE,
  OutboxReplayConfirmRequiredError,
  OutboxReplayInputError,
} from "./outbox-prod-replay";

describe("outbox prod replay safety", () => {
  it("classifyReplayCandidateStatus is idempotent-friendly", () => {
    assert.equal(classifyReplayCandidateStatus("failed"), "would_replay");
    assert.equal(classifyReplayCandidateStatus("pending"), "skipped");
    assert.equal(classifyReplayCandidateStatus("done"), "skipped");
  });

  it("confirm phrase is REPLAY", () => {
    assert.equal(OUTBOX_REPLAY_CONFIRM_PHRASE, "REPLAY");
  });

  it("batch max is capped", () => {
    assert.equal(OUTBOX_REPLAY_BATCH_MAX, 500);
  });

  it("OutboxReplayConfirmRequiredError has stable code", () => {
    const err = new OutboxReplayConfirmRequiredError();
    assert.equal(err.code, "OUTBOX_REPLAY_CONFIRM_REQUIRED");
  });

  it("OutboxReplayInputError has stable code", () => {
    const err = new OutboxReplayInputError("batch requires tenantId");
    assert.equal(err.code, "OUTBOX_REPLAY_INPUT_INVALID");
  });
});

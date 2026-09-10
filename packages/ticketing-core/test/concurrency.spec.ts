/**
 * TKT-001 Phase 2 — concurrency tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertRowVersion,
  buildIdempotencyFingerprint,
  resolveDuplicateCommand,
} from "../src/index";
import { actor, TENANT_A } from "./helpers";

describe("ticketing-core concurrency", () => {
  it("accepts matching rowVersion", () => {
    assert.equal(assertRowVersion(2, 2).ok, true);
  });

  it("rejects stale rowVersion", () => {
    const result = assertRowVersion(2, 3);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "ROW_VERSION_CONFLICT");
  });

  it("builds stable idempotency fingerprint", () => {
    const fp = buildIdempotencyFingerprint({
      scope: "create",
      tenantId: TENANT_A,
      actorUserId: actor("member").userId,
      idempotencyKey: "idem-key-12345678",
    });
    assert.match(fp, /create:/);
  });

  it("detects duplicate command in set policy", () => {
    const seen = new Set<string>(["create:a:b:c"]);
    const dup = resolveDuplicateCommand("create:a:b:c", seen);
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.error.code, "DUPLICATE_COMMAND");
  });

  it("replays duplicate command from map policy", () => {
    const replay = { ticketId: "t-1" };
    const seen = new Map<string, typeof replay>([["create:a:b:c", replay]]);
    const result = resolveDuplicateCommand("create:a:b:c", seen);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value, replay);
  });
});

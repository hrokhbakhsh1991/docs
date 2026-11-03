import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePortalSessionProbe } from "../src/auth/marketing-session-sync";

describe("portal session probe contract", () => {
  it("accepts explicit authenticated and signed-out observations", () => {
    assert.equal(parsePortalSessionProbe({ ok: true, ready: true }), true);
    assert.equal(parsePortalSessionProbe({ ok: true, ready: false }), false);
  });
  it("keeps service errors and malformed data distinct from signed-out", () => {
    for (const value of [
      null,
      undefined,
      [],
      false,
      "false",
      {},
      { ok: false, ready: false },
      { ok: true, ready: "false" },
      { ready: false },
    ]) {
      assert.equal(parsePortalSessionProbe(value), null);
    }
  });
});

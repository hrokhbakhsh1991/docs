import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform audit actorId", () => {
  it("actorId non-empty", () => {
    const createSource = readFileSync(
      new URL("../src/routes/platform/tenants-create.ts", import.meta.url),
      "utf8"
    );
    assert.match(createSource, /actorId:\s*ctx\.actorId/);
    assert.doesNotMatch(createSource, /actorId:\s*"platform-ops"/);

    const sagaSource = readFileSync(
      new URL("../src/platform/provision-tenant-saga.ts", import.meta.url),
      "utf8"
    );
    assert.match(sagaSource, /actorId:\s*input\.actorId/);
    assert.match(sagaSource, /appendPlatformAuditEvent/);
  });
});

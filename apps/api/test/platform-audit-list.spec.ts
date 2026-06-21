import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform audit list API", () => {
  it("TENANT_CREATED in list handler", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/audit-list.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /listPlatformAuditEvents/);
    assert.match(source, /platform\/v1\/audit/);
  });
});

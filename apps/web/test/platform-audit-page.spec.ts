import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform audit page", () => {
  it("imports fetch via proxy", () => {
    const page = readFileSync(
      new URL("../app/(platform)/platform/audit/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(page, /proxyPlatformApi/);
    assert.match(page, /\/platform\/v1\/audit/);
    assert.match(page, /data-testid="platform-audit-page"/);
    assert.match(page, /data-testid="audit-row"/);
  });
});

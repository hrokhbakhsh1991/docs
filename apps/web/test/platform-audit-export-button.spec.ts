import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform audit export button", () => {
  it("audit page has download link", () => {
    const source = readFileSync(
      new URL("../app/(platform)/platform/audit/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-audit-export-download/);
    assert.match(source, /audit\/export/);
  });
});

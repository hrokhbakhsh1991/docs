import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("PlatformClubsTable", () => {
  const source = readFileSync(
    new URL("../src/platform/platform-clubs-table.tsx", import.meta.url),
    "utf8"
  );

  it("renders subdomain", () => {
    assert.match(source, /item\.subdomain/);
    assert.match(source, /key=\{item\.id\}/);
  });

  it("suspended badge", () => {
    assert.match(source, /item\.status === "suspended"/);
    assert.match(source, /text-destructive/);
  });
});

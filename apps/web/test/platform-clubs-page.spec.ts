import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform clubs page", () => {
  it("imports table", () => {
    const source = readFileSync(
      new URL("../app/(platform)/platform/clubs/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /PlatformClubsTable/);
  });

  it("new link", () => {
    const source = readFileSync(
      new URL("../app/(platform)/platform/clubs/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /\/platform\/clubs\/new/);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform login page", () => {
  it("host branch in shared auth login page", () => {
    const source = readFileSync(
      new URL("../app/auth/login/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /isPlatformAdminHost/);
    assert.match(source, /pluginId="platform"/);
  });

  it("no duplicate platform auth login route file", () => {
    let threw = false;
    try {
      readFileSync(new URL("../app/(platform)/auth/login/page.tsx", import.meta.url), "utf8");
    } catch {
      threw = true;
    }
    assert.equal(threw, true);
  });
});

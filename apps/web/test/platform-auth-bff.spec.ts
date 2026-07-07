import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform auth BFF", () => {
  it("login sets platform_session cookie", () => {
    const source = readFileSync(
      new URL("../app/api/platform/auth/login/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /buildPlatformSessionCookieHeader/);
    assert.match(source, /Set-Cookie/);
  });

  it("login route is POST", () => {
    const source = readFileSync(
      new URL("../app/api/platform/auth/login/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /export async function POST/);
  });
});

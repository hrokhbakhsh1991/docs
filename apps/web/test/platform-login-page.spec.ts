import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveRequestIngressHost } from "../src/tenant/platform-host-env";

describe("platform login page", () => {
  it("host branch in shared auth login page", () => {
    const source = readFileSync(
      new URL("../app/auth/login/page.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /isPlatformAdminHost/);
    assert.match(source, /resolveRequestIngressHost/);
    assert.match(source, /pluginId="platform"/);
  });

  it("uses the forwarded public host when Next receives an upstream host", () => {
    const headers = new Headers({
      host: "localhost:23000",
      "x-forwarded-host": "staging-platform-admin.shenski.com, localhost:23000",
    });

    assert.equal(
      resolveRequestIngressHost(headers, "localhost:3000"),
      "staging-platform-admin.shenski.com"
    );
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

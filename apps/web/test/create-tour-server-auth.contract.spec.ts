import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("create-tour-server-auth.contract.spec.ts", () => {
  it("createTourAction authenticates with session JWT (not env-only bootstrap headers)", () => {
    const source = readFileSync(new URL("../src/tours/create-tour.server.ts", import.meta.url), "utf8");
    assert.match(source, /readSessionTokenFromCookies/);
    assert.match(source, /Authorization:\s*`Bearer \$\{sessionToken\}`/);
    assert.doesNotMatch(source, /resolveBootstrapAppSession\(/);
    assert.doesNotMatch(source, /buildTourAuthHeaders/);
  });
});

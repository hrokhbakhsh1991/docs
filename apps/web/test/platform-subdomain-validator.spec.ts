import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateSubdomainClient } from "../src/platform/create-club/validate-subdomain";

describe("platform-subdomain-validator", () => {
  it("mirrors server regex", () => {
    assert.equal(validateSubdomainClient("a").ok, true);
    assert.equal(validateSubdomainClient("-bad").ok, false);
    assert.equal(validateSubdomainClient("bad-").ok, false);
  });

  it("reserved labels include admin", () => {
    assert.equal(validateSubdomainClient("admin").ok, false);
    assert.equal(validateSubdomainClient("internal").ok, false);
  });

  it("max length 63", () => {
    const long = "a".repeat(64);
    assert.equal(validateSubdomainClient(long).ok, false);
  });
});

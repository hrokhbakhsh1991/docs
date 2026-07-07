import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { supportsCatalogRegistration } from "../src/catalog/resolve-catalog-registration-support";

describe("resolve-catalog-registration-support", () => {
  it("SDK-REG-01 denali supports public registration", () => {
    assert.equal(supportsCatalogRegistration("denali"), true);
  });

  it("SDK-REG-02 urban supports public registration", () => {
    assert.equal(supportsCatalogRegistration("urban"), true);
  });

  it("SDK-REG-03 guest-club supports public registration", () => {
    assert.equal(supportsCatalogRegistration("guest-club"), true);
  });

  it("SDK-REG-04 starter does not support registration", () => {
    assert.equal(supportsCatalogRegistration("starter"), false);
  });

  it("SDK-REG-05 unknown plugin does not support registration", () => {
    assert.equal(supportsCatalogRegistration("unknown-workspace"), false);
  });
});

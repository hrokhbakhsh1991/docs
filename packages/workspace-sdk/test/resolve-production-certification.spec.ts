import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ProductionCertificationNotConfiguredError,
  resolveProductionCertificationForPlugin,
} from "../src/catalog/resolve-production-certification";

describe("resolveProductionCertificationForPlugin", () => {
  it("resolves trunk workspace tiers", () => {
    assert.equal(resolveProductionCertificationForPlugin("denali"), "certified");
    assert.equal(resolveProductionCertificationForPlugin("urban"), "stub");
    assert.equal(resolveProductionCertificationForPlugin("guest-club"), "stub");
    assert.equal(resolveProductionCertificationForPlugin("starter"), "stub");
  });

  it("throws when plugin id is missing from registry", () => {
    assert.throws(
      () => resolveProductionCertificationForPlugin("missing"),
      ProductionCertificationNotConfiguredError
    );
  });
});

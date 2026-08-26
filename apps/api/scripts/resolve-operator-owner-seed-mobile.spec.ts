import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  resolveOperatorOwnerSeedMobile,
  resolveOperatorSmokeOwnerSeedMobile,
} from "./resolve-operator-owner-seed-mobile.ts";

describe("resolve-operator-owner-seed-mobile.spec.ts", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("SEED-MOB-01 OPERATOR_OWNER_MOBILE canonicalizes to 09 for both seeds", () => {
    process.env.OPERATOR_OWNER_MOBILE = "+989174070937";
    assert.equal(resolveOperatorOwnerSeedMobile(), "09174070937");
    assert.equal(resolveOperatorSmokeOwnerSeedMobile(), "09174070937");
  });

  it("SEED-MOB-02 smoke seed does not revert Denali Iranian mobile to US dev default", () => {
    process.env.OPERATOR_OWNER_MOBILE = "00989174070937";
    const denaliMobile = resolveOperatorOwnerSeedMobile();
    const smokeMobile = resolveOperatorSmokeOwnerSeedMobile();
    assert.equal(denaliMobile, "09174070937");
    assert.equal(smokeMobile, denaliMobile);
    assert.notEqual(smokeMobile, "+15550001001");
  });

  it("SEED-MOB-03 without env both seeds use canonical US dev smoke mobile", () => {
    delete process.env.OPERATOR_OWNER_MOBILE;
    assert.equal(resolveOperatorOwnerSeedMobile(), "+15550001001");
    assert.equal(resolveOperatorSmokeOwnerSeedMobile(), "+15550001001");
  });
});

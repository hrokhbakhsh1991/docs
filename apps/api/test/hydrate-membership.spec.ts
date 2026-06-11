import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeMembershipRole } from "../src/identity/hydrate-membership";

describe("normalizeMembershipRole (DEC-P9-019)", () => {
  it("HYDRATE-R3-01 leader hydrates to admin", () => {
    assert.equal(normalizeMembershipRole("leader"), "admin");
  });

  it("HYDRATE-R3-02 viewer stays viewer", () => {
    assert.equal(normalizeMembershipRole("viewer"), "viewer");
  });

  it("HYDRATE-R3-03 unknown role becomes none", () => {
    assert.equal(normalizeMembershipRole("superadmin"), "none");
  });
});

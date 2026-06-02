import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertCapabilityAssignable,
  buildMembershipMetadataFromAssignment,
} from "./assert-capability-assignable";

describe("assertCapabilityAssignable", () => {
  test("owner can assign tour.regional.manage with regions", () => {
    const decision = assertCapabilityAssignable({
      actorGrantContext: { role: "owner", tenantModules: [] },
      targetRole: "member",
      payload: {
        capabilities: ["tour.regional.manage"],
        allowedRegionIds: ["region-a"],
      },
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.deepEqual(decision.allowedRegionIds, ["region-a"]);
    }
  });

  test("rejects unknown capability id", () => {
    const decision = assertCapabilityAssignable({
      actorGrantContext: { role: "owner" },
      targetRole: "member",
      payload: { capabilities: ["tour.not.real"] },
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.match(decision.code, /UNKNOWN/);
    }
  });

  test("admin cannot assign capability they lack", () => {
    const decision = assertCapabilityAssignable({
      actorGrantContext: { role: "admin", tenantModules: [] },
      targetRole: "member",
      payload: { capabilities: ["tour.regional.manage"], allowedRegionIds: ["r1"] },
    });
    assert.equal(decision.ok, false);
  });

  test("regional manage requires allowedRegionIds", () => {
    const decision = assertCapabilityAssignable({
      actorGrantContext: { role: "owner" },
      targetRole: "member",
      payload: { capabilities: ["tour.regional.manage"] },
    });
    assert.equal(decision.ok, false);
  });

  test("cannot modify owner membership", () => {
    const decision = assertCapabilityAssignable({
      actorGrantContext: { role: "owner" },
      targetRole: "owner",
      payload: { capabilities: ["tour.read"] },
    });
    assert.equal(decision.ok, false);
  });

  test("buildMembershipMetadataFromAssignment clears regions when regional removed", () => {
    const meta = buildMembershipMetadataFromAssignment(
      { capabilities: ["tour.regional.manage"], allowedRegionIds: ["r1"] },
      { normalizedCapabilities: ["tour.read"], allowedRegionIds: [] },
    );
    assert.deepEqual(meta.capabilities, ["tour.read"]);
    assert.equal(meta.allowedRegionIds, undefined);
  });
});

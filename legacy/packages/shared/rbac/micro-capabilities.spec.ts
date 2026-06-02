import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isEligibleTourLeaderMembership,
  membershipHasSelectableLeader,
  SELECTABLE_LEADER_CAPABILITY,
  setSelectableLeaderCapability,
} from "./micro-capabilities";
import { resolveEffectiveCapabilities } from "./capability-registry";
import { WorkspaceRole } from "./workspace-roles";

test("selectable leader micro-capability is not granted to effective CASL capabilities", () => {
  const effective = resolveEffectiveCapabilities({
    role: WorkspaceRole.Member,
    membershipMetadata: {
      capabilities: [SELECTABLE_LEADER_CAPABILITY],
    },
  });
  assert.equal(effective.includes(SELECTABLE_LEADER_CAPABILITY as never), false);
  assert.equal(effective.includes("tour.read"), true);
});

test("setSelectableLeaderCapability toggles token without dropping product caps", () => {
  const on = setSelectableLeaderCapability(["tour.regional.manage"], true);
  assert.deepEqual(on, [SELECTABLE_LEADER_CAPABILITY, "tour.regional.manage"]);

  const off = setSelectableLeaderCapability(on, false);
  assert.deepEqual(off, ["tour.regional.manage"]);
});

test("isEligibleTourLeaderMembership: crew roles and selectable leader capability", () => {
  assert.equal(isEligibleTourLeaderMembership("owner", {}), true);
  assert.equal(isEligibleTourLeaderMembership("admin", {}), true);
  assert.equal(isEligibleTourLeaderMembership("leader", {}), true);
  assert.equal(isEligibleTourLeaderMembership("member", {}), false);
  assert.equal(
    isEligibleTourLeaderMembership("member", { capabilities: [SELECTABLE_LEADER_CAPABILITY] }),
    true,
  );
  assert.equal(isEligibleTourLeaderMembership("viewer", {}), false);
});

test("membershipHasSelectableLeader reads metadata", () => {
  assert.equal(membershipHasSelectableLeader({ capabilities: [] }), false);
  assert.equal(
    membershipHasSelectableLeader({ capabilities: [SELECTABLE_LEADER_CAPABILITY] }),
    true,
  );
});

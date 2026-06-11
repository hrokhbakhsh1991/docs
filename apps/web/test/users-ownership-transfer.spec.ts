import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eligibleOwnershipTransferTargets } from "../src/features/users/users-ownership-transfer-logic";
import { USERS_DIRECTORY_TEST_IDS } from "../src/features/users/users-directory-types";

describe("users-ownership-transfer-logic (R5)", () => {
  it("WEB-9.4-19 eligible targets exclude self, owner, viewer, suspended", () => {
    const rows = [
      {
        userId: "owner-1",
        tenantId: "t1",
        role: "owner" as const,
        status: "ACTIVE",
        displayName: "Owner",
        phone: null,
      },
      {
        userId: "self-1",
        tenantId: "t1",
        role: "owner" as const,
        status: "ACTIVE",
        displayName: "Self",
        phone: null,
      },
      {
        userId: "admin-1",
        tenantId: "t1",
        role: "admin" as const,
        status: "ACTIVE",
        displayName: "Admin",
        phone: "+1",
      },
      {
        userId: "member-1",
        tenantId: "t1",
        role: "member" as const,
        status: "SUSPENDED",
        displayName: "Blocked",
        phone: null,
      },
      {
        userId: "viewer-1",
        tenantId: "t1",
        role: "viewer" as const,
        status: "ACTIVE",
        displayName: "Viewer",
        phone: null,
      },
      {
        userId: "member-2",
        tenantId: "t1",
        role: "member" as const,
        status: "ACTIVE",
        displayName: "Zeta",
        phone: null,
      },
    ];

    const targets = eligibleOwnershipTransferTargets(rows, "self-1");
    assert.deepEqual(
      targets.map((row) => row.userId),
      ["admin-1", "member-2"]
    );
    assert.equal(USERS_DIRECTORY_TEST_IDS.ownershipTransfer, "operator-users-ownership-transfer");
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.ownershipTransferSubmit,
      "operator-users-ownership-submit"
    );
  });
});

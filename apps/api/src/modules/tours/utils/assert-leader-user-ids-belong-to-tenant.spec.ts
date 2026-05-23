import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { SELECTABLE_LEADER_CAPABILITY } from "@repo/shared";

import type { UserTenantEntity } from "../../identity/entities/user-tenant.entity";
import {
  assertLeaderUserIdsBelongToTenant,
  collectLeaderUserIdsFromTripDetails,
} from "./assert-leader-user-ids-belong-to-tenant";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SELECTABLE_MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FOREIGN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type StubRow = Pick<UserTenantEntity, "userId" | "role" | "membershipMetadata">;

function stubRepo(rows: StubRow[]) {
  return {
    find: async () => rows,
  } as never;
}

test("collectLeaderUserIdsFromTripDetails reads overview.leaderUserIds", () => {
  assert.deepEqual(
    collectLeaderUserIdsFromTripDetails({
      overview: { leaderUserIds: [OWNER_ID, OWNER_ID, "  "] },
    }),
    [OWNER_ID],
  );
  assert.deepEqual(collectLeaderUserIdsFromTripDetails(null), []);
});

test("assertLeaderUserIdsBelongToTenant: owner passes", async () => {
  await assertLeaderUserIdsBelongToTenant(
    stubRepo([{ userId: OWNER_ID, role: "owner", membershipMetadata: {} }]),
    TENANT_ID,
    [OWNER_ID],
  );
});

test("assertLeaderUserIdsBelongToTenant: member with selectable leader passes", async () => {
  await assertLeaderUserIdsBelongToTenant(
    stubRepo([
      {
        userId: SELECTABLE_MEMBER_ID,
        role: "member",
        membershipMetadata: { capabilities: [SELECTABLE_LEADER_CAPABILITY] },
      },
    ]),
    TENANT_ID,
    [SELECTABLE_MEMBER_ID],
  );
});

test("assertLeaderUserIdsBelongToTenant: foreign user rejected", async () => {
  await assert.rejects(
    () =>
      assertLeaderUserIdsBelongToTenant(
        stubRepo([{ userId: OWNER_ID, role: "owner", membershipMetadata: {} }]),
        TENANT_ID,
        [FOREIGN_ID],
      ),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      const body = err.getResponse() as {
        error?: { code?: string; details?: { invalidIds?: string[] } };
      };
      assert.equal(body.error?.code, "INVALID_LEADER_USER_IDS_FOR_TENANT");
      assert.deepEqual(body.error?.details?.invalidIds, [FOREIGN_ID]);
      return true;
    },
  );
});

test("assertLeaderUserIdsBelongToTenant: ineligible member rejected", async () => {
  await assert.rejects(
    () =>
      assertLeaderUserIdsBelongToTenant(
        stubRepo([{ userId: MEMBER_ID, role: "member", membershipMetadata: {} }]),
        TENANT_ID,
        [MEMBER_ID],
      ),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      const body = err.getResponse() as {
        error?: { code?: string; details?: { invalidIds?: string[] } };
      };
      assert.equal(body.error?.code, "LEADER_USER_NOT_ELIGIBLE");
      assert.deepEqual(body.error?.details?.invalidIds, [MEMBER_ID]);
      return true;
    },
  );
});

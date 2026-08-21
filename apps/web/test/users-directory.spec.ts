/**
 * Phase 9.4 — users directory UI
 * Authority: docs/phase-9/appendices/USERS-DIRECTORY-UX.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveUsersDirectoryBodyState } from "../app/(app)/users/users-directory-gate";
import {
  DEFAULT_USERS_DIRECTORY_QUERY,
  INVITABLE_ROLES,
  isAdminOrOwnerRole,
  parseUsersDirectoryQuery,
  serializeUsersDirectoryQuery,
  USERS_DIRECTORY_TEST_IDS,
} from "../src/features/users/users-directory-types";
import {
  assignableRolesForActor,
  buildInviteRequestBody,
  buildUsersCsvContent,
  buildUsersCsvFilename,
  canManageUserRow,
  canEditUserRewards,
  filterUsersDirectoryByStatus,
  toUsersCsvRows,
} from "../src/features/users/users-page-logic";

describe("users-directory.spec.ts — Phase 9.4 Web", () => {
  it("WEB-9.4-01 users directory exposes page landmarks (CP-9.4-01)", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.page, "operator-users-page");
    assert.equal(USERS_DIRECTORY_TEST_IDS.list, "operator-users-list");
    assert.equal(USERS_DIRECTORY_TEST_IDS.search, "operator-users-search");
    assert.equal(USERS_DIRECTORY_TEST_IDS.inviteButton, "operator-users-invite");
    assert.equal(USERS_DIRECTORY_TEST_IDS.invitePhone, "operator-users-invite-phone");
    assert.equal(USERS_DIRECTORY_TEST_IDS.inviteSend, "operator-users-invite-send");
    assert.equal(USERS_DIRECTORY_TEST_IDS.locked, "operator-users-locked");
  });

  it("WEB-9.4-02 directory gate locks non-owner roles (DEC-P9-018)", () => {
    const memberState = resolveUsersDirectoryBodyState({
      session: {
        userId: "u1",
        tenantId: "t1",
        role: "member",
        workspaceType: "denali",
      },
      loading: false,
      error: null,
      usersLength: 0,
      hasActiveFilters: false,
    });
    assert.equal(memberState.type, "locked");

    const adminState = resolveUsersDirectoryBodyState({
      session: {
        userId: "u2",
        tenantId: "t1",
        role: "admin",
        workspaceType: "denali",
      },
      loading: false,
      error: null,
      usersLength: 0,
      hasActiveFilters: false,
    });
    assert.equal(adminState.type, "locked");
    assert.equal(isAdminOrOwnerRole("member"), false);
    assert.equal(isAdminOrOwnerRole("admin"), true);
  });

  it("WEB-9.4-03 invite roles include viewer (DEC-P9-019)", () => {
    assert.deepEqual(INVITABLE_ROLES, ["admin", "member", "viewer"]);
  });

  it("WEB-9.4-04 URL query model round-trips search and role", () => {
    const serialized = serializeUsersDirectoryQuery({
      ...DEFAULT_USERS_DIRECTORY_QUERY,
      search: "ali",
      role: "admin",
      sort: "name_desc",
    });
    const parsed = parseUsersDirectoryQuery(new URLSearchParams(serialized));
    assert.equal(parsed.search, "ali");
    assert.equal(parsed.role, "admin");
    assert.equal(parsed.sort, "name_desc");
    assert.equal(parsed.tab, "active");
  });

  it("WEB-9.4-06 pending tab query round-trips (R2)", () => {
    const serialized = serializeUsersDirectoryQuery({
      ...DEFAULT_USERS_DIRECTORY_QUERY,
      tab: "pending",
    });
    const parsed = parseUsersDirectoryQuery(new URLSearchParams(serialized));
    assert.equal(parsed.tab, "pending");
    assert.ok(serialized.includes("tab=pending"));
  });

  it("WEB-9.4-07 pending invites expose tab and list landmarks (R2)", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.tabActive, "operator-users-tab-active");
    assert.equal(USERS_DIRECTORY_TEST_IDS.tabPending, "operator-users-tab-pending");
    assert.equal(USERS_DIRECTORY_TEST_IDS.pendingList, "operator-users-pending-list");
    assert.equal(USERS_DIRECTORY_TEST_IDS.pendingRevoke, "operator-users-pending-revoke");
    assert.equal(USERS_DIRECTORY_TEST_IDS.pendingResend, "operator-users-pending-resend");
  });

  it("WEB-9.4-08 assignable roles follow actor rank (R3 · DEC-P9-019)", () => {
    assert.deepEqual(assignableRolesForActor("owner"), ["admin", "member", "viewer"]);
    assert.deepEqual(assignableRolesForActor("admin"), ["member", "viewer"]);
    assert.deepEqual(assignableRolesForActor("member"), []);
  });

  it("WEB-9.4-09 CSV export matches filtered roster (R3)", () => {
    const rows = toUsersCsvRows([
      {
        userId: "u1",
        tenantId: "t1",
        role: "admin",
        status: "ACTIVE",
        displayName: "Ali",
        phone: "+15550001002",
        avatarUrl: null,
        gender: "male",
      },
    ]);
    const csv = buildUsersCsvContent(rows);
    assert.ok(csv.includes("name,phone,email,gender,role,status"));
    assert.ok(csv.includes("Ali,+15550001002,,male,admin,ACTIVE"));
    assert.equal(
      buildUsersCsvFilename("denali", new Date("2026-06-08T12:00:00.000Z")),
      "users-denali-2026-06-08.csv"
    );
  });

  it("WEB-9.4-10 row actions gated by rank (R3)", () => {
    assert.equal(
      canManageUserRow("admin", "a1", {
        userId: "m1",
        tenantId: "t1",
        role: "member",
        status: "ACTIVE",
        displayName: "Member",
        phone: null,
      }),
      true
    );
    assert.equal(
      canManageUserRow("admin", "a1", {
        userId: "v1",
        tenantId: "t1",
        role: "viewer",
        status: "ACTIVE",
        displayName: "Viewer",
        phone: null,
      }),
      true
    );
    assert.equal(
      canManageUserRow("admin", "a1", {
        userId: "o1",
        tenantId: "t1",
        role: "owner",
        status: "ACTIVE",
        displayName: "Owner",
        phone: null,
      }),
      false
    );
    assert.equal(USERS_DIRECTORY_TEST_IDS.exportCsv, "operator-users-export-csv");
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowRemove, "operator-users-row-remove");
  });

  it("WEB-9.4-16 owner rewards action follows protected-role policy (USR-11)", () => {
    const ownerRow = {
      userId: "o1",
      tenantId: "t1",
      role: "owner" as const,
      status: "ACTIVE" as const,
      displayName: "Owner",
      phone: null,
    };
    assert.equal(canManageUserRow("owner", "o1", ownerRow), false);
    assert.equal(canEditUserRewards("owner", "o1", ownerRow), false);
    assert.equal(canEditUserRewards("member", "m1", ownerRow), false);
    assert.equal(
      canEditUserRewards("owner", "o1", {
        userId: "m1",
        tenantId: "t1",
        role: "member",
        status: "ACTIVE",
        displayName: "Member",
        phone: null,
      }),
      true
    );
  });

  it("WEB-9.4-11 member management benefits landmarks exposed (R4)", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowRewards, "operator-users-row-rewards");
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.memberDetailBenefits,
      "operator-users-member-benefits"
    );
    assert.equal(USERS_DIRECTORY_TEST_IDS.rewardsSave, "operator-users-rewards-save");
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.rewardsLoyaltyTier,
      "operator-users-rewards-loyalty-tier"
    );
    assert.equal(USERS_DIRECTORY_TEST_IDS.rewardsLabelInput, "operator-users-rewards-label-input");
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowMicroBadges, "operator-users-row-micro-badges");
  });

  it("WEB-9.4-11b users dialogs provide accessible descriptions", () => {
    const pageSource = readFileSync("app/(app)/users/users-page-client.tsx", "utf8");
    const detailsSource = readFileSync("app/(app)/users/users-member-detail-sheet.tsx", "utf8");
    assert.match(
      pageSource,
      /<DialogDescription>\{t\("inviteForm\.description"\)\}<\/DialogDescription>/
    );
    assert.match(
      detailsSource,
      /<span className="sr-only">\{t\("memberDetail\.description"\)\}<\/span>/
    );
  });

  it("WEB-9.4-11c users table exposes focused management columns", () => {
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.tableMemberHeader,
      "operator-users-table-member-header"
    );
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.tableAccessHeader,
      "operator-users-table-access-header"
    );
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.tableBenefitsHeader,
      "operator-users-table-benefits-header"
    );
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.tableActionHeader,
      "operator-users-table-action-header"
    );
    assert.equal(USERS_DIRECTORY_TEST_IDS.memberCard, "operator-users-member-card");
  });

  it("WEB-9.4-15 suspend/reactivate row landmarks exposed (R1)", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowSuspend, "operator-users-row-suspend");
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowReactivate, "operator-users-row-reactivate");
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.rowStatusSuspended,
      "operator-users-row-status-suspended"
    );
    assert.equal(USERS_DIRECTORY_TEST_IDS.statusFilter, "operator-users-status-filter");
  });

  it("WEB-9.4-16 status filter narrows roster client-side (R1)", () => {
    const rows = [
      {
        userId: "u1",
        tenantId: "t1",
        role: "member" as const,
        status: "ACTIVE",
        displayName: "Active",
        phone: null,
      },
      {
        userId: "u2",
        tenantId: "t1",
        role: "admin" as const,
        status: "SUSPENDED",
        displayName: "Blocked",
        phone: null,
      },
    ];
    assert.equal(filterUsersDirectoryByStatus(rows, "all").length, 2);
    assert.equal(filterUsersDirectoryByStatus(rows, "active").length, 1);
    assert.equal(filterUsersDirectoryByStatus(rows, "suspended")[0]?.displayName, "Blocked");
    const serialized = serializeUsersDirectoryQuery({
      ...DEFAULT_USERS_DIRECTORY_QUERY,
      status: "suspended",
    });
    assert.equal(parseUsersDirectoryQuery(new URLSearchParams(serialized)).status, "suspended");
  });

  it("WEB-9.4-12 invite payload normalizes Persian phone digits before API", () => {
    assert.deepEqual(buildInviteRequestBody({ phone: "  +۹۸۹۱۲۳۴۵۶۷۸  ", role: "member" }), {
      phone: "+98912345678",
      role: "member",
    });
    assert.deepEqual(
      buildInviteRequestBody({
        phone: "+15550001001",
        role: "admin",
        nameNote: "  Tour lead  ",
      }),
      { phone: "+15550001001", role: "admin", nameNote: "Tour lead" }
    );
  });

  it("WEB-9.4-05 directory gate shows empty roster for owner", () => {
    const state = resolveUsersDirectoryBodyState({
      session: {
        userId: "u1",
        tenantId: "t1",
        role: "owner",
        workspaceType: "denali",
      },
      loading: false,
      error: null,
      usersLength: 0,
      hasActiveFilters: false,
    });
    assert.equal(state.type, "empty");
  });

  it("WEB-9.4-05b pending tab loading avoids empty flash (USR-08)", () => {
    const state = resolveUsersDirectoryBodyState({
      session: {
        userId: "u1",
        tenantId: "t1",
        role: "owner",
        workspaceType: "denali",
      },
      loading: true,
      error: null,
      usersLength: 0,
      hasActiveFilters: false,
    });
    assert.equal(state.type, "loading");
  });

  it("WEB-9.4-17 R4 list fetch query includes sort and limit", async () => {
    const { buildUsersListFetchQuery, mergeUsersDirectoryPages, USERS_DIRECTORY_PAGE_SIZE } =
      await import("../src/features/users/users-directory-list-logic");
    const qs = buildUsersListFetchQuery({
      ...DEFAULT_USERS_DIRECTORY_QUERY,
      search: "ali",
      role: "admin",
      sort: "name_desc",
      tab: "active",
      status: "all",
    });
    const params = new URLSearchParams(qs);
    assert.equal(params.get("search"), "ali");
    assert.equal(params.get("role"), "admin");
    assert.equal(params.get("sort"), "name_desc");
    assert.equal(params.get("limit"), String(USERS_DIRECTORY_PAGE_SIZE));
    assert.equal(params.get("cursor"), null);

    const merged = mergeUsersDirectoryPages(
      [
        {
          userId: "u1",
          tenantId: "t1",
          role: "admin",
          status: "ACTIVE",
          displayName: "A",
          phone: null,
        },
      ],
      [
        {
          userId: "u1",
          tenantId: "t1",
          role: "admin",
          status: "ACTIVE",
          displayName: "A",
          phone: null,
        },
        {
          userId: "u2",
          tenantId: "t1",
          role: "member",
          status: "ACTIVE",
          displayName: "B",
          phone: null,
        },
      ]
    );
    assert.equal(merged.length, 2);
  });

  it("WEB-9.4-18 R4 invite role preview keys (CP-9.4-13)", async () => {
    const { resolveInviteRolePreviewKeys } =
      await import("../src/features/users/users-invite-role-preview");
    assert.deepEqual(resolveInviteRolePreviewKeys("viewer"), {
      line1Key: "inviteForm.preview.viewer.line1",
      line2Key: "inviteForm.preview.viewer.line2",
    });
    assert.equal(USERS_DIRECTORY_TEST_IDS.sortFilter, "operator-users-sort-filter");
    assert.equal(USERS_DIRECTORY_TEST_IDS.tableDesktop, "operator-users-table-desktop");
    assert.equal(USERS_DIRECTORY_TEST_IDS.listLoadMore, "operator-users-list-load-more");
    assert.equal(USERS_DIRECTORY_TEST_IDS.inviteRolePreview, "operator-users-invite-role-preview");
  });

  it("WEB-9.4-20 resend maps OTP rate limit error code (R6)", async () => {
    const enUsers = JSON.parse(
      await import("node:fs/promises").then((fs) =>
        fs.readFile(new URL("../messages/en/users.json", import.meta.url), "utf8")
      )
    ) as { errors: Record<string, string> };
    assert.match(enUsers.errors.OTP_RATE_LIMITED, /Too many invite codes/i);
  });

  it("WEB-9.4-21 R7 member detail sheet landmarks (CP-9.4-15)", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowDetails, "operator-users-row-details");
    assert.equal(USERS_DIRECTORY_TEST_IDS.memberDetail, "operator-users-member-detail");
    assert.equal(USERS_DIRECTORY_TEST_IDS.memberDetailHistory, "operator-users-member-history");
    assert.equal(USERS_DIRECTORY_TEST_IDS.memberDetailTrips, "operator-users-member-trips");
  });

  it("WEB-9.4-22 R4 sort options include contact/email sorts", async () => {
    const { USERS_DIRECTORY_SORT_OPTIONS } =
      await import("../src/features/users/users-directory-list-logic");
    assert.ok(USERS_DIRECTORY_SORT_OPTIONS.includes("email_asc"));
    assert.ok(USERS_DIRECTORY_SORT_OPTIONS.includes("email_desc"));
  });

  it("WEB-9.4-23 R8 bulk toolbar and row selection landmarks (CP-9.4-16)", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.bulkToolbar, "operator-users-bulk-toolbar");
    assert.equal(USERS_DIRECTORY_TEST_IDS.bulkRoleSelect, "operator-users-bulk-role-select");
    assert.equal(USERS_DIRECTORY_TEST_IDS.bulkApplyRole, "operator-users-bulk-apply-role");
    assert.equal(USERS_DIRECTORY_TEST_IDS.bulkSuspend, "operator-users-bulk-suspend");
    assert.equal(USERS_DIRECTORY_TEST_IDS.bulkReactivate, "operator-users-bulk-reactivate");
    assert.equal(USERS_DIRECTORY_TEST_IDS.bulkRemove, "operator-users-bulk-remove");
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowSelect, "operator-users-row-select");
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowSelectAll, "operator-users-row-select-all");
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowAvatar, "operator-users-row-avatar");
  });

  it("WEB-9.4-24 R2 rewards leader buddy toggle landmark", () => {
    assert.equal(
      USERS_DIRECTORY_TEST_IDS.rewardsLeaderBuddy,
      "operator-users-rewards-leader-buddy"
    );
  });

  it("WEB-9.4-25 buildUsersListFetchQuery forwards status filter to API", async () => {
    const { buildUsersListFetchQuery } =
      await import("../src/features/users/users-directory-list-logic");
    const suspendedQs = buildUsersListFetchQuery({
      tab: "active",
      search: "",
      role: "all",
      status: "suspended",
      sort: "name_asc",
    });
    assert.equal(new URLSearchParams(suspendedQs).get("status"), "suspended");

    const allStatusQs = buildUsersListFetchQuery({
      tab: "active",
      search: "",
      role: "all",
      status: "all",
      sort: "name_asc",
    });
    assert.equal(allStatusQs.includes("status="), false);
  });

  it("WEB-9.4-26 mobile bulk shares rowSelect landmark with desktop table", () => {
    assert.equal(USERS_DIRECTORY_TEST_IDS.rowSelect, "operator-users-row-select");
  });

  it("WEB-9.4-27 users nav hidden on urban plugin (INV-P9-006)", async () => {
    const { URBAN_WORKSPACE_PLUGIN_ID } = await import("@app-tour/workspace-urban");
    const { isUsersRouteAllowed, shouldShowUsersNav } =
      await import("../src/features/users/users-nav-access");
    assert.equal(shouldShowUsersNav(URBAN_WORKSPACE_PLUGIN_ID), false);
    assert.equal(isUsersRouteAllowed(URBAN_WORKSPACE_PLUGIN_ID), false);
  });

  it("WEB-9.4-28 users nav visible on denali plugin", async () => {
    const { DENALI_WORKSPACE_PLUGIN_ID } = await import("@app-tour/workspace-denali/plugin");
    const { seedWizardCreate } = await import("../src/workspace/wizard-create-registry");
    const { isUsersRouteAllowed, shouldShowUsersNav } =
      await import("../src/features/users/users-nav-access");
    seedWizardCreate(DENALI_WORKSPACE_PLUGIN_ID, { extendedChrome: true });
    assert.equal(shouldShowUsersNav(DENALI_WORKSPACE_PLUGIN_ID), true);
    assert.equal(isUsersRouteAllowed(DENALI_WORKSPACE_PLUGIN_ID), true);
  });
});

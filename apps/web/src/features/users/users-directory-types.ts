import type { OperatorSessionContext } from "@/admin/require-operator-session";
import type { ActorRole, OperatorProfileGender } from "@app-tour/workspace-sdk";

export const USERS_DIRECTORY_TEST_IDS = {
  page: "operator-users-page",
  list: "operator-users-list",
  search: "operator-users-search",
  roleFilter: "operator-users-role-filter",
  statusFilter: "operator-users-status-filter",
  inviteButton: "operator-users-invite",
  inviteModal: "operator-users-invite-modal",
  invitePhone: "operator-users-invite-phone",
  inviteSend: "operator-users-invite-send",
  locked: "operator-users-locked",
  empty: "operator-users-empty",
  tabActive: "operator-users-tab-active",
  tabPending: "operator-users-tab-pending",
  pendingList: "operator-users-pending-list",
  pendingRevoke: "operator-users-pending-revoke",
  pendingResend: "operator-users-pending-resend",
  exportCsv: "operator-users-export-csv",
  rowActions: "operator-users-row-actions",
  rowRole: "operator-users-row-role",
  rowRemove: "operator-users-row-remove",
  rowRewards: "operator-users-row-rewards",
  rowSuspend: "operator-users-row-suspend",
  rowReactivate: "operator-users-row-reactivate",
  rowStatusSuspended: "operator-users-row-status-suspended",
  rewardsModal: "operator-users-rewards-modal",
  rewardsSave: "operator-users-rewards-save",
  rewardsLoyaltyTier: "operator-users-rewards-loyalty-tier",
  rewardsLabelInput: "operator-users-rewards-label-input",
  rewardsLabelAdd: "operator-users-rewards-label-add",
  rewardsLabelChip: "operator-users-rewards-label-chip",
  rewardsLeaderBuddy: "operator-users-rewards-leader-buddy",
  rowMicroBadges: "operator-users-row-micro-badges",
  sortFilter: "operator-users-sort-filter",
  tableDesktop: "operator-users-table-desktop",
  tableMemberHeader: "operator-users-table-member-header",
  tableAccessHeader: "operator-users-table-access-header",
  tableBenefitsHeader: "operator-users-table-benefits-header",
  tableActionHeader: "operator-users-table-action-header",
  listLoadMore: "operator-users-list-load-more",
  rowActionsMenu: "operator-users-row-actions-menu",
  rowActionsSheet: "operator-users-row-actions-sheet",
  inviteRolePreview: "operator-users-invite-role-preview",
  ownershipTransfer: "operator-users-ownership-transfer",
  ownershipTransferSelect: "operator-users-ownership-select",
  ownershipTransferSubmit: "operator-users-ownership-submit",
  ownershipTransferInvite: "operator-users-ownership-invite",
  rowDetails: "operator-users-row-details",
  memberDetail: "operator-users-member-detail",
  memberDetailHeader: "operator-users-member-detail-header",
  memberDetailCurrentState: "operator-users-member-current-state",
  memberDetailAccess: "operator-users-member-access",
  memberDetailBenefits: "operator-users-member-benefits",
  memberDetailDanger: "operator-users-member-danger",
  memberDetailLoading: "operator-users-member-detail-loading",
  memberDetailHistory: "operator-users-member-history",
  memberDetailTrips: "operator-users-member-trips",
  memberCard: "operator-users-member-card",
  bulkToolbar: "operator-users-bulk-toolbar",
  bulkRoleSelect: "operator-users-bulk-role-select",
  bulkApplyRole: "operator-users-bulk-apply-role",
  bulkSuspend: "operator-users-bulk-suspend",
  bulkReactivate: "operator-users-bulk-reactivate",
  bulkRemove: "operator-users-bulk-remove",
  rowSelect: "operator-users-row-select",
  rowSelectAll: "operator-users-row-select-all",
  rowAvatar: "operator-users-row-avatar",
  rowGender: "operator-users-row-gender",
} as const;

export type PatchUserRewardsRequest = {
  readonly permanentDiscountPercentage?: number | null;
  readonly badges?: readonly string[];
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
};

export type UsersDirectoryTab = "active" | "pending";

export type UsersDirectoryRole = "all" | "owner" | "admin" | "member" | "viewer";

export type UsersDirectoryStatus = "all" | "active" | "suspended";

export type UsersDirectoryRow = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: Exclude<ActorRole, "none">;
  readonly status: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email?: string | null;
  readonly avatarUrl: string | null;
  readonly gender: OperatorProfileGender | null;
  readonly permanentDiscountPercentage?: number | null;
  readonly rewardBadges?: readonly string[];
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
  readonly lastActiveAt?: string | null;
};

export type UsersListResponse = {
  readonly items: readonly UsersDirectoryRow[];
  readonly total: number;
  readonly nextCursor?: string;
};

export type PendingInviteRow = {
  readonly inviteId: string;
  readonly phone: string;
  readonly role: InvitableWorkspaceRole;
  readonly status: "INVITED";
  readonly nameNote: string | null;
  readonly invitedByUserId: string;
};

export type PendingInvitesListResponse = {
  readonly items: readonly PendingInviteRow[];
  readonly total: number;
};

export type MembershipAuditEventKind =
  | "role_change"
  | "status_change"
  | "rewards_change"
  | "member_removed";

export type UserRoleHistoryItem = {
  readonly eventKind: MembershipAuditEventKind;
  readonly actorUserId: string;
  readonly actorMobile: string;
  readonly oldRole: string;
  readonly newRole: string;
  readonly createdAt: string;
};

export type UserRoleHistoryResponse = {
  readonly items: readonly UserRoleHistoryItem[];
};

export type UserBookingTripRow = {
  readonly bookingId: string;
  readonly tourTitle: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly partySize: number;
};

export type UserBookingSummaryResponse = {
  readonly totalTrips: number;
  readonly completedTrips: number;
  readonly cancelledTrips: number;
  readonly trips: readonly UserBookingTripRow[];
};

export type BulkUsersMutationFailure = {
  readonly userId: string;
  readonly code: string;
};

export type BulkUsersMutationResponse = {
  readonly items: readonly UsersDirectoryRow[];
  readonly failures: readonly BulkUsersMutationFailure[];
};

export type InvitableWorkspaceRole = "admin" | "member" | "viewer";

export const INVITABLE_ROLES: readonly InvitableWorkspaceRole[] = [
  "admin",
  "member",
  "viewer",
] as const;

export type UsersDirectoryQuery = {
  readonly search: string;
  readonly role: UsersDirectoryRole;
  readonly status: UsersDirectoryStatus;
  readonly sort: "name_asc" | "name_desc" | "email_asc" | "email_desc";
  readonly tab: UsersDirectoryTab;
};

export const DEFAULT_USERS_DIRECTORY_QUERY: UsersDirectoryQuery = {
  search: "",
  role: "all",
  status: "all",
  sort: "name_asc",
  tab: "active",
};

export function serializeUsersDirectoryQuery(query: UsersDirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.search.trim().length > 0) {
    params.set("search", query.search.trim());
  }
  if (query.role !== "all") {
    params.set("role", query.role);
  }
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.sort !== "name_asc") {
    params.set("sort", query.sort);
  }
  if (query.tab === "pending") {
    params.set("tab", "pending");
  }
  return params.toString();
}

export function parseUsersDirectoryQuery(searchParams: URLSearchParams): UsersDirectoryQuery {
  const roleRaw = searchParams.get("role");
  const role =
    roleRaw === "owner" || roleRaw === "admin" || roleRaw === "member" || roleRaw === "viewer"
      ? roleRaw
      : "all";
  const statusRaw = searchParams.get("status");
  const status = statusRaw === "active" || statusRaw === "suspended" ? statusRaw : "all";
  const sortRaw = searchParams.get("sort");
  const sort: UsersDirectoryQuery["sort"] =
    sortRaw === "name_desc" || sortRaw === "email_asc" || sortRaw === "email_desc"
      ? sortRaw
      : "name_asc";
  const tab = searchParams.get("tab") === "pending" ? "pending" : "active";
  return {
    search: searchParams.get("search")?.trim() ?? "",
    role,
    status,
    sort,
    tab,
  };
}

export function isAdminOrOwnerRole(role: OperatorSessionContext["role"]): boolean {
  return role === "owner" || role === "admin";
}

export { isOwnerRole } from "@/admin/require-operator-session";

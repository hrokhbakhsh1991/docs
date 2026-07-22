"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";

import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search, UserPlus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PageHeader as AdminPageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import {
  DEFAULT_USERS_DIRECTORY_QUERY,
  INVITABLE_ROLES,
  isOwnerRole,
  parseUsersDirectoryQuery,
  serializeUsersDirectoryQuery,
  USERS_DIRECTORY_TEST_IDS,
  type BulkUsersMutationResponse,
  type InvitableWorkspaceRole,
  type PendingInviteRow,
  type PendingInvitesListResponse,
  type UsersDirectoryQuery,
  type UsersDirectoryRow,
  type UsersListResponse,
} from "@/features/users/users-directory-types";
import {
  buildUsersListFetchQuery,
  mergeUsersDirectoryPages,
  USERS_DIRECTORY_SORT_OPTIONS,
} from "@/features/users/users-directory-list-logic";
import { resolveInviteRolePreviewKeys } from "@/features/users/users-invite-role-preview";
import {
  buildInviteRequestBody,
  buildUsersCsvContent,
  buildUsersCsvFilename,
  canManageUserRow,
  filterUsersDirectoryByStatus,
  toUsersCsvRows,
  USERS_OWNERSHIP_TRANSFER_UI_ENABLED,
} from "@/features/users/users-page-logic";
import {
  addRewardLabel,
  buildRewardsPatchPayload,
  LOYALTY_REWARD_BADGE_IDS,
  removeRewardLabel,
  resolveLoyaltyTierFromBadges,
  type LoyaltyTier,
} from "@/features/users/users-rewards-logic";

import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import { resolveUsersDirectoryBodyState } from "./users-directory-gate";
import { UsersDirectoryLockedPanel } from "./users-directory-locked-panel";
import {
  UsersDirectoryMobileCard,
  UsersDirectoryRowActionsSheet,
} from "./users-directory-row-actions-sheet";
import { UsersDirectoryTable } from "./users-directory-table";
import { UsersDirectoryBulkToolbar } from "./users-directory-bulk-toolbar";
import { UsersMemberDetailSheet } from "./users-member-detail-sheet";
import { UsersOwnershipTransferPanel } from "./users-ownership-transfer-panel";

type UsersPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly initialUsersList?: UsersListResponse | null;
  readonly initialOwnershipRoster?: UsersListResponse | null;
};

const ROLE_FILTER_OPTIONS = ["all", "owner", "admin", "member", "viewer"] as const;
const STATUS_FILTER_OPTIONS = ["all", "active", "suspended"] as const;

export function UsersPageClient({
  session,
  initialUsersList = null,
  initialOwnershipRoster = null,
}: UsersPageClientProps) {
  const t = useTranslations("users");
  const tErrors = useTranslations("users.errors");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = useMemo(
    () => parseUsersDirectoryQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const [searchInput, setSearchInput] = useState(query.search);
  const [listItems, setListItems] = useState<readonly UsersDirectoryRow[]>(
    () => initialUsersList?.items ?? []
  );
  const [listTotal, setListTotal] = useState(initialUsersList?.total ?? 0);
  const [nextCursor, setNextCursor] = useState<string | undefined>(
    initialUsersList?.nextCursor ?? undefined
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const nextCursorRef = useRef<string | undefined>(initialUsersList?.nextCursor ?? undefined);
  const [pendingData, setPendingData] = useState<PendingInvitesListResponse | null>(null);
  const [pendingLoading, setPendingLoading] = useState(
    () => query.tab === "pending" && isOwnerRole(session.role)
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isOwnerRole(session.role) && initialUsersList === null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialUsersList !== null);
  const [pendingFetchNonce, setPendingFetchNonce] = useState(0);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableWorkspaceRole>("member");
  const [inviteNote, setInviteNote] = useState("");
  const invitePreview = useMemo(() => resolveInviteRolePreviewKeys(inviteRole), [inviteRole]);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [rewardsUser, setRewardsUser] = useState<UsersDirectoryRow | null>(null);
  const [rewardsDiscount, setRewardsDiscount] = useState("");
  const [rewardsSelectableLeader, setRewardsSelectableLeader] = useState(false);
  const [rewardsLeaderBuddy, setRewardsLeaderBuddy] = useState(false);
  const [rewardsLoyaltyTier, setRewardsLoyaltyTier] = useState<LoyaltyTier>("none");
  const [rewardsLabels, setRewardsLabels] = useState<readonly string[]>([]);
  const [rewardsLabelDraft, setRewardsLabelDraft] = useState("");
  const [rewardsSaving, setRewardsSaving] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [actionsUser, setActionsUser] = useState<UsersDirectoryRow | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UsersDirectoryRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<ReadonlySet<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const canManage = isOwnerRole(session.role);

  const openMemberDetail = (user: UsersDirectoryRow) => {
    setDetailUser(user);
    setDetailOpen(true);
  };

  const replaceQuery = (next: UsersDirectoryQuery) => {
    const serialized = serializeUsersDirectoryQuery(next);
    router.replace(serialized.length > 0 ? `${pathname}?${serialized}` : pathname);
  };

  useEffect(() => {
    setSearchInput(query.search);
  }, [query.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === query.search) {
        return;
      }
      replaceQuery({ ...query, search: searchInput });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [pathname, query, router, searchInput]);

  const isPendingTab = query.tab === "pending";
  const directoryLoading = isPendingTab ? pendingLoading : loading;

  useLayoutEffect(() => {
    if (isPendingTab && canManage) {
      setPendingLoading(true);
    }
  }, [canManage, isPendingTab]);

  const fetchUsersPage = useCallback(
    async (cursor: string | undefined, append: boolean) => {
      const qs = buildUsersListFetchQuery(query, cursor);
      const response = await fetch(`/api/users?${qs}`, { cache: "no-store" });
      if (response.status === 403) {
        throw new Error("USERS_DIRECTORY_FORBIDDEN");
      }
      if (!response.ok) {
        throw new Error(`USERS_LIST_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as UsersListResponse;
      setListItems((current) =>
        append ? mergeUsersDirectoryPages(current, payload.items) : [...payload.items]
      );
      setListTotal(payload.total);
      setNextCursor(payload.nextCursor);
      return payload;
    },
    [query]
  );

  useEffect(() => {
    if (!canManage || isPendingTab) {
      if (!canManage) {
        setLoading(false);
      }
      return;
    }
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setListItems([]);
    setNextCursor(undefined);
    void fetchUsersPage(undefined, false)
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "USERS_LIST_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, isPendingTab, query, fetchNonce, fetchUsersPage]);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    if (!canManage || isPendingTab || loading || nextCursor === undefined) {
      return;
    }
    const node = loadMoreRef.current;
    if (node === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const cursor = nextCursorRef.current;
        if (!entry?.isIntersecting || loadMoreInFlightRef.current || cursor === undefined) {
          return;
        }
        loadMoreInFlightRef.current = true;
        setLoadingMore(true);
        void fetchUsersPage(cursor, true)
          .catch((fetchError: unknown) => {
            setError(fetchError instanceof Error ? fetchError.message : "USERS_LIST_FAILED");
          })
          .finally(() => {
            loadMoreInFlightRef.current = false;
            setLoadingMore(false);
          });
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canManage, fetchUsersPage, isPendingTab, loading, nextCursor]);

  useEffect(() => {
    if (!canManage || !isPendingTab) {
      return;
    }
    let cancelled = false;
    setPendingLoading(true);
    setError(null);
    void fetch("/api/users/invites", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403) {
          throw new Error("USERS_DIRECTORY_FORBIDDEN");
        }
        if (!response.ok) {
          throw new Error(`USERS_PENDING_HTTP_${response.status}`);
        }
        return (await response.json()) as PendingInvitesListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setPendingData(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "USERS_PENDING_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPendingLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, isPendingTab, pendingFetchNonce]);

  const hasActiveFilters =
    query.search.trim().length > 0 || query.role !== "all" || query.status !== "all";
  const visibleUsers = filterUsersDirectoryByStatus(listItems, query.status);
  const manageableVisibleUsers = useMemo(
    () => visibleUsers.filter((user) => canManageUserRow(session.role, session.userId, user)),
    [session.role, session.userId, visibleUsers]
  );
  const rosterLength = isPendingTab ? (pendingData?.items.length ?? 0) : visibleUsers.length;
  const bodyState = resolveUsersDirectoryBodyState({
    session,
    loading: directoryLoading,
    error,
    usersLength: rosterLength,
    hasActiveFilters: isPendingTab ? false : hasActiveFilters,
  });

  useEffect(() => {
    setSelectedUserIds(new Set());
  }, [query.tab, query.search, query.role, query.status, query.sort]);

  const handleToggleUserSelected = (userId: string, selected: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (selected: boolean) => {
    if (!selected) {
      setSelectedUserIds(new Set());
      return;
    }
    setSelectedUserIds(new Set(manageableVisibleUsers.map((user) => user.userId)));
  };

  const runBulkMutation = async (
    path: string,
    method: "PATCH" | "POST",
    body: Record<string, unknown>
  ) => {
    setBulkBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 403) {
        throw new Error("USERS_DIRECTORY_FORBIDDEN");
      }
      if (!response.ok) {
        throw new Error(`USERS_BULK_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as BulkUsersMutationResponse;
      if (payload.failures.length > 0) {
        setError(payload.failures[0]?.code ?? "USERS_BULK_PARTIAL_FAILED");
      }
      setSelectedUserIds(new Set());
      setFetchNonce((value) => value + 1);
    } catch (bulkFailure: unknown) {
      setError(bulkFailure instanceof Error ? bulkFailure.message : "USERS_BULK_FAILED");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkApplyRole = (role: InvitableWorkspaceRole) => {
    void runBulkMutation("/api/users/bulk/role", "PATCH", {
      userIds: [...selectedUserIds],
      role,
    });
  };

  const handleBulkSuspend = () => {
    if (!window.confirm(t("bulk.suspendConfirm"))) {
      return;
    }
    void runBulkMutation("/api/users/bulk/suspend", "PATCH", {
      userIds: [...selectedUserIds],
    });
  };

  const handleBulkReactivate = () => {
    void runBulkMutation("/api/users/bulk/reactivate", "PATCH", {
      userIds: [...selectedUserIds],
    });
  };

  const handleBulkRemove = () => {
    if (!window.confirm(t("bulk.removeConfirm"))) {
      return;
    }
    void runBulkMutation("/api/users/bulk/remove", "POST", {
      userIds: [...selectedUserIds],
    });
  };

  const handleInvite = async () => {
    setInviting(true);
    setInviteError(null);
    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildInviteRequestBody({
            phone: invitePhone,
            role: inviteRole,
            nameNote: inviteNote,
          })
        ),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { code?: string };
        if (body.code === "PHONE_INVALID") {
          throw new Error("USERS_INVITE_PHONE_INVALID");
        }
        if (body.code === "PHONE_REQUIRED") {
          throw new Error("USERS_INVITE_PHONE_REQUIRED");
        }
        throw new Error(`USERS_INVITE_HTTP_${response.status}`);
      }
      setInviteOpen(false);
      setInvitePhone("");
      setInviteNote("");
      setInviteRole("member");
      setFetchNonce((value) => value + 1);
      setPendingFetchNonce((value) => value + 1);
    } catch (inviteFailure: unknown) {
      setInviteError(
        inviteFailure instanceof Error ? inviteFailure.message : "USERS_INVITE_FAILED"
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setPendingActionId(inviteId);
    try {
      const response = await fetch(`/api/users/invites/${inviteId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        throw new Error(`USERS_REVOKE_HTTP_${response.status}`);
      }
      setPendingFetchNonce((value) => value + 1);
    } catch (revokeFailure: unknown) {
      setError(revokeFailure instanceof Error ? revokeFailure.message : "USERS_REVOKE_FAILED");
    } finally {
      setPendingActionId(null);
    }
  };

  const handlePatchRole = async (userId: string, role: InvitableWorkspaceRole) => {
    setRowActionId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error(`USERS_ROLE_HTTP_${response.status}`);
      }
      setFetchNonce((value) => value + 1);
    } catch (patchFailure: unknown) {
      setError(patchFailure instanceof Error ? patchFailure.message : "USERS_ROLE_FAILED");
    } finally {
      setRowActionId(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm(t("actions.removeConfirm"))) {
      return;
    }
    setRowActionId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        throw new Error(`USERS_REMOVE_HTTP_${response.status}`);
      }
      setFetchNonce((value) => value + 1);
    } catch (removeFailure: unknown) {
      setError(removeFailure instanceof Error ? removeFailure.message : "USERS_REMOVE_FAILED");
    } finally {
      setRowActionId(null);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (!window.confirm(t("actions.suspendConfirm"))) {
      return;
    }
    setRowActionId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/suspend`, { method: "PATCH" });
      if (!response.ok) {
        throw new Error(`USERS_SUSPEND_HTTP_${response.status}`);
      }
      setFetchNonce((value) => value + 1);
    } catch (suspendFailure: unknown) {
      setError(suspendFailure instanceof Error ? suspendFailure.message : "USERS_SUSPEND_FAILED");
    } finally {
      setRowActionId(null);
    }
  };

  const handleReactivateUser = async (userId: string) => {
    setRowActionId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/reactivate`, { method: "PATCH" });
      if (!response.ok) {
        throw new Error(`USERS_REACTIVATE_HTTP_${response.status}`);
      }
      setFetchNonce((value) => value + 1);
    } catch (reactivateFailure: unknown) {
      setError(
        reactivateFailure instanceof Error ? reactivateFailure.message : "USERS_REACTIVATE_FAILED"
      );
    } finally {
      setRowActionId(null);
    }
  };

  const openRewardsModal = (user: UsersDirectoryRow) => {
    setRewardsUser(user);
    setRewardsDiscount(
      user.permanentDiscountPercentage === null || user.permanentDiscountPercentage === undefined
        ? ""
        : String(user.permanentDiscountPercentage)
    );
    setRewardsSelectableLeader(user.isSelectableLeader ?? false);
    setRewardsLeaderBuddy(user.rewardBadges?.includes("LEADER_BUDDY") ?? false);
    setRewardsLoyaltyTier(resolveLoyaltyTierFromBadges(user.rewardBadges));
    setRewardsLabels(user.labels ?? []);
    setRewardsLabelDraft("");
    setRewardsError(null);
  };

  const closeRewardsModal = () => {
    setRewardsUser(null);
    setRewardsError(null);
  };

  const handleSaveRewards = async () => {
    if (rewardsUser === null) {
      return;
    }
    setRewardsSaving(true);
    setRewardsError(null);
    const built = buildRewardsPatchPayload({
      previous: rewardsUser,
      discountRaw: rewardsDiscount,
      loyaltyTier: rewardsLoyaltyTier,
      labels: rewardsLabels,
      selectableLeader: rewardsSelectableLeader,
      leaderBuddy: rewardsLeaderBuddy,
    });
    if (!built.ok) {
      setRewardsError(built.error);
      setRewardsSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/users/${rewardsUser.userId}/rewards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
      });
      if (!response.ok) {
        throw new Error(`USERS_REWARDS_HTTP_${response.status}`);
      }
      closeRewardsModal();
      setFetchNonce((value) => value + 1);
    } catch (rewardsFailure: unknown) {
      setRewardsError(
        rewardsFailure instanceof Error ? rewardsFailure.message : "USERS_REWARDS_FAILED"
      );
    } finally {
      setRewardsSaving(false);
    }
  };

  const handleExportCsv = () => {
    const rows = toUsersCsvRows(filterUsersDirectoryByStatus(listItems, query.status));
    const csv = buildUsersCsvContent(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildUsersCsvFilename(session.tenantId.slice(0, 8));
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResendInvite = async (inviteId: string) => {
    setPendingActionId(inviteId);
    try {
      const response = await fetch(`/api/users/invites/${inviteId}/resend`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        const code = typeof payload.code === "string" ? payload.code : null;
        if (response.status === 429 && code === "OTP_RATE_LIMITED") {
          throw new Error("OTP_RATE_LIMITED");
        }
        throw new Error(`USERS_RESEND_HTTP_${response.status}`);
      }
      setPendingFetchNonce((value) => value + 1);
    } catch (resendFailure: unknown) {
      setError(resendFailure instanceof Error ? resendFailure.message : "USERS_RESEND_FAILED");
    } finally {
      setPendingActionId(null);
    }
  };

  if (bodyState.type === "locked") {
    return (
      <div data-testid={USERS_DIRECTORY_TEST_IDS.page}>
        <UsersDirectoryHeader
          canManage={false}
          showExport={false}
          onInvite={() => undefined}
          onExportCsv={() => undefined}
        />
        <UsersDirectoryLockedPanel />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={USERS_DIRECTORY_TEST_IDS.page}>
      <UsersDirectoryHeader
        canManage={canManage}
        showExport={!isPendingTab && visibleUsers.length > 0}
        onInvite={() => setInviteOpen(true)}
        onExportCsv={handleExportCsv}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={query.tab === "active" ? "default" : "outline"}
          data-testid={USERS_DIRECTORY_TEST_IDS.tabActive}
          onClick={() => replaceQuery({ ...query, tab: "active" })}
        >
          {t("tabs.active")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={query.tab === "pending" ? "default" : "outline"}
          data-testid={USERS_DIRECTORY_TEST_IDS.tabPending}
          onClick={() => replaceQuery({ ...query, tab: "pending" })}
        >
          {t("tabs.pending")}
          {pendingData && pendingData.total > 0 ? (
            <Badge variant="secondary" className="ms-2">
              {pendingData.total}
            </Badge>
          ) : null}
        </Button>
      </div>

      {!isPendingTab ? (
        <div className="space-y-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid={USERS_DIRECTORY_TEST_IDS.search}
              className="ps-9"
              value={searchInput}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2" data-testid={USERS_DIRECTORY_TEST_IDS.roleFilter}>
            {ROLE_FILTER_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={query.role === option ? "default" : "outline"}
                onClick={() => replaceQuery({ ...query, role: option })}
              >
                {t(`roles.${option}`)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2" data-testid={USERS_DIRECTORY_TEST_IDS.statusFilter}>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={query.status === option ? "default" : "outline"}
                onClick={() => replaceQuery({ ...query, status: option })}
              >
                {t(`statusFilter.${option}`)}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2" data-testid={USERS_DIRECTORY_TEST_IDS.sortFilter}>
            {USERS_DIRECTORY_SORT_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={query.sort === option ? "default" : "outline"}
                onClick={() => replaceQuery({ ...query, sort: option })}
              >
                {t(`sort.${option}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInviteError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg" data-testid={USERS_DIRECTORY_TEST_IDS.inviteModal}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t("inviteForm.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-phone">{t("inviteForm.phone")}</Label>
              <LocalizedNumericInput
                id="invite-phone"
                mode="phone"
                data-testid={USERS_DIRECTORY_TEST_IDS.invitePhone}
                value={invitePhone}
                placeholder={t("inviteForm.phonePlaceholder")}
                onChange={setInvitePhone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">{t("inviteForm.role")}</Label>
              <div className="flex gap-2">
                {INVITABLE_ROLES.map((role) => (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={inviteRole === role ? "default" : "outline"}
                    onClick={() => setInviteRole(role)}
                  >
                    {t(`roles.${role}`)}
                  </Button>
                ))}
              </div>
              <div
                className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm"
                data-testid={USERS_DIRECTORY_TEST_IDS.inviteRolePreview}
              >
                <p>{t(invitePreview.line1Key)}</p>
                <p className="text-muted-foreground">{t(invitePreview.line2Key)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-note">{t("inviteForm.nameNote")}</Label>
              <Input
                id="invite-note"
                value={inviteNote}
                onChange={(event) => setInviteNote(event.target.value)}
              />
            </div>
            {inviteError ? (
              <p role="alert" className="text-sm text-destructive">
                {resolveCodedErrorMessage(tErrors, inviteError)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={inviting || invitePhone.trim().length === 0}
              data-testid={USERS_DIRECTORY_TEST_IDS.inviteSend}
              onClick={() => void handleInvite()}
            >
              {inviting ? t("inviteForm.sending") : t("inviteForm.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {bodyState.type === "loading" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <OperatorSkeleton key={index} size="user-card" />
          ))}
        </div>
      ) : null}

      {bodyState.type === "error" ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p role="alert" className="text-sm text-destructive">
              {resolveCodedErrorMessage(tErrors, bodyState.message)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                isPendingTab
                  ? setPendingFetchNonce((value) => value + 1)
                  : setFetchNonce((value) => value + 1)
              }
            >
              {tCommon("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "empty" ? (
        <Card data-testid={USERS_DIRECTORY_TEST_IDS.empty}>
          <CardContent className="py-10 text-center text-muted-foreground">
            {isPendingTab ? t("empty.pending") : t("empty.active")}
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "directory" && !isPendingTab ? (
        <div className="space-y-4" data-testid={USERS_DIRECTORY_TEST_IDS.list}>
          <UsersDirectoryBulkToolbar
            selectedCount={selectedUserIds.size}
            busy={bulkBusy}
            onClearSelection={() => setSelectedUserIds(new Set())}
            onApplyRole={handleBulkApplyRole}
            onSuspend={handleBulkSuspend}
            onReactivate={handleBulkReactivate}
            onRemove={handleBulkRemove}
          />
          <UsersDirectoryTable
            users={visibleUsers}
            session={session}
            busyUserId={rowActionId}
            locale={locale}
            onPatchRole={(userId, role) => void handlePatchRole(userId, role)}
            onRemove={(userId) => void handleRemoveUser(userId)}
            onSuspend={(userId) => void handleSuspendUser(userId)}
            onReactivate={(userId) => void handleReactivateUser(userId)}
            onOpenRewards={openRewardsModal}
            onOpenDetails={openMemberDetail}
            selectedUserIds={selectedUserIds}
            onToggleUserSelected={handleToggleUserSelected}
            onToggleSelectAll={handleToggleSelectAll}
          />
          <ul className="grid grid-cols-1 gap-4 md:hidden">
            {visibleUsers.map((user) => (
              <li key={user.userId}>
                <UsersDirectoryMobileCard
                  user={user}
                  session={session}
                  busy={rowActionId === user.userId}
                  selected={selectedUserIds.has(user.userId)}
                  onToggleSelected={(selected) => handleToggleUserSelected(user.userId, selected)}
                  onOpenActions={() => {
                    setActionsUser(user);
                    setActionsOpen(true);
                  }}
                  onOpenDetails={() => openMemberDetail(user)}
                />
              </li>
            ))}
          </ul>
          {nextCursor !== undefined ? (
            <div
              ref={loadMoreRef}
              className="py-4 text-center text-sm text-muted-foreground"
              data-testid={USERS_DIRECTORY_TEST_IDS.listLoadMore}
            >
              {loadingMore ? t("loadingMore") : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {bodyState.type === "directory" && isPendingTab ? (
        <ul
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid={USERS_DIRECTORY_TEST_IDS.pendingList}
        >
          {(pendingData?.items ?? []).map((invite) => (
            <li key={invite.inviteId}>
              <PendingInviteRowCard
                invite={invite}
                busy={pendingActionId === invite.inviteId}
                onRevoke={() => void handleRevokeInvite(invite.inviteId)}
                onResend={() => void handleResendInvite(invite.inviteId)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {!isPendingTab && listTotal > 0 ? (
        <p className="text-sm text-muted-foreground">{t("counts.members", { count: listTotal })}</p>
      ) : null}

      {canManage && !isPendingTab && USERS_OWNERSHIP_TRANSFER_UI_ENABLED ? (
        <UsersOwnershipTransferPanel
          session={session}
          initialRoster={initialOwnershipRoster?.items ?? null}
          onInviteClick={() => setInviteOpen(true)}
        />
      ) : null}

      {isPendingTab && pendingData && pendingData.total > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("counts.pendingInvites", { count: pendingData.total })}
        </p>
      ) : null}

      <Dialog
        open={rewardsUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeRewardsModal();
          }
        }}
      >
        <DialogContent
          className="max-h-[90vh] max-w-lg overflow-y-auto"
          data-testid={USERS_DIRECTORY_TEST_IDS.rewardsModal}
        >
          <DialogHeader>
            <DialogTitle>
              {rewardsUser ? t("rewards.title", { name: rewardsUser.displayName }) : ""}
            </DialogTitle>
          </DialogHeader>
          {rewardsUser ? (
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rewards-discount">{t("rewards.discountLabel")}</Label>
              <LocalizedNumericInput
                id="rewards-discount"
                mode="digits"
                maxLength={3}
                value={rewardsDiscount}
                placeholder={t("rewards.discountPlaceholder")}
                onChange={setRewardsDiscount}
              />
            </div>

            <fieldset className="space-y-2" data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLoyaltyTier}>
              <legend className="text-sm font-medium">{t("rewards.loyaltyTierLabel")}</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <PrimitiveInput
                    type="radio"
                    name="rewards-loyalty-tier"
                    className="h-4 w-4 shrink-0 p-0"
                    checked={rewardsLoyaltyTier === "none"}
                    onChange={() => setRewardsLoyaltyTier("none")}
                  />
                  {t("rewards.loyaltyNone")}
                </label>
                {LOYALTY_REWARD_BADGE_IDS.map((badgeId) => (
                  <label key={badgeId} className="flex items-center gap-2">
                    <PrimitiveInput
                      type="radio"
                      name="rewards-loyalty-tier"
                      className="h-4 w-4 shrink-0 p-0"
                      checked={rewardsLoyaltyTier === badgeId}
                      onChange={() => setRewardsLoyaltyTier(badgeId)}
                    />
                    {badgeId === "VIP_MEMBER" ? t("rewards.loyaltyVip") : t("rewards.loyaltyGold")}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="rewards-label-input">{t("rewards.labelsLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  id="rewards-label-input"
                  value={rewardsLabelDraft}
                  placeholder={t("rewards.labelsPlaceholder")}
                  data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLabelInput}
                  onChange={(event) => setRewardsLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setRewardsLabels((current) => addRewardLabel(current, rewardsLabelDraft));
                      setRewardsLabelDraft("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLabelAdd}
                  onClick={() => {
                    setRewardsLabels((current) => addRewardLabel(current, rewardsLabelDraft));
                    setRewardsLabelDraft("");
                  }}
                >
                  {t("rewards.labelsAdd")}
                </Button>
              </div>
              {rewardsLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("rewards.labelsEmpty")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rewardsLabels.map((label, index) => (
                    <Badge
                      key={`${label}-${index}`}
                      variant="secondary"
                      className="gap-1"
                      data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLabelChip}
                    >
                      {label}
                      <button
                        type="button"
                        className="ms-1 text-xs opacity-70 hover:opacity-100"
                        aria-label={`Remove ${label}`}
                        onClick={() => setRewardsLabels((current) => removeRewardLabel(current, index))}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={rewardsSelectableLeader}
                onChange={(event) => setRewardsSelectableLeader(event.target.checked)}
              />
              {t("rewards.selectableLeader")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={rewardsLeaderBuddy}
                data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLeaderBuddy}
                onChange={(event) => setRewardsLeaderBuddy(event.target.checked)}
              />
              {t("rewards.leaderBuddyToggle")}
            </label>
            {rewardsError ? (
              <p role="alert" className="text-sm text-destructive">
                {resolveCodedErrorMessage(tErrors, rewardsError)}
              </p>
            ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRewardsModal}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={rewardsSaving || rewardsUser === null}
              data-testid={USERS_DIRECTORY_TEST_IDS.rewardsSave}
              onClick={() => void handleSaveRewards()}
            >
              {rewardsSaving ? t("rewards.saving") : t("rewards.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UsersDirectoryRowActionsSheet
        user={actionsUser}
        session={session}
        busy={actionsUser !== null && rowActionId === actionsUser.userId}
        open={actionsOpen}
        onOpenChange={(open) => {
          setActionsOpen(open);
          if (!open) {
            setActionsUser(null);
          }
        }}
        onPatchRole={(role) => {
          if (actionsUser !== null) {
            void handlePatchRole(actionsUser.userId, role);
          }
        }}
        onRemove={() => {
          if (actionsUser !== null) {
            void handleRemoveUser(actionsUser.userId);
          }
        }}
        onSuspend={() => {
          if (actionsUser !== null) {
            void handleSuspendUser(actionsUser.userId);
          }
        }}
        onReactivate={() => {
          if (actionsUser !== null) {
            void handleReactivateUser(actionsUser.userId);
          }
        }}
        onOpenRewards={() => {
          if (actionsUser !== null) {
            openRewardsModal(actionsUser);
          }
        }}
        onOpenDetails={() => {
          if (actionsUser !== null) {
            openMemberDetail(actionsUser);
            setActionsOpen(false);
            setActionsUser(null);
          }
        }}
      />

      <UsersMemberDetailSheet
        user={detailUser}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailUser(null);
          }
        }}
      />
    </div>
  );
}

function UsersDirectoryHeader({
  canManage,
  showExport,
  onInvite,
  onExportCsv,
}: {
  readonly canManage: boolean;
  readonly showExport: boolean;
  readonly onInvite: () => void;
  readonly onExportCsv: () => void;
}) {
  const t = useTranslations("users");
  return (
    <AdminPageHeader
      title={t("title")}
      description={t("subtitle")}
      actions={
        canManage ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {showExport ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                data-testid={USERS_DIRECTORY_TEST_IDS.exportCsv}
                onClick={onExportCsv}
              >
                <Download className="h-4 w-4" />
                {t("exportCsv")}
              </Button>
            ) : null}
            <Button
              className="gap-2"
              data-testid={USERS_DIRECTORY_TEST_IDS.inviteButton}
              onClick={onInvite}
            >
              <Plus className="h-4 w-4" />
              {t("inviteButton")}
            </Button>
          </div>
        ) : null
      }
    />
  );
}

function PendingInviteRowCard({
  invite,
  busy,
  onRevoke,
  onResend,
}: {
  readonly invite: PendingInviteRow;
  readonly busy: boolean;
  readonly onRevoke: () => void;
  readonly onResend: () => void;
}) {
  const t = useTranslations("users");
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{invite.phone}</p>
            {invite.nameNote ? (
              <p className="truncate text-sm text-muted-foreground">{invite.nameNote}</p>
            ) : null}
          </div>
          <Badge variant="secondary">{invite.role}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid={USERS_DIRECTORY_TEST_IDS.pendingResend}
            onClick={onResend}
          >
            {t("actions.resend")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            data-testid={USERS_DIRECTORY_TEST_IDS.pendingRevoke}
            onClick={onRevoke}
          >
            {t("actions.revoke")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function buildDefaultUsersDirectoryQueryForTests(): UsersDirectoryQuery {
  return DEFAULT_USERS_DIRECTORY_QUERY;
}

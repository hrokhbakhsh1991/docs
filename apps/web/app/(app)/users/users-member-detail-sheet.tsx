"use client";

import { formatIranMobileForDisplay } from "@app-tour/iran-mobile";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  USERS_DIRECTORY_TEST_IDS,
  type InvitableWorkspaceRole,
  type MembershipAuditEventKind,
  type UserBookingSummaryResponse,
  type UserRoleHistoryItem,
  type UserRoleHistoryResponse,
  type UsersDirectoryRow,
} from "@/features/users/users-directory-types";
import {
  assignableRolesForActor,
  canEditUserRewards,
  canManageUserRow,
} from "@/features/users/users-page-logic";
import {
  addRewardLabel,
  LOYALTY_REWARD_BADGE_IDS,
  removeRewardLabel,
  type LoyaltyTier,
} from "@/features/users/users-rewards-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import { UserMicroBadges } from "./users-directory-user-micro-badges";
import { UsersDirectoryAvatar } from "./users-directory-avatar";

type UsersMemberDetailSheetProps = {
  readonly user: UsersDirectoryRow | null;
  readonly session: OperatorSessionContext;
  readonly open: boolean;
  readonly busy: boolean;
  readonly rewardsDiscount: string;
  readonly rewardsSelectableLeader: boolean;
  readonly rewardsLeaderBuddy: boolean;
  readonly rewardsLoyaltyTier: LoyaltyTier;
  readonly rewardsLabels: readonly string[];
  readonly rewardsLabelDraft: string;
  readonly rewardsSaving: boolean;
  readonly rewardsError: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPatchRole: (role: InvitableWorkspaceRole) => void;
  readonly onSuspend: () => void;
  readonly onReactivate: () => void;
  readonly onRemove: () => void;
  readonly onRewardsDiscountChange: (value: string) => void;
  readonly onRewardsSelectableLeaderChange: (value: boolean) => void;
  readonly onRewardsLeaderBuddyChange: (value: boolean) => void;
  readonly onRewardsLoyaltyTierChange: (value: LoyaltyTier) => void;
  readonly onRewardsLabelsChange: (value: readonly string[]) => void;
  readonly onRewardsLabelDraftChange: (value: string) => void;
  readonly onSaveRewards: () => void;
};

function StatusBadge({ user }: { readonly user: UsersDirectoryRow }) {
  const t = useTranslations("users");
  if (user.status === "SUSPENDED") {
    return (
      <OperatorStatusBadge
        variant="destructive"
        data-testid={USERS_DIRECTORY_TEST_IDS.rowStatusSuspended}
      >
        {t("status.suspended")}
      </OperatorStatusBadge>
    );
  }
  return <OperatorStatusBadge variant="success">{t("status.active")}</OperatorStatusBadge>;
}

function DetailSection({
  title,
  description,
  testId,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly testId?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm" data-testid={testId}>
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function UsersMemberDetailSheet({
  user,
  session,
  open,
  busy,
  rewardsDiscount,
  rewardsSelectableLeader,
  rewardsLeaderBuddy,
  rewardsLoyaltyTier,
  rewardsLabels,
  rewardsLabelDraft,
  rewardsSaving,
  rewardsError,
  onOpenChange,
  onPatchRole,
  onSuspend,
  onReactivate,
  onRemove,
  onRewardsDiscountChange,
  onRewardsSelectableLeaderChange,
  onRewardsLeaderBuddyChange,
  onRewardsLoyaltyTierChange,
  onRewardsLabelsChange,
  onRewardsLabelDraftChange,
  onSaveRewards,
}: UsersMemberDetailSheetProps) {
  const t = useTranslations("users");
  const tBookingsStatus = useTranslations("bookings.status");
  const tErrors = useTranslations("users.errors");
  const locale = useLocale();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [history, setHistory] = useState<UserRoleHistoryResponse | null>(null);
  const [trips, setTrips] = useState<UserBookingSummaryResponse | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const loadMemberDetail = useCallback(async (userId: string, signal: { cancelled: boolean }) => {
    setHistoryLoading(true);
    setTripsLoading(true);
    setHistoryError(null);
    setTripsError(null);
    setHistory(null);
    setTrips(null);

    const loadHistory = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/users/${userId}/role-history`, { cache: "no-store" });
        if (!response.ok) throw new Error("USERS_MEMBER_DETAIL_HTTP_ERROR");
        const payload = (await response.json()) as UserRoleHistoryResponse;
        if (!signal.cancelled) setHistory(payload);
      } catch (loadFailure: unknown) {
        if (!signal.cancelled) {
          setHistoryError(
            loadFailure instanceof Error ? loadFailure.message : "USERS_MEMBER_DETAIL_FAILED"
          );
        }
      } finally {
        if (!signal.cancelled) setHistoryLoading(false);
      }
    };

    const loadTrips = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/users/${userId}/booking-summary`, { cache: "no-store" });
        if (!response.ok) throw new Error("USERS_MEMBER_DETAIL_HTTP_ERROR");
        const payload = (await response.json()) as UserBookingSummaryResponse;
        if (!signal.cancelled) setTrips(payload);
      } catch (loadFailure: unknown) {
        if (!signal.cancelled) {
          setTripsError(
            loadFailure instanceof Error ? loadFailure.message : "USERS_MEMBER_DETAIL_FAILED"
          );
        }
      } finally {
        if (!signal.cancelled) setTripsLoading(false);
      }
    };

    await Promise.all([loadHistory(), loadTrips()]);
  }, []);

  useEffect(() => {
    if (!open || user === null) return;
    const signal = { cancelled: false };
    setActivityExpanded(false);
    void loadMemberDetail(user.userId, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [open, user, reloadToken, loadMemberDetail]);

  if (user === null) {
    return null;
  }

  const manageable = canManageUserRow(session.role, session.userId, user);
  const canRewards = canEditUserRewards(session.role, session.userId, user);
  const roleOptions = assignableRolesForActor(session.role).filter((role) => role !== user.role);
  const isOwner = user.role === "owner";
  const isSuspended = user.status === "SUSPENDED";
  const hasDiscount =
    user.permanentDiscountPercentage !== null &&
    user.permanentDiscountPercentage !== undefined &&
    user.permanentDiscountPercentage > 0;
  const parsedRewardsDiscount = Number(rewardsDiscount.trim());
  const rewardsDiscountVisible =
    rewardsDiscount.trim().length > 0 &&
    Number.isFinite(parsedRewardsDiscount) &&
    parsedRewardsDiscount > 0;
  const rewardsLoyaltyVisible = rewardsLoyaltyTier !== "none";
  const visibleHistory = activityExpanded ? history?.items : history?.items.slice(0, 4);
  const visibleTrips = activityExpanded ? trips?.trips : trips?.trips.slice(0, 3);
  const sheetSide = locale === "fa" ? "left" : "right";

  const resolveRoleLabel = (raw: string): string => {
    if (raw === "ACTIVE" || raw === "SUSPENDED" || raw === "REMOVED") {
      return t(
        `status.${raw === "REMOVED" ? "removed" : raw === "SUSPENDED" ? "suspended" : "active"}`
      );
    }
    if (raw === "rewards") return t("memberDetail.eventLabels.rewards");
    if (raw === "updated") return t("memberDetail.eventLabels.updated");
    return t(`roles.${raw}` as "roles.member");
  };

  const resolveTripStatusLabel = (status: string): string => {
    const known = ["pending", "approved", "waitlisted", "rejected", "cancelled"] as const;
    if ((known as readonly string[]).includes(status)) return tBookingsStatus(status);
    return status;
  };

  const resolveHistorySummary = (entry: UserRoleHistoryItem): string => {
    const kind: MembershipAuditEventKind = entry.eventKind ?? "role_change";
    if (kind === "status_change") {
      return t("memberDetail.statusChange", {
        previous: resolveRoleLabel(entry.oldRole),
        next: resolveRoleLabel(entry.newRole),
      });
    }
    if (kind === "rewards_change") return t("memberDetail.rewardsChange");
    if (kind === "member_removed") {
      return t("memberDetail.memberRemoved", { role: resolveRoleLabel(entry.oldRole) });
    }
    return t("memberDetail.roleChange", {
      oldRole: resolveRoleLabel(entry.oldRole),
      newRole: resolveRoleLabel(entry.newRole),
    });
  };

  const formatWhen = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      date
    );
  };

  const rewardSummary = rewardsDiscountVisible || rewardsLoyaltyVisible;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetSide}
        detailSheet
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        data-testid={USERS_DIRECTORY_TEST_IDS.memberDetail}
      >
        <SheetHeader
          className="shrink-0 border-b px-5 py-5 text-start sm:px-6"
          data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailHeader}
        >
          <div className="flex items-start gap-4">
            <UsersDirectoryAvatar user={user} size="md" />
            <div className="min-w-0 flex-1 space-y-2">
              <SheetTitle className="truncate">{user.displayName}</SheetTitle>
              <SheetDescription>
                <span dir="ltr" className="tabular-nums">
                  {user.phone ? formatIranMobileForDisplay(user.phone) : "—"}
                </span>
                <span className="sr-only">{t("memberDetail.description")}</span>
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isOwner ? "default" : "secondary"}>{t(`roles.${user.role}`)}</Badge>
                <StatusBadge user={user} />
                {isOwner ? <Badge variant="outline">{t("owner.protectedBadge")}</Badge> : null}
              </div>
              {isOwner ? <p className="text-sm text-muted-foreground">{t("owner.protectedNote")}</p> : null}
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <DetailSection
            title={t("memberDetail.sections.currentState")}
            testId={USERS_DIRECTORY_TEST_IDS.memberDetailCurrentState}
          >
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("memberDetail.fields.role")}</dt>
                <dd className="font-medium">{t(`roles.${user.role}`)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("memberDetail.fields.status")}</dt>
                <dd className="font-medium">
                  {isSuspended ? t("status.suspended") : t("status.active")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("memberDetail.fields.discount")}</dt>
                <dd className="font-medium">
                  {hasDiscount
                    ? t("benefits.discountValue", { value: user.permanentDiscountPercentage })
                    : t("benefits.none")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("memberDetail.fields.badges")}</dt>
                <dd>
                  <UserMicroBadges user={user} compact />
                </dd>
              </div>
            </dl>
          </DetailSection>

          <DetailSection
            title={t("memberDetail.sections.access")}
            description={isOwner ? t("owner.protectedNote") : t("memberDetail.accessDescription")}
            testId={USERS_DIRECTORY_TEST_IDS.memberDetailAccess}
          >
            {isOwner || !manageable ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                {isOwner ? t("owner.transferBeforeChange") : t("memberDetail.notManageable")}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("memberDetail.currentRole", { role: t(`roles.${user.role}`) })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((role) => (
                      <Button
                        key={role}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        data-testid={USERS_DIRECTORY_TEST_IDS.rowRole}
                        onClick={() => onPatchRole(role)}
                      >
                        {t("actions.setRole", { role: t(`roles.${role}`) })}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isSuspended ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowReactivate}
                      onClick={onReactivate}
                    >
                      {t("actions.reactivate")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      data-testid={USERS_DIRECTORY_TEST_IDS.rowSuspend}
                      onClick={onSuspend}
                    >
                      {t("actions.suspend")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DetailSection>

          <DetailSection
            title={t("memberDetail.sections.benefits")}
            description={t("rewards.scopeNote")}
            testId={USERS_DIRECTORY_TEST_IDS.memberDetailBenefits}
          >
            {canRewards ? (
              <div className="space-y-4">
                {rewardSummary ? (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("rewards.discountLabel")}
                        </p>
                        <p className="text-sm font-medium leading-5">
                          {rewardsDiscountVisible
                            ? t("benefits.discountValue", { value: parsedRewardsDiscount })
                            : t("benefits.none")}
                        </p>
                      </div>
                      <div className="space-y-1 sm:text-end">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("rewards.loyaltyTierLabel")}
                        </p>
                        {rewardsLoyaltyVisible ? (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {rewardsLoyaltyTier === "VIP_MEMBER"
                              ? t("rewards.loyaltyVip")
                              : t("rewards.loyaltyGold")}
                          </Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("benefits.none")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="member-benefits-discount">{t("rewards.discountLabel")}</Label>
                  <LocalizedNumericInput
                    id="member-benefits-discount"
                    mode="digits"
                    maxLength={3}
                    value={rewardsDiscount}
                    placeholder={t("rewards.discountPlaceholder")}
                    data-testid={USERS_DIRECTORY_TEST_IDS.rowRewards}
                    onChange={onRewardsDiscountChange}
                  />
                </div>

                <fieldset
                  className="space-y-2"
                  data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLoyaltyTier}
                >
                  <legend className="text-sm font-medium">{t("rewards.loyaltyTierLabel")}</legend>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <label className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5">
                      <PrimitiveInput
                        type="radio"
                        name="member-benefits-loyalty-tier"
                        className="h-4 w-4 shrink-0 p-0"
                        checked={rewardsLoyaltyTier === "none"}
                        onChange={() => onRewardsLoyaltyTierChange("none")}
                      />
                      {t("rewards.loyaltyNone")}
                    </label>
                    {LOYALTY_REWARD_BADGE_IDS.map((badgeId) => (
                      <label
                        key={badgeId}
                        className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5"
                      >
                        <PrimitiveInput
                          type="radio"
                          name="member-benefits-loyalty-tier"
                          className="h-4 w-4 shrink-0 p-0"
                          checked={rewardsLoyaltyTier === badgeId}
                          onChange={() => onRewardsLoyaltyTierChange(badgeId)}
                        />
                        {badgeId === "VIP_MEMBER"
                          ? t("rewards.loyaltyVip")
                          : t("rewards.loyaltyGold")}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="member-benefits-label-input">{t("rewards.labelsLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="member-benefits-label-input"
                      value={rewardsLabelDraft}
                      placeholder={t("rewards.labelsPlaceholder")}
                      data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLabelInput}
                      onChange={(event) => onRewardsLabelDraftChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onRewardsLabelsChange(addRewardLabel(rewardsLabels, rewardsLabelDraft));
                          onRewardsLabelDraftChange("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLabelAdd}
                      onClick={() => {
                        onRewardsLabelsChange(addRewardLabel(rewardsLabels, rewardsLabelDraft));
                        onRewardsLabelDraftChange("");
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
                            onClick={() =>
                              onRewardsLabelsChange(removeRewardLabel(rewardsLabels, index))
                            }
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
                    onChange={(event) => onRewardsSelectableLeaderChange(event.target.checked)}
                  />
                  {t("rewards.selectableLeader")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={rewardsLeaderBuddy}
                    data-testid={USERS_DIRECTORY_TEST_IDS.rewardsLeaderBuddy}
                    onChange={(event) => onRewardsLeaderBuddyChange(event.target.checked)}
                  />
                  {t("rewards.leaderBuddyToggle")}
                </label>
                {rewardsError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {resolveCodedErrorMessage(tErrors, rewardsError)}
                  </p>
                ) : null}
                <Button
                  type="button"
                  disabled={rewardsSaving}
                  data-testid={USERS_DIRECTORY_TEST_IDS.rewardsSave}
                  onClick={onSaveRewards}
                >
                  {rewardsSaving ? t("rewards.saving") : t("rewards.save")}
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                {isOwner ? t("owner.rewardsProtected") : t("memberDetail.notManageable")}
              </p>
            )}
          </DetailSection>

          <DetailSection
            title={t("memberDetail.sections.activity")}
            description={t("memberDetail.activityDescription")}
          >
            <div className="space-y-4">
              {historyLoading || tripsLoading ? (
                <Skeleton
                  className="h-24 w-full rounded-lg"
                  data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailLoading}
                />
              ) : null}
              {historyError !== null || tripsError !== null ? (
                <div className="space-y-2" role="alert">
                  <p className="text-sm text-destructive">
                    {resolveCodedErrorMessage(tErrors, historyError ?? tripsError ?? "")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setReloadToken((current) => current + 1)}
                  >
                    {t("memberDetail.retry")}
                  </Button>
                </div>
              ) : null}
              {!historyLoading && historyError === null ? (
                <div
                  className="space-y-2"
                  data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailHistory}
                >
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("memberDetail.recentHistory")}
                  </h4>
                  {(history?.items.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("memberDetail.historyEmpty")}</p>
                  ) : (
                    visibleHistory?.map((entry, index) => (
                      <div
                        key={`${entry.createdAt}-${index}`}
                        className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm"
                      >
                        <p className="font-medium">{resolveHistorySummary(entry)}</p>
                        <p className="text-muted-foreground">
                          {t("memberDetail.byActor", { actor: entry.actorMobile })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatWhen(entry.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              {!tripsLoading && tripsError === null ? (
                <div className="space-y-3" data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailTrips}>
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("memberDetail.tripSummary")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {t("memberDetail.totalTrips", { count: trips?.totalTrips ?? 0 })}
                    </Badge>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {t("memberDetail.completedTrips", { count: trips?.completedTrips ?? 0 })}
                    </Badge>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {t("memberDetail.cancelledTrips", { count: trips?.cancelledTrips ?? 0 })}
                    </Badge>
                  </div>
                  {(trips?.trips.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("memberDetail.tripsEmpty")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {visibleTrips?.map((trip) => (
                        <li
                          key={trip.bookingId}
                          className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm"
                        >
                          <p className="font-medium">{trip.tourTitle}</p>
                          <p className="text-muted-foreground">
                            {t("memberDetail.tripMeta", {
                              status: resolveTripStatusLabel(trip.status),
                              partySize: trip.partySize,
                              departure: formatWhen(trip.departureAt),
                            })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
              {(history?.items.length ?? 0) > 4 || (trips?.trips.length ?? 0) > 3 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setActivityExpanded((current) => !current)}
                >
                  {activityExpanded ? t("memberDetail.showLess") : t("memberDetail.showMore")}
                </Button>
              ) : null}
            </div>
          </DetailSection>

          {!isOwner && manageable ? (
            <DetailSection
              title={t("memberDetail.sections.danger")}
              description={t("memberDetail.removeDescription")}
              testId={USERS_DIRECTORY_TEST_IDS.memberDetailDanger}
            >
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  data-testid={USERS_DIRECTORY_TEST_IDS.rowRemove}
                  onClick={onRemove}
                >
                  {t("actions.remove")}
                </Button>
              </div>
            </DetailSection>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

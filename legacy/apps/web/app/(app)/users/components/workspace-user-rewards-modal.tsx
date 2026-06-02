"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, FormField, Input, Modal, Select } from "@tour/ui";
import {
  WORKSPACE_LOYALTY_CLUB_BADGE_IDS,
  WORKSPACE_REWARD_BADGE_IDS,
  type WorkspaceLoyaltyClubBadgeId,
  type WorkspaceRewardBadgeId
} from "@repo/shared";

import { ApiError } from "@/lib/api-client";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import {
  getWorkspaceUserBookingSummary,
  postWorkspaceUserRewards
} from "@/shared/api/workspace-users.client";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

import {
  formatDepartureDateFa,
  formatPaymentStatusFa,
  formatRegistrationStatusFa
} from "../users-format";
import { USERS_ROUTE_COPY } from "../users-copy";
import styles from "../users-page.module.css";

const copy = USERS_ROUTE_COPY.list.rewardsModal;

const LOYALTY_SET = new Set<string>(WORKSPACE_LOYALTY_CLUB_BADGE_IDS);
const NON_LOYALTY_BADGES = WORKSPACE_REWARD_BADGE_IDS.filter((id) => !LOYALTY_SET.has(id));

const LOYALTY_TIER_LABELS: Record<WorkspaceLoyaltyClubBadgeId, string> = {
  VIP_MEMBER: copy.loyaltyClubVip,
  GOLD_CLUB: copy.loyaltyClubGold
};

type RewardsTabId = "privileges" | "trips";

function loyaltyFromUser(user: WorkspaceUserDto): "" | WorkspaceLoyaltyClubBadgeId {
  for (const badge of user.rewardBadges ?? []) {
    if (LOYALTY_SET.has(badge)) {
      return badge as WorkspaceLoyaltyClubBadgeId;
    }
  }
  return "";
}

function discountSliderValue(discountInput: string): number {
  const trimmed = discountInput.trim();
  if (trimmed === "") return 0;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
}

type RewardsFormSnapshot = {
  discountInput: string;
  loyaltyClub: "" | WorkspaceLoyaltyClubBadgeId;
  selectableLeader: boolean;
  labelsDraft: string[];
};

export type WorkspaceUserRewardsModalProps = {
  open: boolean;
  user: WorkspaceUserDto | null;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

export function WorkspaceUserRewardsModal({
  open,
  user,
  onClose,
  onSaved
}: WorkspaceUserRewardsModalProps): JSX.Element | null {
  const toast = useAppToast();
  const tenantId = useWorkspaceQueryScope();
  const [activeTab, setActiveTab] = useState<RewardsTabId>("privileges");
  const [discountInput, setDiscountInput] = useState("");
  const [loyaltyClub, setLoyaltyClub] = useState<"" | WorkspaceLoyaltyClubBadgeId>("");
  const [selectableLeader, setSelectableLeader] = useState(false);
  const [labelsDraft, setLabelsDraft] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rewardsMutation = useMutation({
    mutationFn: async ({
      targetUser,
      form
    }: {
      targetUser: WorkspaceUserDto;
      form: RewardsFormSnapshot;
    }) => {
      const trimmed = form.discountInput.trim();
      let permanentDiscountPercentage: number | null | undefined;
      if (trimmed !== "") {
        const parsed = Number(trimmed);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
          throw new Error(copy.discountValidationError);
        }
        permanentDiscountPercentage = parsed;
      } else if (
        targetUser.permanentDiscountPercentage !== undefined &&
        targetUser.permanentDiscountPercentage !== null
      ) {
        permanentDiscountPercentage = null;
      }

      const preservedNonLoyalty = (targetUser.rewardBadges ?? []).filter(
        (b): b is WorkspaceRewardBadgeId =>
          (NON_LOYALTY_BADGES as readonly string[]).includes(b)
      );
      const badges: WorkspaceRewardBadgeId[] = [...preservedNonLoyalty];
      if (form.loyaltyClub) {
        badges.push(form.loyaltyClub);
      }

      return postWorkspaceUserRewards(targetUser.id, {
        permanentDiscountPercentage,
        badges,
        isSelectableLeader: form.selectableLeader,
        labels: form.labelsDraft
      });
    },
    onSuccess: async () => {
      toast.success({ message: copy.savedToast });
      await onSaved?.();
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : copy.saveErrorFallback;
      setErrorMessage(message);
      toast.error({ message });
    }
  });

  const isPending = rewardsMutation.isPending;
  const hydratedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      hydratedUserIdRef.current = null;
      setActiveTab("privileges");
      return;
    }
    if (!user) {
      return;
    }
    if (hydratedUserIdRef.current === user.id) {
      return;
    }
    hydratedUserIdRef.current = user.id;
    const discount =
      user.permanentDiscountPercentage !== undefined && user.permanentDiscountPercentage !== null
        ? String(user.permanentDiscountPercentage)
        : "";
    setDiscountInput(discount);
    setLoyaltyClub(loyaltyFromUser(user));
    setSelectableLeader(Boolean(user.isSelectableLeader));
    setLabelsDraft([...(user.labels ?? [])]);
    setLabelInput("");
    setErrorMessage(null);
    rewardsMutation.reset();
  }, [open, rewardsMutation, user]);

  const tripHistoryQuery = useQuery({
    queryKey: ["workspace-user-booking-summary", tenantId ?? "", user?.id],
    queryFn: () => getWorkspaceUserBookingSummary(user!.id),
    enabled: open && activeTab === "trips" && Boolean(user?.id)
  });

  const canSubmit = useMemo(() => !isPending && Boolean(user?.id), [isPending, user?.id]);
  const discountSlider = discountSliderValue(discountInput);

  const handleClose = useCallback(() => {
    if (isPending) return;
    onClose();
  }, [isPending, onClose]);

  const handleSubmit = useCallback(() => {
    if (!user || !canSubmit) return;
    setErrorMessage(null);
    rewardsMutation.mutate({
      targetUser: user,
      form: { discountInput, loyaltyClub, selectableLeader, labelsDraft }
    });
  }, [canSubmit, discountInput, labelsDraft, loyaltyClub, rewardsMutation, selectableLeader, user]);

  const addLabel = useCallback(() => {
    const next = labelInput.trim();
    if (!next || labelsDraft.includes(next) || labelsDraft.length >= 32) {
      return;
    }
    setLabelsDraft((prev) => [...prev, next]);
    setLabelInput("");
  }, [labelInput, labelsDraft]);

  const removeLabel = useCallback((label: string) => {
    setLabelsDraft((prev) => prev.filter((l) => l !== label));
  }, []);

  if (!user) {
    return null;
  }

  const tabPanelId = (tab: RewardsTabId) => `rewards-tabpanel-${tab}-${user.id}`;
  const tabButtonId = (tab: RewardsTabId) => `rewards-tab-${tab}-${user.id}`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={copy.title}
      panelClassName={styles.rewardsModalPanelWide}
      footer={
        activeTab === "privileges" ? (
          <>
            <Button type="button" variant="ghost" disabled={isPending} onClick={handleClose}>
              {copy.cancelButton}
            </Button>
            <Button type="button" variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
              {isPending ? copy.savingButton : copy.saveButton}
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" disabled={isPending} onClick={handleClose}>
            {copy.cancelButton}
          </Button>
        )
      }
    >
      <div className={styles.rewardsModalBody} dir="rtl" aria-busy={isPending}>
        <div role="tablist" aria-label={copy.title} className={styles.rewardsModalTabs}>
          <button
            type="button"
            role="tab"
            id={tabButtonId("privileges")}
            aria-selected={activeTab === "privileges"}
            aria-controls={tabPanelId("privileges")}
            className={
              activeTab === "privileges"
                ? `${styles.rewardsModalTab} ${styles.rewardsModalTabActive}`
                : styles.rewardsModalTab
            }
            disabled={isPending}
            onClick={() => setActiveTab("privileges")}
          >
            {copy.tabPrivileges}
          </button>
          <button
            type="button"
            role="tab"
            id={tabButtonId("trips")}
            aria-selected={activeTab === "trips"}
            aria-controls={tabPanelId("trips")}
            className={
              activeTab === "trips"
                ? `${styles.rewardsModalTab} ${styles.rewardsModalTabActive}`
                : styles.rewardsModalTab
            }
            disabled={isPending}
            onClick={() => setActiveTab("trips")}
          >
            {copy.tabTripHistory}
          </button>
        </div>

        {activeTab === "privileges" ? (
          <div
            role="tabpanel"
            id={tabPanelId("privileges")}
            aria-labelledby={tabButtonId("privileges")}
          >
            <p className={styles.rewardsModalIntro}>
              {copy.description.replace("{name}", user.name)}
            </p>
            <FormField label={copy.discountLabel} description={copy.discountHint}>
              <div className={styles.rewardsDiscountControls}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={discountInput}
                  disabled={isPending}
                  placeholder={copy.discountPlaceholder}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
                <input
                  type="range"
                  className={styles.rewardsDiscountSlider}
                  min={0}
                  max={100}
                  step={1}
                  value={discountSlider}
                  disabled={isPending}
                  aria-label={copy.discountSliderAriaLabel}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
              </div>
            </FormField>
            <FormField label={copy.selectableLeaderLabel} description={copy.selectableLeaderHint}>
              <div className={styles.rewardsLeaderSwitchRow}>
                <button
                  type="button"
                  role="switch"
                  className={styles.rewardsLeaderSwitch}
                  aria-checked={selectableLeader}
                  aria-label={copy.selectableLeaderLabel}
                  disabled={isPending}
                  onClick={() => setSelectableLeader((prev) => !prev)}
                >
                  <span className={styles.rewardsLeaderSwitchTrack} aria-hidden>
                    <span className={styles.rewardsLeaderSwitchThumb} />
                  </span>
                </button>
                <span className={styles.rewardsLeaderSwitchLabel}>{copy.selectableLeaderLabel}</span>
              </div>
            </FormField>
            <FormField label={copy.loyaltyClubLabel} description={copy.loyaltyClubHint}>
              <Select
                value={loyaltyClub}
                disabled={isPending}
                onChange={(e) =>
                  setLoyaltyClub(e.target.value as "" | WorkspaceLoyaltyClubBadgeId)
                }
              >
                <option value="">{copy.loyaltyClubNone}</option>
                {WORKSPACE_LOYALTY_CLUB_BADGE_IDS.map((tier) => (
                  <option key={tier} value={tier}>
                    {LOYALTY_TIER_LABELS[tier]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={copy.labelsLabel} description={copy.labelsHint}>
              <div className={styles.rewardsLabelsEditor}>
                <div className={styles.rewardsLabelsInputRow}>
                  <Input
                    value={labelInput}
                    disabled={isPending}
                    placeholder={copy.labelsInputPlaceholder}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLabel();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" disabled={isPending} onClick={addLabel}>
                    {copy.labelsAddButton}
                  </Button>
                </div>
                {labelsDraft.length > 0 ? (
                  <div className={styles.rewardsLabelChips}>
                    {labelsDraft.map((label) => (
                      <span key={label} className={styles.rewardsLabelChip}>
                        {label}
                        <button
                          type="button"
                          className={styles.rewardsLabelChipRemove}
                          aria-label={copy.labelsRemoveAria.replace("{label}", label)}
                          disabled={isPending}
                          onClick={() => removeLabel(label)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </FormField>
            {errorMessage ? (
              <p className={styles.rewardsModalError} role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            role="tabpanel"
            id={tabPanelId("trips")}
            aria-labelledby={tabButtonId("trips")}
          >
            {tripHistoryQuery.isLoading ? (
              <p className={styles.tripHistoryPlaceholder}>{copy.tripHistoryLoading}</p>
            ) : tripHistoryQuery.isError ? (
              <p className={styles.tripHistoryPlaceholder} role="alert">
                {copy.tripHistoryError}
              </p>
            ) : (tripHistoryQuery.data?.trips?.length ?? 0) === 0 ? (
              <p className={styles.tripHistoryPlaceholder}>{copy.tripHistoryEmpty}</p>
            ) : (
              <table className={styles.tripHistoryTable}>
                <thead>
                  <tr>
                    <th scope="col">{copy.tripColumnTour}</th>
                    <th scope="col">{copy.tripColumnDeparture}</th>
                    <th scope="col">{copy.tripColumnRegistration}</th>
                    <th scope="col">{copy.tripColumnPayment}</th>
                  </tr>
                </thead>
                <tbody>
                  {tripHistoryQuery.data!.trips.map((trip, index) => (
                    <tr key={`${trip.tourTitle}-${trip.departureDate ?? ""}-${index}`}>
                      <td>{trip.tourTitle}</td>
                      <td>{formatDepartureDateFa(trip.departureDate)}</td>
                      <td>
                        <span className={styles.tripHistoryStatusBadge}>
                          {formatRegistrationStatusFa(trip.registrationStatus)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.tripHistoryStatusBadge}>
                          {formatPaymentStatusFa(trip.paymentStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

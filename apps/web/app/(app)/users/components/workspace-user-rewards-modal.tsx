"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Checkbox, FormField, Input, Modal, Select } from "@tour/ui";
import {
  WORKSPACE_LOYALTY_CLUB_BADGE_IDS,
  WORKSPACE_REWARD_BADGE_IDS,
  type WorkspaceLoyaltyClubBadgeId,
  type WorkspaceRewardBadgeId
} from "@repo/shared";

import { ApiError } from "@/lib/api-client";
import { postWorkspaceUserRewards } from "@/shared/api/workspace-users.client";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

import { USERS_ROUTE_COPY } from "../users-copy";
import styles from "../users-page.module.css";

const copy = USERS_ROUTE_COPY.list.rewardsModal;

const LOYALTY_SET = new Set<string>(WORKSPACE_LOYALTY_CLUB_BADGE_IDS);
const NON_LOYALTY_BADGES = WORKSPACE_REWARD_BADGE_IDS.filter((id) => !LOYALTY_SET.has(id));

function formatBadgeLabel(id: string): string {
  return id
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function loyaltyFromUser(user: WorkspaceUserDto): "" | WorkspaceLoyaltyClubBadgeId {
  for (const badge of user.rewardBadges ?? []) {
    if (LOYALTY_SET.has(badge)) {
      return badge as WorkspaceLoyaltyClubBadgeId;
    }
  }
  return "";
}

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
  const [discountInput, setDiscountInput] = useState("");
  const [loyaltyClub, setLoyaltyClub] = useState<"" | WorkspaceLoyaltyClubBadgeId>("");
  const [selectableLeader, setSelectableLeader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) {
      return;
    }
    const discount =
      user.permanentDiscountPercentage !== undefined && user.permanentDiscountPercentage !== null
        ? String(user.permanentDiscountPercentage)
        : "";
    setDiscountInput(discount);
    setLoyaltyClub(loyaltyFromUser(user));
    setSelectableLeader(Boolean(user.isSelectableLeader));
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [open, user]);

  const canSubmit = useMemo(() => !isSubmitting && Boolean(user?.id), [isSubmitting, user?.id]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!user || !canSubmit) return;
    setErrorMessage(null);
    const trimmed = discountInput.trim();
    let permanentDiscountPercentage: number | undefined;
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
        setErrorMessage(copy.discountValidationError);
        return;
      }
      permanentDiscountPercentage = parsed;
    }

    const preservedNonLoyalty = (user.rewardBadges ?? []).filter(
      (b): b is WorkspaceRewardBadgeId =>
        (NON_LOYALTY_BADGES as readonly string[]).includes(b)
    );
    const badges: WorkspaceRewardBadgeId[] = [...preservedNonLoyalty];
    if (loyaltyClub) {
      badges.push(loyaltyClub);
    }

    setIsSubmitting(true);
    try {
      await postWorkspaceUserRewards(user.id, {
        permanentDiscountPercentage,
        badges,
        isSelectableLeader: selectableLeader
      });
      toast.success({ message: copy.savedToast });
      await onSaved?.();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : copy.saveErrorFallback;
      setErrorMessage(message);
      toast.error({ message });
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, discountInput, loyaltyClub, onClose, onSaved, selectableLeader, toast, user]);

  if (!user) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={copy.title}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={handleClose}>
            {copy.cancelButton}
          </Button>
          <Button type="button" variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {isSubmitting ? copy.savingButton : copy.saveButton}
          </Button>
        </>
      }
    >
      <div className={styles.rewardsModalBody}>
        <p className={styles.rewardsModalIntro}>
          {copy.description.replace("{name}", user.name)}
        </p>
        <FormField label={copy.discountLabel} description={copy.discountHint}>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            value={discountInput}
            disabled={isSubmitting}
            placeholder={copy.discountPlaceholder}
            onChange={(e) => setDiscountInput(e.target.value)}
          />
        </FormField>
        <FormField label={copy.selectableLeaderLabel} description={copy.selectableLeaderHint}>
          <Checkbox
            label={copy.selectableLeaderLabel}
            checked={selectableLeader}
            disabled={isSubmitting}
            onChange={(e) => setSelectableLeader(e.target.checked)}
          />
        </FormField>
        <FormField label={copy.loyaltyClubLabel} description={copy.loyaltyClubHint}>
          <Select
            value={loyaltyClub}
            disabled={isSubmitting}
            onChange={(e) =>
              setLoyaltyClub(e.target.value as "" | WorkspaceLoyaltyClubBadgeId)
            }
          >
            <option value="">{copy.loyaltyClubNone}</option>
            {WORKSPACE_LOYALTY_CLUB_BADGE_IDS.map((tier) => (
              <option key={tier} value={tier}>
                {formatBadgeLabel(tier)}
              </option>
            ))}
          </Select>
        </FormField>
        {errorMessage ? (
          <p className={styles.rewardsModalError} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

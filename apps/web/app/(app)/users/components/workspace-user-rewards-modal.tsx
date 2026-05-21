"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, FormField, Input, Modal } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import {
  WORKSPACE_REWARD_BADGE_IDS,
  postWorkspaceUserRewards,
  type WorkspaceRewardBadgeId
} from "@/shared/api/workspace-users.client";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

import { USERS_ROUTE_COPY } from "../users-copy";
import styles from "../users-page.module.css";

const copy = USERS_ROUTE_COPY.list.rewardsModal;

function formatBadgeLabel(id: string): string {
  return id
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
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
  const [selectedBadges, setSelectedBadges] = useState<Set<WorkspaceRewardBadgeId>>(new Set());
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
    setSelectedBadges(new Set((user.rewardBadges ?? []) as WorkspaceRewardBadgeId[]));
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [open, user]);

  const canSubmit = useMemo(() => !isSubmitting && Boolean(user?.id), [isSubmitting, user?.id]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  const toggleBadge = useCallback((badge: WorkspaceRewardBadgeId) => {
    setSelectedBadges((prev) => {
      const next = new Set(prev);
      if (next.has(badge)) {
        next.delete(badge);
      } else {
        next.add(badge);
      }
      return next;
    });
  }, []);

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
    setIsSubmitting(true);
    try {
      await postWorkspaceUserRewards(user.id, {
        permanentDiscountPercentage,
        badges: [...selectedBadges]
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
  }, [canSubmit, discountInput, onClose, onSaved, selectedBadges, toast, user]);

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
        <fieldset className={styles.rewardsBadgeFieldset}>
          <legend className={styles.rewardsBadgeLegend}>{copy.badgesLegend}</legend>
          <div className={styles.rewardsBadgeToggles}>
            {WORKSPACE_REWARD_BADGE_IDS.map((badge) => {
              const active = selectedBadges.has(badge);
              return (
                <button
                  key={badge}
                  type="button"
                  className={[
                    styles.rewardBadgeToggle,
                    active ? styles.rewardBadgeToggleActive : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={active}
                  disabled={isSubmitting}
                  onClick={() => toggleBadge(badge)}
                >
                  {formatBadgeLabel(badge)}
                </button>
              );
            })}
          </div>
        </fieldset>
        {errorMessage ? (
          <p className={styles.rewardsModalError} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

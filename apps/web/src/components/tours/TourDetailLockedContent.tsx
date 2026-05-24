"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@tour/ui";

import {
  formatGpsUnlockCountdown,
  isGpsUnlockPending,
} from "@/lib/tours/tour-detail-gps-countdown";

import styles from "@/app/(app)/tours/[id]/tour-detail-client.module.css";

export type TourDetailLockedReason =
  | "itinerary"
  | "gps"
  | "logistics"
  | "participation"
  | "policies"
  | "program_notes"
  | "gathering";

export type TourDetailLockedVariant = "guest" | "gps_pending" | "section";

export type TourDetailLockedContentProps = {
  reason: TourDetailLockedReason;
  variant: TourDetailLockedVariant;
  unlockAt?: string | null;
  onRegister?: () => void;
  showRegister?: boolean;
};

const REASON_TITLE_KEY: Record<TourDetailLockedReason, string> = {
  itinerary: "detail_locked_itinerary_title",
  program_notes: "detail_locked_program_notes_title",
  gathering: "detail_locked_gathering_title",
  gps: "detail_locked_gathering_title",
  logistics: "detail_locked_gathering_title",
  participation: "detail_participationSection",
  policies: "detail_policiesSection",
};

const REASON_HINT_KEY: Partial<Record<TourDetailLockedReason, string>> = {
  itinerary: "detail_locked_itinerary",
  logistics: "detail_locked_logistics",
  participation: "detail_locked_participation",
  policies: "detail_locked_policies",
  program_notes: "detail_locked_itinerary",
  gathering: "detail_locked_logistics",
  gps: "detail_locked_gps",
};

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function TourDetailLockedContent({
  reason,
  variant,
  unlockAt,
  onRegister,
  showRegister = false,
}: TourDetailLockedContentProps) {
  const t = useTranslations("tours");
  const locale = useLocale();

  const headingKey =
    variant === "gps_pending"
      ? "detail_locked_heading_gps_soon"
      : "detail_locked_heading_exclusive";

  const bodyKey =
    variant === "gps_pending" ? "detail_locked_body_gps" : "detail_locked_body_guest";

  const reasonTitleKey = REASON_TITLE_KEY[reason] as Parameters<typeof t>[0];
  const reasonHintKey = REASON_HINT_KEY[reason] as Parameters<typeof t>[0] | undefined;

  const countdown =
    variant === "gps_pending" && unlockAt && isGpsUnlockPending(unlockAt)
      ? formatGpsUnlockCountdown(unlockAt, new Date(), locale)
      : null;

  const unlockLabel =
    variant === "gps_pending" && unlockAt
      ? new Date(unlockAt).toLocaleString(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  return (
    <div
      className={styles.lockedContent}
      data-testid={`tour-detail-locked-${reason}`}
      data-variant={variant}
      role="status"
    >
      <div className={styles.lockedContentIcon}>
        <LockIcon />
      </div>
      <div className={styles.lockedContentText}>
        <p className={styles.lockedContentHeading}>{t(headingKey)}</p>
        {variant !== "gps_pending" && reasonTitleKey ? (
          <p className={styles.lockedContentTitle}>{t(reasonTitleKey)}</p>
        ) : null}
        <p className={styles.lockedContentBody}>{t(bodyKey)}</p>
        {reasonHintKey && variant === "section" ? (
          <p className={styles.lockedContentBody}>{t(reasonHintKey)}</p>
        ) : null}
        {countdown ? (
          <p className={styles.lockedContentMeta}>
            {t("detail_locked_gps_countdown", { remaining: countdown })}
          </p>
        ) : null}
        {unlockLabel && variant === "gps_pending" ? (
          <p className={styles.lockedContentMeta}>
            {t("detail_locked_gps_unlock_at", { time: unlockLabel })}
          </p>
        ) : null}
      </div>
      {showRegister && variant === "guest" && onRegister ? (
        <div className={styles.lockedContentActions}>
          <Button type="button" variant="primary" onClick={onRegister}>
            {t("detail_locked_register_cta")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import React from "react";
import { resolveBookingJourneyState } from "@app-tour/booking-http-contracts";

type Translate = (key: string) => string;

const KNOWN_STATUSES = ["pending", "approved", "waitlisted", "rejected", "cancelled"] as const;
const KNOWN_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;

function normalizeStatus(
  status: string
): ((typeof KNOWN_STATUSES)[number]) | null {
  const normalized = status.trim().toLowerCase();
  return KNOWN_STATUSES.find((value) => value === normalized) ?? null;
}

function normalizePaymentStatus(
  paymentStatus: string
): ((typeof KNOWN_PAYMENT_STATUSES)[number]) | null {
  const normalized = paymentStatus.trim().toLowerCase();
  return KNOWN_PAYMENT_STATUSES.find((value) => value === normalized) ?? null;
}

type MemberRegistrationJourneySummaryProps = {
  readonly status: string;
  readonly paymentStatus: string;
  readonly translateLabel: Translate;
  readonly translateHint?: Translate;
  readonly className?: string;
};

export function MemberRegistrationJourneySummary({
  status,
  paymentStatus,
  translateLabel,
  translateHint,
  className,
}: MemberRegistrationJourneySummaryProps) {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === null) {
    return null;
  }

  const normalizedPaymentStatus =
    normalizedStatus === "approved" ? normalizePaymentStatus(paymentStatus) : "unpaid";
  if (normalizedPaymentStatus === null) {
    return null;
  }

  const journey = resolveBookingJourneyState({
    status: normalizedStatus,
    paymentStatus: normalizedPaymentStatus,
  });
  const hint =
    translateHint === undefined ||
    (journey !== "approved_unpaid" &&
      journey !== "approved_partial" &&
      journey !== "approved_paid")
      ? null
      : translateHint(journey);

  return (
    <div
      data-portal-member-registration-journey
      data-journey-state={journey}
      className={className}
    >
      <p data-portal-member-registration-journey-label>{translateLabel(journey)}</p>
      {hint !== null ? (
        <p data-portal-member-registration-journey-hint>{hint}</p>
      ) : null}
    </div>
  );
}

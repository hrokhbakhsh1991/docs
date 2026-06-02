"use client";

import Link from "next/link";

import type { BookingDto } from "@repo/types";

import { useRegistrationDetails } from "@/hooks/useRegistrationDetails";
import type { ReviewInspectionSelection } from "@/features/leader-review/types";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";
import {
  formatRegistrationCrmSummary,
  formatRegistrationInstantFa,
} from "@/lib/registrations/format-registration-crm";
import {
  formatPaymentStatusFa,
  formatRegistrationStatusFa,
} from "@/lib/registrations/format-registration-status-fa";

import { LEADER_REVIEW_COPY } from "../leader-review-copy";

import { Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState } from "@tour/ui";

const copy = LEADER_REVIEW_COPY.inspection;

export type ReviewInspectionPanelProps = {
  selectedRegistrationId: string | null;
  selectedRegistrationFallback: ReviewInspectionSelection;
};

function renderMaybeValue(value: unknown): string {
  if (value == null) return copy.none;
  const s = String(value).trim();
  return s === "" ? copy.none : s;
}

function InspectionDetailsBody({
  registration,
  tourTitle,
  showFallbackWarning,
}: {
  registration: BookingDto;
  tourTitle: string;
  showFallbackWarning: boolean;
}) {
  const crm = formatRegistrationCrmSummary(registration);

  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <div>
        <strong>{registration.participantFullName}</strong> · {registration.participantContactPhone}
      </div>
      <div>
        {copy.tour}: {tourTitle} ({registration.tourId})
      </div>
      <div>
        {copy.status}: {formatRegistrationStatusFa(registration.status)} · {copy.payment}:{" "}
        {formatPaymentStatusFa(registration.paymentStatus)}
      </div>
      <div>
        {copy.paidAmount}: {renderMaybeValue(registration.paidAmount)}
      </div>
      <div>
        {copy.transport}: {crm.transportLabel}
        {crm.seatBadge ? ` · ${crm.seatBadge}` : ""}
      </div>
      <div>
        {copy.entryMode}: {registration.entryMode === "telegram" ? "تلگرام" : "وب"}
      </div>
      <div>
        {copy.telegram}:{" "}
        {renderMaybeValue(registration.telegramUsername ?? registration.telegramUserId)}
      </div>
      <div>
        {copy.participantNote}: {renderMaybeValue(registration.participantNote)}
      </div>
      <div>
        {copy.paymentContext}:{" "}
        {renderMaybeValue(registration.payment ? JSON.stringify(registration.payment) : null)}
      </div>
      <div>
        {copy.reasonContext}:{" "}
        {renderMaybeValue(
          registration.payment &&
            typeof registration.payment === "object" &&
            ("reason" in registration.payment
              ? (registration.payment as Record<string, unknown>).reason
              : "conversionReason" in registration.payment
                ? (registration.payment as Record<string, unknown>).conversionReason
                : null),
        )}
      </div>
      <div>
        {copy.updated}: {formatRegistrationInstantFa(registration.updatedAt)}
      </div>
      {showFallbackWarning ? (
        <p role="status" style={{ margin: 0, color: "var(--color-warning-fg, #b54708)" }}>
          {copy.fallbackWarning}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link href={`/tours/${registration.tourId}/workspace`}>{copy.openWorkspace}</Link>
      </div>
    </div>
  );
}

export function ReviewInspectionPanel({
  selectedRegistrationId,
  selectedRegistrationFallback,
}: ReviewInspectionPanelProps) {
  const details = useRegistrationDetails(
    selectedRegistrationId,
    selectedRegistrationFallback ?? null,
  );

  const registration = details.registration;
  const tourTitle = selectedRegistrationFallback?.tourTitle ?? copy.none;

  return (
    <Card style={{ marginTop: "1rem" }}>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardBody>
        {!selectedRegistrationId ? (
          <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
        ) : details.isLoading ? (
          <LoadingState message={copy.loading} />
        ) : details.isError ? (
          <ErrorState
            title={copy.loadErrorTitle}
            message={mapToUserMessage(details.error, { fallback: copy.loadErrorFallback })}
            onRetry={details.refetch}
          />
        ) : registration ? (
          <InspectionDetailsBody
            registration={registration}
            tourTitle={tourTitle}
            showFallbackWarning={details.source === "fallback"}
          />
        ) : (
          <EmptyState
            title={copy.emptyTitle}
            description="ردی دیگری انتخاب کنید یا داده را بروزرسانی کنید."
          />
        )}
      </CardBody>
    </Card>
  );
}

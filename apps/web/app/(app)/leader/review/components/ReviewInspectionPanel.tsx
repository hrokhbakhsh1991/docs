"use client";

import Link from "next/link";

import { useRegistrationDetails } from "@/hooks/useRegistrationDetails";
import type { ReviewInspectionSelection } from "@/features/leader-review/types";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";

import { Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorState, LoadingState } from "@tour/ui";

export type ReviewInspectionPanelProps = {
  selectedRegistrationId: string | null;
  selectedRegistrationFallback: ReviewInspectionSelection;
};

function renderMaybeValue(value: unknown): string {
  if (value == null) return "—";
  const s = String(value).trim();
  return s === "" ? "—" : s;
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
  const tourTitle = selectedRegistrationFallback?.tourTitle ?? "—";

  return (
    <Card style={{ marginTop: "1rem" }}>
      <CardHeader>
        <CardTitle>Inspection panel</CardTitle>
      </CardHeader>
      <CardBody>
        {!selectedRegistrationId ? (
          <EmptyState
            title="No item selected"
            description="Use “Inspect details” from the review table to inspect a registration."
          />
        ) : details.isLoading ? (
          <LoadingState message="Loading registration details…" />
        ) : details.isError ? (
          <ErrorState
            title="Could not load registration details"
            message={mapToUserMessage(details.error, { fallback: "Request failed." })}
            onRetry={details.refetch}
          />
        ) : registration ? (
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <div>
              <strong>{registration.participantFullName}</strong> ·{" "}
              {registration.participantContactPhone}
            </div>
            <div>
              Tour: {tourTitle} ({registration.tourId})
            </div>
            <div>
              Status: {registration.status} · Payment: {registration.paymentStatus}
            </div>
            <div>Paid amount: {renderMaybeValue(registration.paidAmount)}</div>
            <div>Transport: {renderMaybeValue(registration.transportMode)}</div>
            <div>Entry mode: {renderMaybeValue(registration.entryMode)}</div>
            <div>Telegram user: {renderMaybeValue(registration.telegramUsername ?? registration.telegramUserId)}</div>
            <div>Vehicle seats: {renderMaybeValue(registration.vehicleSeatCapacity)}</div>
            <div>Participant note: {renderMaybeValue(registration.participantNote)}</div>
            <div>Payment context: {renderMaybeValue(registration.payment ? JSON.stringify(registration.payment) : null)}</div>
            <div>
              Reason/context:{" "}
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
            <div>Updated: {new Date(registration.updatedAt).toLocaleString()}</div>
            {details.source === "fallback" ? (
              <p role="status" style={{ margin: 0, color: "var(--color-warning-fg, #b54708)" }}>
                Showing fallback row projection (details endpoint unavailable).
              </p>
            ) : null}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link href={`/tours/${registration.tourId}/workspace`}>Open tour workspace</Link>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No details available"
            description="Select another registration or refresh details."
          />
        )}
      </CardBody>
    </Card>
  );
}


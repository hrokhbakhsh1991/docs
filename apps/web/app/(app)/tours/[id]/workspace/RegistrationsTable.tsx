"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { BookingDto } from "@repo/types";
import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

import { BookingStatusBadge, PaymentStatusBadge } from "../../../bookings/booking-badges";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "@tour/ui";

import { PAYMENT_OPTIONS, STATUS_OPTIONS } from "./tour-workspace-ui";

import styles from "./tour-workspace.module.css";

export type RegistrationsTableProps = {
  registrations: BookingDto[];
  filter: "all" | "pending";
  onFilterChange: (next: "all" | "pending") => void;
  readOnly: boolean;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  statusMutation: UseMutationResult<
    BookingDto,
    Error,
    { id: string; targetStatus: RegistrationStatus }
  >;
  paymentMutation: UseMutationResult<
    BookingDto,
    Error,
    { id: string; paymentStatus: RegistrationPaymentStatus; paidAmount?: number }
  >;
};

export function RegistrationsTable({
  registrations,
  filter,
  onFilterChange,
  readOnly,
  isLoading,
  isError,
  onRetry,
  statusMutation,
  paymentMutation,
}: RegistrationsTableProps) {
  const [statusDraft, setStatusDraft] = useState<Record<string, RegistrationStatus>>({});
  const [payDraft, setPayDraft] = useState<Record<string, RegistrationPaymentStatus>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  const displayedRegistrations = useMemo(() => {
    if (filter === "pending") {
      return registrations.filter((r) => r.status === "Pending");
    }
    return registrations;
  }, [filter, registrations]);

  function statusFor(reg: BookingDto): RegistrationStatus {
    return statusDraft[reg.id] ?? reg.status;
  }

  function paymentFor(reg: BookingDto): RegistrationPaymentStatus {
    return payDraft[reg.id] ?? reg.paymentStatus;
  }

  return (
    <Card>
      <CardHeader>
        <div className={styles.workspaceHeader}>
          <CardTitle className={styles.workspaceCardTitle}>Registrations</CardTitle>
          <Select
            aria-label="Filter registrations list"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as "all" | "pending")}
          >
            <option value="all">All</option>
            <option value="pending">Pending review</option>
          </Select>
        </div>
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <LoadingState message="Loading registrations…" />
        ) : isError ? (
          <ErrorState title="Could not load registrations" onRetry={onRetry} />
        ) : displayedRegistrations.length === 0 ? (
          <EmptyState
            embedded
            title={
              filter === "pending" ? "No pending registrations" : "No registrations yet"
            }
            description={
              filter === "pending"
                ? "There are no registrations awaiting review for this tour."
                : "Registrations will appear here once participants sign up."
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Tour registrations">
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th scope="col">Statuses</th>
                  <th scope="col">Update status</th>
                  <th scope="col">Payment ops</th>
                </tr>
              </thead>
              <tbody>
                {displayedRegistrations.map((reg) => (
                  <tr key={reg.id}>
                    <th scope="row" className={styles.rowHeader}>
                      <div>{reg.participantFullName}</div>
                      <div className={styles.muted}>{reg.participantContactPhone}</div>
                      <div className={styles.mono}>{reg.id.slice(0, 8)}…</div>
                    </th>
                    <td>
                      <div className={styles.badgeRow}>
                        <BookingStatusBadge status={reg.status} />
                        <PaymentStatusBadge payment={reg.paymentStatus} />
                      </div>
                    </td>
                    <td>
                      <div className={styles.controls}>
                        <Select
                          aria-label={`Status for ${reg.id}`}
                          value={statusFor(reg)}
                          disabled={readOnly}
                          onChange={(e) =>
                            setStatusDraft((d) => ({
                              ...d,
                              [reg.id]: e.target.value as RegistrationStatus,
                            }))
                          }
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        {readOnly ? null : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={statusMutation.isPending || statusFor(reg) === reg.status}
                            onClick={() =>
                              statusMutation.mutate({ id: reg.id, targetStatus: statusFor(reg) })
                            }
                          >
                            Apply
                          </Button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.controls}>
                        <Select
                          aria-label={`Payment for ${reg.id}`}
                          value={paymentFor(reg)}
                          disabled={readOnly}
                          onChange={(e) =>
                            setPayDraft((d) => ({
                              ...d,
                              [reg.id]: e.target.value as RegistrationPaymentStatus,
                            }))
                          }
                        >
                          {PAYMENT_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Paid amount"
                          disabled={readOnly}
                          value={amountDraft[reg.id] ?? ""}
                          aria-label={`Paid amount for ${reg.participantFullName}`}
                          onChange={(e) =>
                            setAmountDraft((d) => ({
                              ...d,
                              [reg.id]: e.target.value,
                            }))
                          }
                        />
                        {readOnly ? null : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={paymentMutation.isPending}
                            onClick={() => {
                              const raw = amountDraft[reg.id]?.trim();
                              const paidAmount =
                                raw === "" || raw === undefined ? undefined : Number(raw);
                              paymentMutation.mutate({
                                id: reg.id,
                                paymentStatus: paymentFor(reg),
                                ...(typeof paidAmount === "number" && !Number.isNaN(paidAmount)
                                  ? { paidAmount }
                                  : {}),
                              });
                            }}
                          >
                            Save payment
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

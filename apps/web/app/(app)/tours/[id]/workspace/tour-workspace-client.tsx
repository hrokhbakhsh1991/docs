"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, LEADER_WORKSPACE_ACCESS_DENIED, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { registrationKeys, tourKeys } from "@/lib/query-keys";
import {
  convertWaitlistItem,
  listRegistrationsForTour,
  listWaitlistItemsForTour,
  registrationsUseLiveApi,
  updateRegistrationPayment,
  updateRegistrationStatus,
} from "@/lib/services/registrations.service";
import { getTourById, toursUseLiveApi } from "@/lib/services/tours.service";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  type BreadcrumbItem,
} from "@tour/ui";

import type { BookingDto } from "@repo/types";
import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import type { WaitlistItemResponseDto } from "@repo/types";

import { BookingStatusBadge, PaymentStatusBadge } from "../../../bookings/booking-badges";

import styles from "./tour-workspace.module.css";

const STATUS_OPTIONS: RegistrationStatus[] = [
  "Pending",
  "Accepted",
  "AcceptedPaid",
  "Rejected",
  "Cancelled",
  "NoShow",
  "Refunded",
];

const PAYMENT_OPTIONS: RegistrationPaymentStatus[] = ["NotPaid", "Partial", "Paid"];

export type TourWorkspaceClientProps = {
  tourId: string;
};

export function TourWorkspaceClient({ tourId }: TourWorkspaceClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi() && registrationsUseLiveApi();
  const tourEnabled =
    Boolean(tourId) && toursUseLiveApi() && isHydrated && isAuthenticated && leader;
  const dataEnabled =
    Boolean(tourId) && liveApi && isHydrated && isAuthenticated && leader;

  const tourQuery = useQuery({
    queryKey: tourKeys.detail(tourId),
    queryFn: () => getTourById(tourId),
    enabled: tourEnabled,
  });

  const regQuery = useQuery({
    queryKey: registrationKeys.tourRegistrations(tourId),
    queryFn: () => listRegistrationsForTour(tourId),
    enabled: dataEnabled,
  });

  const waitQuery = useQuery({
    queryKey: registrationKeys.tourWaitlist(tourId),
    queryFn: () => listWaitlistItemsForTour(tourId),
    enabled: dataEnabled,
  });

  const [registrationListFilter, setRegistrationListFilter] = useState<"all" | "pending">("all");
  const [statusDraft, setStatusDraft] = useState<Record<string, RegistrationStatus>>({});
  const [payDraft, setPayDraft] = useState<Record<string, RegistrationPaymentStatus>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  const registrations = useMemo(() => regQuery.data ?? [], [regQuery.data]);
  const waitlist = useMemo(() => waitQuery.data ?? [], [waitQuery.data]);

  const displayedRegistrations = useMemo(() => {
    if (registrationListFilter === "pending") {
      return registrations.filter((r) => r.status === "Pending");
    }
    return registrations;
  }, [registrationListFilter, registrations]);

  const invalidateTourData = () => {
    void queryClient.invalidateQueries({ queryKey: registrationKeys.tourRegistrations(tourId) });
    void queryClient.invalidateQueries({ queryKey: registrationKeys.tourWaitlist(tourId) });
    void queryClient.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, targetStatus }: { id: string; targetStatus: RegistrationStatus }) => {
      return updateRegistrationStatus(id, targetStatus);
    },
    onSuccess: invalidateTourData,
  });

  const paymentMutation = useMutation({
    mutationFn: async ({
      id,
      paymentStatus,
      paidAmount,
    }: {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
    }) => {
      return updateRegistrationPayment(id, { paymentStatus, paidAmount });
    },
    onSuccess: invalidateTourData,
  });

  const convertMutation = useMutation({
    mutationFn: (waitlistItemId: string) => convertWaitlistItem(waitlistItemId),
    onSuccess: invalidateTourData,
  });

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tours", href: "/tours" },
    { label: tourQuery.data?.title ?? "Tour" },
    { label: "Registrations workspace" },
  ];

  const pendingRegs = useMemo(
    () => registrations.filter((r) => r.status === "Pending"),
    [registrations],
  );

  if (toursUseLiveApi() && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
      >
        <Card>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
      >
        <EmptyState
          title="Sign in required"
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (!leader) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
      >
        <EmptyState
          title={LEADER_WORKSPACE_ACCESS_DENIED.title}
          description={LEADER_WORKSPACE_ACCESS_DENIED.description}
          action={
            <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}`)}>
              Back to tour
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (tourQuery.isPending) {
    return (
      <RegisteredWorkspacePage documentTitle="Workspace" title="Leader workspace" breadcrumbItems={breadcrumbItems}>
        <LoadingState message="Loading tour…" />
      </RegisteredWorkspacePage>
    );
  }

  if (tourQuery.isError || !tourQuery.data) {
    return (
      <RegisteredWorkspacePage documentTitle="Workspace" title="Leader workspace" breadcrumbItems={breadcrumbItems}>
        <ErrorState
          title="Could not load tour"
          message={
            tourQuery.error instanceof ApiError ? tourQuery.error.message : "Unknown error"
          }
          onRetry={() => void tourQuery.refetch()}
        />
      </RegisteredWorkspacePage>
    );
  }

  function statusFor(reg: BookingDto): RegistrationStatus {
    return statusDraft[reg.id] ?? reg.status;
  }

  function paymentFor(reg: BookingDto): RegistrationPaymentStatus {
    return payDraft[reg.id] ?? reg.paymentStatus;
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={`Workspace · ${tourQuery.data.title}`}
      title="Registrations workspace"
      description={`${tourQuery.data.title} · ${tourQuery.data.acceptedCount}/${tourQuery.data.totalCapacity} accepted`}
      breadcrumbItems={breadcrumbItems}
      actions={
        <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}`)}>
          Tour details
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Overview (J‑L‑02)</CardTitle>
        </CardHeader>
        <CardBody>
          <p>
            Pending review: <strong>{pendingRegs.length}</strong> · Total registrations in list:{" "}
            <strong>{registrations.length}</strong> · Waitlist entries: <strong>{waitlist.length}</strong>
          </p>
          <p style={{ opacity: 0.85, fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Cross-tour reconciliation: use Dashboard → Review queue → Export CSV (built from live list endpoints).
          </p>
          {statusMutation.isError || paymentMutation.isError || convertMutation.isError ? (
            <p role="alert" className={styles.errorBanner}>
              {statusMutation.error instanceof ApiError ? statusMutation.error.message : ""}
              {paymentMutation.error instanceof ApiError ? paymentMutation.error.message : ""}
              {convertMutation.error instanceof ApiError ? convertMutation.error.message : ""}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <CardTitle style={{ margin: 0 }}>Registrations</CardTitle>
            <Select
              aria-label="Filter registrations list"
              value={registrationListFilter}
              onChange={(e) => setRegistrationListFilter(e.target.value as "all" | "pending")}
            >
              <option value="all">All</option>
              <option value="pending">Pending review</option>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          {regQuery.isPending ? (
            <LoadingState message="Loading registrations…" />
          ) : regQuery.isError ? (
            <ErrorState title="Could not load registrations" onRetry={() => void regQuery.refetch()} />
          ) : displayedRegistrations.length === 0 ? (
            <p>
              {registrationListFilter === "pending"
                ? "No pending registrations for this tour."
                : "No registrations yet for this tour."}
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Statuses</th>
                    <th>Update status</th>
                    <th>Payment ops</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRegistrations.map((reg) => (
                    <tr key={reg.id}>
                      <td>
                        <div>{reg.participantFullName}</div>
                        <div className={styles.muted}>{reg.participantContactPhone}</div>
                        <div className={styles.mono}>{reg.id.slice(0, 8)}…</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <BookingStatusBadge status={reg.status} />
                          <PaymentStatusBadge payment={reg.paymentStatus} />
                        </div>
                      </td>
                      <td>
                        <div className={styles.controls}>
                          <Select
                            aria-label={`Status for ${reg.id}`}
                            value={statusFor(reg)}
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
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={
                              statusMutation.isPending ||
                              statusFor(reg) === reg.status
                            }
                            onClick={() =>
                              statusMutation.mutate({ id: reg.id, targetStatus: statusFor(reg) })
                            }
                          >
                            Apply
                          </Button>
                        </div>
                      </td>
                      <td>
                        <div className={styles.controls}>
                          <Select
                            aria-label={`Payment for ${reg.id}`}
                            value={paymentFor(reg)}
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
                          <input
                            className={styles.smallInput}
                            type="number"
                            min={0}
                            placeholder="paid amount"
                            value={amountDraft[reg.id] ?? ""}
                            onChange={(e) =>
                              setAmountDraft((d) => ({
                                ...d,
                                [reg.id]: e.target.value,
                              }))
                            }
                          />
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

      <Card>
        <CardHeader>
          <CardTitle>Waitlist (J‑L‑03)</CardTitle>
        </CardHeader>
        <CardBody>
          {waitQuery.isPending ? (
            <LoadingState message="Loading waitlist…" />
          ) : waitQuery.isError ? (
            <ErrorState title="Could not load waitlist" onRetry={() => void waitQuery.refetch()} />
          ) : waitlist.length === 0 ? (
            <p>No waitlist entries.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Status</th>
                    <th>Convert</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((w: WaitlistItemResponseDto) => (
                    <tr key={w.id}>
                      <td>
                        <div>{w.participantFullName}</div>
                        <div className={styles.muted}>{w.participantContactPhone}</div>
                      </td>
                      <td>{w.status}</td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={w.status !== "Waiting" || convertMutation.isPending}
                          onClick={() => convertMutation.mutate(w.id)}
                        >
                          Convert
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}

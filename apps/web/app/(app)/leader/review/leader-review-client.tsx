"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import listStyles from "../../bookings/bookings.module.css";
import { BookingStatusBadge, PaymentStatusBadge } from "../../bookings/booking-badges";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { downloadCsv, registrationsToCsv } from "@/lib/export-registrations-csv";
import { useLeaderTourRegistrations } from "@/lib/hooks/useLeaderTourRegistrations";
import { registrationKeys, tourKeys } from "@/lib/query-keys";
import {
  registrationsUseLiveApi,
  updateRegistrationPayment,
  updateRegistrationStatus,
} from "@/lib/services/registrations.service";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import type { LeaderRegistrationRow } from "@/lib/hooks/useLeaderTourRegistrations";
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

const breadcrumbItems: BreadcrumbItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Review queue" },
];

export function LeaderReviewClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const hasTenantId = Boolean(user?.tenantId?.trim());
  const liveApi = toursUseLiveApi() && registrationsUseLiveApi();
  const hookEnabled = Boolean(leader && hasTenantId && liveApi && isHydrated && isAuthenticated);

  const leaderData = useLeaderTourRegistrations(hookEnabled);

  const [queueFilter, setQueueFilter] = useState<"pending" | "all">("pending");
  const [statusDraft, setStatusDraft] = useState<Record<string, RegistrationStatus>>({});
  const [payDraft, setPayDraft] = useState<Record<string, RegistrationPaymentStatus>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: registrationKeys.all });
    await queryClient.invalidateQueries({ queryKey: tourKeys.all });
    await leaderData.refetchAll();
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, targetStatus }: { id: string; targetStatus: RegistrationStatus }) =>
      updateRegistrationStatus(id, targetStatus),
    onSuccess: async () => {
      await invalidateAll();
      toast.success({ message: "Registration status updated." });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError ? err.message.trim() || err.code || "Could not update status." : String(err);
      toast.error({ message: msg });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      paymentStatus: RegistrationPaymentStatus;
      paidAmount?: number;
    }) => updateRegistrationPayment(args.id, args),
    onSuccess: async () => {
      await invalidateAll();
      toast.success({ message: "Payment record updated." });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError ? err.message.trim() || err.code || "Could not update payment." : String(err);
      toast.error({ message: msg });
    },
  });

  const visibleRows = useMemo(() => {
    const src = queueFilter === "pending" ? leaderData.pendingRows : leaderData.rows;
    return [...src].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [leaderData.pendingRows, leaderData.rows, queueFilter]);

  const exportCsv = () => {
    const csv = registrationsToCsv(leaderData.rows);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`registrations-reconciliation-${stamp}.csv`, csv);
    toast.success({ message: `Exported ${leaderData.rows.length} row(s).` });
  };

  function statusFor(r: LeaderRegistrationRow): RegistrationStatus {
    return statusDraft[r.id] ?? r.status;
  }

  function paymentFor(r: LeaderRegistrationRow): RegistrationPaymentStatus {
    return payDraft[r.id] ?? r.paymentStatus;
  }

  if (toursUseLiveApi() && !isHydrated) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
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
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <EmptyState
              title="Sign in required"
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isHydrated && isAuthenticated && !isLeaderRole(user?.role)) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <p dir="rtl" style={{ margin: 0 }}>
              شما دسترسی رهبر ندارید.
            </p>
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isHydrated && isAuthenticated && isLeaderRole(user?.role) && !hasTenantId) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <p dir="rtl" style={{ margin: 0 }}>
              Tenant شما معتبر نیست. لطفاً دوباره وارد شوید.
            </p>
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!liveApi) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <EmptyState title="API not configured" description="NEXT_PUBLIC_API_URL is required." />
      </RegisteredWorkspacePage>
    );
  }

  if (leaderData.toursQuery.isError) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <ErrorState title="Could not load tours" onRetry={() => void leaderData.refetchTours()} />
      </RegisteredWorkspacePage>
    );
  }

  if (leaderData.isLoading) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <LoadingState message="Loading registrations across tours…" />
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle="Leader review queue"
      title="Registration review queue"
      description={`${leaderData.pendingCount} pending · ${leaderData.totalRegistrationCount} registrations loaded from tenant tours. Data refreshes when you mutate or revisit.`}
      breadcrumbItems={breadcrumbItems}
      actions={
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <Select
            aria-label="Filter queue"
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value as "pending" | "all")}
          >
            <option value="pending">Pending only</option>
            <option value="all">All statuses</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={leaderData.rows.length === 0}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
          <Button type="button" variant="secondary" disabled={leaderData.isLoading} onClick={() => void invalidateAll()}>
            Refresh data
          </Button>
        </div>
      }
    >
      <Card style={{ marginBottom: "1rem" }}>
        <CardHeader>
          <CardTitle>Leader workspace overview</CardTitle>
        </CardHeader>
        <CardBody>
          <p style={{ margin: 0 }}>
            Source: <strong>GET /api/v2/tours</strong> + parallel <strong>GET /api/v2/tours/{"{id}"}/registrations</strong>{" "}
            (OpenAPI contract). Bulk CSV substitutes for a dedicated export route when unavailable.
          </p>
          {leaderData.registrationsError ? (
            <p role="alert" style={{ marginTop: "0.75rem", color: "var(--color-danger-fg, #b42318)" }}>
              Some tours failed to load registrations. Try Refresh data.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queued registrations ({visibleRows.length} shown)</CardTitle>
        </CardHeader>
        <CardBody>
          {visibleRows.length === 0 ? (
            <EmptyState title="Nothing in this queue" description="Adjust the filter or check individual tour workspaces." />
          ) : (
            <div className={listStyles.tableWrap}>
              <table className={listStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Tour</th>
                    <th scope="col">Participant</th>
                    <th scope="col">Status</th>
                    <th scope="col">Update status</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Workspace</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div>{r.tourTitle}</div>
                        <Link className={listStyles.link} href={`/tours/${r.tourId}`}>
                          Tour · {r.tourId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td>
                        <div>{r.participantFullName}</div>
                        <div className={listStyles.cellMuted}>{r.participantContactPhone}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          <BookingStatusBadge status={r.status} />
                          <PaymentStatusBadge payment={r.paymentStatus} />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "10rem" }}>
                          <Select
                            aria-label={`Status for ${r.id}`}
                            value={statusFor(r)}
                            onChange={(e) =>
                              setStatusDraft((d) => ({
                                ...d,
                                [r.id]: e.target.value as RegistrationStatus,
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
                            disabled={statusMutation.isPending || statusFor(r) === r.status}
                            onClick={() => statusMutation.mutate({ id: r.id, targetStatus: statusFor(r) })}
                          >
                            Apply status
                          </Button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "10rem" }}>
                          <Select
                            aria-label={`Payment for ${r.id}`}
                            value={paymentFor(r)}
                            onChange={(e) =>
                              setPayDraft((d) => ({
                                ...d,
                                [r.id]: e.target.value as RegistrationPaymentStatus,
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
                            type="number"
                            min={0}
                            placeholder="Paid amount"
                            value={amountDraft[r.id] ?? ""}
                            onChange={(e) =>
                              setAmountDraft((d) => ({
                                ...d,
                                [r.id]: e.target.value,
                              }))
                            }
                            style={{
                              padding: "0.35rem 0.5rem",
                              borderRadius: 6,
                              border: "1px solid var(--color-border-default, #ccc)",
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={paymentMutation.isPending}
                            onClick={() => {
                              const raw = amountDraft[r.id]?.trim();
                              const paidAmount =
                                raw === "" || raw === undefined ? undefined : Number(raw);
                              paymentMutation.mutate({
                                id: r.id,
                                paymentStatus: paymentFor(r),
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
                      <td>
                        <Link className={listStyles.link} href={`/tours/${r.tourId}/workspace`}>
                          Open workspace
                        </Link>
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

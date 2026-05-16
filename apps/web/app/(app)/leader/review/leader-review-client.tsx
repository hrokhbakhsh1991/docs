"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ReviewFilters } from "./components/ReviewFilters";
import { ReviewInspectionPanel } from "./components/ReviewInspectionPanel";
import { ReviewSummaryCards } from "./components/ReviewSummaryCards";
import { ReviewTable } from "./components/ReviewTable";
import { useLeaderReviewFilters } from "./hooks/useLeaderReviewFilters";
import { useLeaderReviewState } from "./hooks/useLeaderReviewState";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useAuth } from "@/lib/auth/auth-context";
import { isLeaderReviewAllowed } from "@/lib/auth/leader-review-access";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";
import { downloadCsv, registrationsToCsv } from "@/lib/export-registrations-csv";
import { useLeaderTourRegistrations } from "@/lib/hooks/useLeaderTourRegistrations";
import {
  leaderDashboardSummaryKey,
  leaderRegistrationIndexKeys,
  registrationKeys,
  tourKeys,
} from "@/lib/query-keys";
import { registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";

import type { RegistrationStatus } from "@repo/types";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  type BreadcrumbItem,
} from "@tour/ui";

const breadcrumbItems: BreadcrumbItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Review queue" },
];

const REVIEWABLE_TARGETS: readonly RegistrationStatus[] = ["Accepted", "Rejected"];

export function LeaderReviewClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderReviewAllowed(user);
  const hasTenantId = Boolean(user?.tenantId?.trim());
  const liveApi = toursUseLiveApi() && registrationsUseLiveApi();
  const hookEnabled = Boolean(leader && hasTenantId && liveApi && isHydrated && isAuthenticated);

  const leaderData = useLeaderTourRegistrations(hookEnabled);

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: registrationKeys.all });
    await queryClient.invalidateQueries({ queryKey: tourKeys.all });
    await queryClient.invalidateQueries({ queryKey: leaderDashboardSummaryKey });
    await queryClient.invalidateQueries({ queryKey: leaderRegistrationIndexKeys.all });
    await leaderData.refetchAll();
  }, [queryClient, leaderData]);

  const filters = useLeaderReviewFilters(leaderData.rows, leaderData.pendingRows);
  const reviewState = useLeaderReviewState(leaderData.rows, filters.visibleRows, invalidateAll);

  const exportCsv = () => {
    const csv = registrationsToCsv(leaderData.rows);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`registrations-reconciliation-${stamp}.csv`, csv);
    toast.success({ message: `Exported ${leaderData.rows.length} row(s).` });
  };


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

  if (isHydrated && isAuthenticated && !leader) {
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <EmptyState title="Access restricted" description="Leader access is required for this dashboard." />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isHydrated && isAuthenticated && leader && !hasTenantId) {
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
        <EmptyState
          title="API not configured"
          description="Open this app on your workspace host (e.g. ws1-rbac.localhost) with the API running."
        />
      </RegisteredWorkspacePage>
    );
  }

  if (leaderData.isError) {
    const loadError =
      leaderData.registrationsError ?? leaderData.toursQuery.error ?? new Error("Failed to load review data");
    return (
      <RegisteredWorkspacePage documentTitle="Review queue" title="Review queue" breadcrumbItems={breadcrumbItems}>
        <ErrorState
          title="Could not load registrations"
          message={mapToUserMessage(loadError, {
            fallback: "Could not load registrations. Check your connection and try again.",
          })}
          onRetry={() => void leaderData.refetchAll()}
        />
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
      title="Leader review dashboard"
      description={`${filters.overview.pending} pending · ${filters.overview.total} total registrations across tenant tours.`}
      breadcrumbItems={breadcrumbItems}
    >
      <Card style={{ marginBottom: "1rem" }}>
        <CardHeader>
          <ReviewFilters
            value={filters.filtersState}
            isLoading={leaderData.isLoading}
            canExport={leaderData.rows.length > 0}
            onQueueFilterChange={filters.setQueueFilter}
            onStatusFilterChange={filters.setStatusFilter}
            onParticipantFilterChange={filters.setParticipantFilter}
            onFromDateChange={filters.setFromDate}
            onToDateChange={filters.setToDate}
            onExportCsv={exportCsv}
            onRefresh={() => void invalidateAll()}
            onClearFilters={filters.clearFilters}
          />
        </CardHeader>
      </Card>

      <ReviewSummaryCards overview={filters.overview} />

      <Card style={{ marginBottom: "1rem" }}>
        <CardHeader>
          <CardTitle>Reporting data sources</CardTitle>
        </CardHeader>
        <CardBody>
          {leaderData.partial ? (
            <p
              role="status"
              style={{
                marginTop: 0,
                marginBottom: "0.75rem",
                color: "var(--color-warning-fg, #b54708)",
              }}
            >
              Showing partial data (pagination limit)
            </p>
          ) : null}
          <p style={{ margin: 0 }}>
            Source: <strong>GET /api/v2/dashboard/leader-registration-rows</strong> (single tenant index).
            Mutations use <strong>PATCH /api/v2/registrations/{"{id}"}/status</strong> and{" "}
            <strong>PATCH /api/v2/registrations/{"{id}"}/payment</strong>.
          </p>
          {leaderData.registrationsError ? (
            <p role="alert" style={{ marginTop: "0.75rem", color: "var(--color-danger-fg, #b42318)" }}>
              Some tours failed to load registrations. Try Refresh data.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <ReviewTable
        rows={filters.visibleRows}
        amountDraft={reviewState.amountDraft}
        statusPendingRowId={reviewState.statusPendingRowId}
        paymentPendingRowId={reviewState.paymentPendingRowId}
        statusFor={reviewState.statusFor}
        paymentFor={reviewState.paymentFor}
        canQuickTransition={reviewState.canQuickTransition}
        registrationStatusOptions={reviewState.registrationStatusOptions}
        paymentStatusOptions={reviewState.paymentStatusOptions}
        paymentSaveIsNoOpForRow={reviewState.paymentSaveIsNoOpForRow}
        isTerminalBookingState={reviewState.isTerminalBookingState}
        isTerminalPaymentStateForRow={reviewState.isTerminalPaymentStateForRow}
        statusMutationIsErrorForRow={reviewState.statusMutationIsErrorForRow}
        paymentMutationIsErrorForRow={reviewState.paymentMutationIsErrorForRow}
        statusMutationErrorMessage={mapToUserMessage(reviewState.statusMutation.error, { fallback: "Request failed." })}
        paymentMutationErrorMessage={mapToUserMessage(reviewState.paymentMutation.error, { fallback: "Request failed." })}
        onStatusDraftChange={reviewState.setStatusDraft}
        onPayDraftChange={reviewState.setPayDraft}
        onAmountDraftChange={reviewState.setAmountDraft}
        onApplyStatus={reviewState.onApplyStatus}
        onSavePayment={reviewState.onSavePayment}
        onInspectRow={filters.setSelectedRegistrationId}
        reviewableTargets={REVIEWABLE_TARGETS}
      />

      <ReviewInspectionPanel
        selectedRegistrationId={filters.selectedRegistrationId}
        selectedRegistrationFallback={filters.selectedRegistration}
      />
    </RegisteredWorkspacePage>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ReviewFilters } from "./components/ReviewFilters";
import { ReviewInspectionPanel } from "./components/ReviewInspectionPanel";
import { ReviewSummaryCards } from "./components/ReviewSummaryCards";
import { ReviewTable } from "./components/ReviewTable";
import { useLeaderReviewFilters } from "./hooks/useLeaderReviewFilters";
import { useLeaderReviewState } from "./hooks/useLeaderReviewState";
import { LEADER_REVIEW_COPY } from "./leader-review-copy";
import pageStyles from "./leader-review-page.module.css";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useAuth } from "@/lib/auth/auth-context";
import { isLeaderReviewAllowed } from "@/lib/auth/leader-review-access";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";
import { downloadCsv, registrationsToCsv } from "@/lib/export-registrations-csv";
import { useLeaderTourRegistrations } from "@/lib/hooks/useLeaderTourRegistrations";
import {
  leaderDashboardSummaryKeys,
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

const copy = LEADER_REVIEW_COPY.page;
const reportingCopy = LEADER_REVIEW_COPY.reporting;

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

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: copy.breadcrumbHome, href: "/dashboard" },
      { label: copy.breadcrumbDashboard, href: "/dashboard" },
      { label: copy.breadcrumbQueue },
    ],
    [],
  );

  const leaderData = useLeaderTourRegistrations(hookEnabled);

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: registrationKeys.all });
    await queryClient.invalidateQueries({ queryKey: tourKeys.all });
    await queryClient.invalidateQueries({ queryKey: leaderDashboardSummaryKeys.all });
    await queryClient.invalidateQueries({ queryKey: leaderRegistrationIndexKeys.all });
    await leaderData.refetchAll();
  }, [queryClient, leaderData]);

  const filters = useLeaderReviewFilters(leaderData.rows, leaderData.pendingRows);
  const reviewState = useLeaderReviewState(leaderData.rows, filters.visibleRows, invalidateAll);

  const exportCsv = () => {
    const csv = registrationsToCsv(leaderData.rows);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`registrations-reconciliation-${stamp}.csv`, csv);
    toast.success({ message: copy.exportToast(leaderData.rows.length) });
  };

  const statusErrorMessage = mapToUserMessage(reviewState.statusMutation.error, {
    fallback: copy.mutationErrorFallback,
  });
  const paymentErrorMessage = mapToUserMessage(reviewState.paymentMutation.error, {
    fallback: copy.mutationErrorFallback,
  });

  if (toursUseLiveApi() && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <Card>
          <CardBody>
            <LoadingState message={copy.loadingSession} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <Card>
          <CardBody>
            <EmptyState
              title={copy.signInTitle}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  {copy.signInButton}
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
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <Card>
          <CardBody>
            <EmptyState
              title={copy.accessRestrictedTitle}
              description={copy.accessRestrictedDescription}
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isHydrated && isAuthenticated && leader && !hasTenantId) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <Card>
          <CardBody>
            <p dir="rtl" style={{ margin: 0 }}>
              {copy.tenantInvalid}
            </p>
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!liveApi) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <EmptyState
          title={copy.apiNotConfiguredTitle}
          description={copy.apiNotConfiguredDescription}
        />
      </RegisteredWorkspacePage>
    );
  }

  if (leaderData.isError) {
    const loadError =
      leaderData.registrationsError ?? leaderData.toursQuery.error ?? new Error("Failed to load");
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <ErrorState
          title={copy.loadErrorTitle}
          message={mapToUserMessage(loadError, { fallback: copy.loadErrorFallback })}
          onRetry={() => void leaderData.refetchAll()}
        />
      </RegisteredWorkspacePage>
    );
  }

  if (leaderData.isLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.documentTitle}
        breadcrumbItems={breadcrumbItems}
      >
        <LoadingState message={copy.loadingRows} />
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={copy.documentTitle}
      title={LEADER_REVIEW_COPY.metadata.title}
      description={copy.description(filters.overview.pending, filters.overview.total)}
      breadcrumbItems={breadcrumbItems}
    >
      <div className={pageStyles.rtlRoot} dir="rtl">
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
            <CardTitle>{reportingCopy.title}</CardTitle>
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
                {reportingCopy.partial}
              </p>
            ) : null}
            <p style={{ margin: 0 }}>{reportingCopy.sourceNote}</p>
            {leaderData.registrationsError ? (
              <p role="alert" style={{ marginTop: "0.75rem", color: "var(--color-danger-fg, #b42318)" }}>
                {reportingCopy.partialLoadWarning}
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
          statusMutationErrorMessage={statusErrorMessage}
          paymentMutationErrorMessage={paymentErrorMessage}
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
      </div>
    </RegisteredWorkspacePage>
  );
}

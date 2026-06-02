"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast
} from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useAuth } from "@/lib/auth/auth-context";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { ForbiddenError } from "@/lib/api-client";
import { reconciliationTriageKeys } from "@/lib/query-keys";
import {
  acknowledgeReconciliationFinding,
  applyReconciliationLedgerAdjustment,
  listReconciliationFindings,
  workspaceReconciliationUseLiveApi,
  type ReconciliationFindingRowDto,
  type ReconciliationFindingStatusDto,
  type ReconciliationLedgerAdjustmentFlow
} from "@/lib/services/workspace-reconciliation-findings.service";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import styles from "./reconciliation-triage-explorer-page.module.css";

const AMOUNT_TRIAD_KIND = "amount_triad_mismatch";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function absMinorString(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  if (!/^-?\d+$/.test(s)) return "";
  if (s.startsWith("-")) return s.slice(1);
  return s;
}

type StatusFilterValue = "" | ReconciliationFindingStatusDto;

type ModalState =
  | { kind: "detail"; row: ReconciliationFindingRowDto }
  | { kind: "ack"; row: ReconciliationFindingRowDto }
  | { kind: "apply"; row: ReconciliationFindingRowDto };

export function ReconciliationTriageExplorerPage() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const ability = useAbility();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantId = user?.tenantId?.trim() ?? "";
  const canRead = ability.can(AbilityAction.Read, "Reconciliation");
  const canManage = ability.can(AbilityAction.Manage, "Reconciliation");
  const live = workspaceReconciliationUseLiveApi();

  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("");
  const [committedStatus, setCommittedStatus] = useState<StatusFilterValue>("");
  const [modal, setModal] = useState<ModalState | null>(null);

  const [ackNote, setAckNote] = useState("");
  const [applyIdempotencyKey, setApplyIdempotencyKey] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [applyFlow, setApplyFlow] = useState<ReconciliationLedgerAdjustmentFlow>("credit_booking_wallet");
  const [applyCurrencyOverride, setApplyCurrencyOverride] = useState("");
  const [applyNote, setApplyNote] = useState("");

  const filterKey = useMemo(() => ({ status: committedStatus }), [committedStatus]);

  const listQuery = useInfiniteQuery({
    queryKey: reconciliationTriageKeys.list(tenantId, filterKey),
    queryFn: ({ pageParam }) =>
      listReconciliationFindings(tenantId, {
        ...(committedStatus ? { status: committedStatus } : {}),
        limit: 40,
        cursor: typeof pageParam === "string" ? pageParam : undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(tenantId) && live && canRead
  });

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [listQuery.data?.pages]
  );

  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbReconciliationTriage") }
      ] as const,
    [t]
  );

  const applyFilters = useCallback(() => {
    setCommittedStatus(statusFilter);
  }, [statusFilter]);

  const resetFilters = useCallback(() => {
    setStatusFilter("");
    setCommittedStatus("");
  }, []);

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: reconciliationTriageKeys.all });
  }, [queryClient]);

  const ackMutation = useMutation({
    mutationFn: async () => {
      if (!modal || modal.kind !== "ack") throw new Error("invalid");
      return acknowledgeReconciliationFinding(tenantId, modal.row.id, { note: ackNote.trim() || undefined });
    },
    onSuccess: () => {
      showToast({ type: "success", message: t("reconciliationTriageToastAcknowledged") });
      setModal(null);
      invalidateList();
    },
    onError: (error: unknown) => {
      if (error instanceof ForbiddenError) {
        showToast({ type: "error", message: t("reconciliationTriageAccessDeniedDescription") });
      } else {
        showToast({ type: "error", message: t("reconciliationTriageToastAckFailed") });
      }
    }
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!modal || modal.kind !== "apply") throw new Error("invalid");
      return applyReconciliationLedgerAdjustment(tenantId, modal.row.id, {
        idempotencyKey: applyIdempotencyKey.trim(),
        amountMinor: applyAmount.trim(),
        flow: applyFlow,
        currencyOverride: applyCurrencyOverride.trim() || undefined,
        note: applyNote.trim() || undefined
      });
    },
    onSuccess: () => {
      showToast({ type: "success", message: t("reconciliationTriageToastAdjustmentApplied") });
      setModal(null);
      invalidateList();
    },
    onError: (error: unknown) => {
      if (error instanceof ForbiddenError) {
        showToast({ type: "error", message: t("reconciliationTriageAccessDeniedDescription") });
      } else {
        showToast({ type: "error", message: t("reconciliationTriageToastApplyFailed") });
      }
    }
  });

  useEffect(() => {
    if (!modal || modal.kind !== "apply") return;
    const tri = modal.row.triadMismatch;
    setApplyIdempotencyKey(
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-apply`
    );
    const dLedger =
      tri && typeof tri.delta_psp_vs_ledger_minor === "string" ? tri.delta_psp_vs_ledger_minor : "";
    setApplyAmount(absMinorString(dLedger) || "");
    setApplyFlow("credit_booking_wallet");
    setApplyCurrencyOverride("");
    setApplyNote("");
  }, [modal]);

  const openAck = (row: ReconciliationFindingRowDto) => {
    setAckNote("");
    setModal({ kind: "ack", row });
  };

  const openApply = (row: ReconciliationFindingRowDto) => {
    setModal({ kind: "apply", row });
  };

  const auditTrailHref = useMemo(() => {
    const base = "/settings/audit-trail";
    const qs = new URLSearchParams();
    qs.set("resourceType", "ReconciliationFinding");
    return `${base}?${qs.toString()}`;
  }, []);

  if (!live) {
    return (
      <RegisteredWorkspacePage
        documentTitle={t("reconciliationTriagePageTitle")}
        title={t("reconciliationTriagePageTitle")}
        description={t("reconciliationTriagePageDescription")}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <SettingsLayout>
          <p className={styles.cellMuted}>Workspace API is unreachable. Use your workspace subdomain host.</p>
        </SettingsLayout>
      </RegisteredWorkspacePage>
    );
  }

  if (!canRead) {
    return (
      <RegisteredWorkspacePage
        documentTitle={t("reconciliationTriagePageTitle")}
        title={t("reconciliationTriagePageTitle")}
        description={t("reconciliationTriagePageDescription")}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <SettingsLayout>
          <div className={styles.accessDenied}>
            <h2 className={styles.accessDeniedTitle}>{t("reconciliationTriageAccessDeniedTitle")}</h2>
            <p className={styles.accessDeniedText}>{t("reconciliationTriageAccessDeniedDescription")}</p>
            <p className={styles.cellMuted} style={{ marginTop: "var(--space-3)" }}>
              <Link href="/settings">{t("breadcrumbSettings")}</Link>
            </p>
          </div>
        </SettingsLayout>
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={t("reconciliationTriagePageTitle")}
      title={t("reconciliationTriagePageTitle")}
      description={t("reconciliationTriagePageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard title={t("reconciliationTriageIntroTitle")} description={t("reconciliationTriageIntroBody")}>
          <p className={styles.cellMuted}>
            <Link href={auditTrailHref}>{t("reconciliationTriageAuditLink")}</Link>
          </p>
        </SettingsSectionCard>

        <SettingsSectionCard title={t("reconciliationTriageFiltersTitle")} description={null}>
          <div className={styles.filterRow}>
            <FormField label={t("reconciliationTriageFilterStatus")}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
                aria-label={t("reconciliationTriageFilterStatus")}
              >
                <option value="">{t("reconciliationTriageStatusAll")}</option>
                <option value="open">{t("reconciliationTriageStatusOpen")}</option>
                <option value="acknowledged">{t("reconciliationTriageStatusAcknowledged")}</option>
                <option value="resolved">{t("reconciliationTriageStatusResolved")}</option>
                <option value="dismissed">{t("reconciliationTriageStatusDismissed")}</option>
              </Select>
            </FormField>
            <Button type="button" variant="primary" onClick={applyFilters}>
              {t("reconciliationTriageApplyFilters")}
            </Button>
            <Button type="button" variant="secondary" onClick={resetFilters}>
              {t("reconciliationTriageResetFilters")}
            </Button>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard title={t("reconciliationTriageTableTitle")} description={null}>
          {listQuery.isLoading ? <LoadingState message={t("reconciliationTriageLoading")} /> : null}
          {listQuery.isError ? (
            <p className={styles.cellMuted}>{t("reconciliationTriageLoadFailed")}</p>
          ) : null}
          {!listQuery.isLoading && !listQuery.isError && rows.length === 0 ? (
            <EmptyState title={t("reconciliationTriageEmpty")} />
          ) : null}
          {rows.length > 0 ? (
            <>
              <div className={styles.tableWrap}>
                <Table aria-label={t("reconciliationTriageTableAria")}>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("reconciliationTriageColCreated")}</TableHeaderCell>
                      <TableHeaderCell>{t("reconciliationTriageColStatus")}</TableHeaderCell>
                      <TableHeaderCell>{t("reconciliationTriageColSeverity")}</TableHeaderCell>
                      <TableHeaderCell>{t("reconciliationTriageColKind")}</TableHeaderCell>
                      <TableHeaderCell>{t("reconciliationTriageColBooking")}</TableHeaderCell>
                      <TableHeaderCell>{t("reconciliationTriageColMessage")}</TableHeaderCell>
                      <TableHeaderCell>{t("reconciliationTriageColActions")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const canAck = canManage && row.status === "open";
                      const canApply =
                        canManage &&
                        (row.status === "open" || row.status === "acknowledged") &&
                        row.kind === AMOUNT_TRIAD_KIND &&
                        row.triadMismatch;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{row.severity}</TableCell>
                          <TableCell>
                            <span className={styles.cellTruncate} title={row.kind}>
                              {row.kind}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link href={`/bookings/${encodeURIComponent(row.bookingId)}`} className={styles.cellMuted}>
                              {row.bookingId.slice(0, 8)}…
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className={styles.cellTruncate} title={row.message}>
                              {row.message}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className={styles.actionsCell}>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setModal({ kind: "detail", row })}>
                                {t("reconciliationTriageOpenDetail")}
                              </Button>
                              {canAck ? (
                                <Button type="button" variant="secondary" size="sm" onClick={() => openAck(row)}>
                                  {t("reconciliationTriageAcknowledge")}
                                </Button>
                              ) : null}
                              {canApply ? (
                                <Button type="button" variant="primary" size="sm" onClick={() => openApply(row)}>
                                  {t("reconciliationTriageApplyLedger")}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {listQuery.hasNextPage ? (
                <div className={styles.toolbar}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => void listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? t("reconciliationTriageLoading") : t("reconciliationTriageLoadMore")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </SettingsSectionCard>
      </SettingsLayout>

      <Modal
        open={modal?.kind === "detail"}
        onClose={() => setModal(null)}
        title={modal?.kind === "detail" ? t("reconciliationTriageDetailTitle") : ""}
        className={styles.drawerRoot}
        panelClassName={styles.drawerPanel}
        footer={
          <div className={styles.footerBar}>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              {t("reconciliationTriageDetailClose")}
            </Button>
          </div>
        }
      >
        {modal?.kind === "detail" ? (
          <div>
            <p className={styles.cellMuted}>
              <strong>id:</strong> {modal.row.id}
            </p>
            <p className={styles.cellMuted}>
              <strong>finding_uuid:</strong> {modal.row.findingUuid}
            </p>
            <p className={styles.cellMuted}>
              <strong>job:</strong> {modal.row.reconciliationJobId}
            </p>
            <p className={styles.cellMuted}>
              <strong>booking:</strong> {modal.row.bookingId}
            </p>
            <p className={styles.cellMuted}>{t("reconciliationTriageDetailData")}</p>
            <pre className={styles.mono}>{JSON.stringify(modal.row.data ?? {}, null, 2)}</pre>
            <p className={styles.cellMuted}>{t("reconciliationTriageDetailTriad")}</p>
            <pre className={styles.mono}>{JSON.stringify(modal.row.triadMismatch ?? null, null, 2)}</pre>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={modal?.kind === "ack"}
        onClose={() => setModal(null)}
        title={modal?.kind === "ack" ? t("reconciliationTriageAckModalTitle") : ""}
        footer={
          <div className={styles.footerBar}>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              {t("reconciliationTriageDetailClose")}
            </Button>
            <Button type="button" variant="primary" disabled={ackMutation.isPending} onClick={() => void ackMutation.mutateAsync()}>
              {ackMutation.isPending ? t("reconciliationTriageLoading") : t("reconciliationTriageAckSubmit")}
            </Button>
          </div>
        }
      >
        {modal?.kind === "ack" ? (
          <FormField label={t("reconciliationTriageAckNoteLabel")}>
            <Input value={ackNote} onChange={(e) => setAckNote(e.target.value)} autoComplete="off" />
          </FormField>
        ) : null}
      </Modal>

      <Modal
        open={modal?.kind === "apply"}
        onClose={() => setModal(null)}
        title={modal?.kind === "apply" ? t("reconciliationTriageApplyModalTitle") : ""}
        footer={
          <div className={styles.footerBar}>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              {t("reconciliationTriageDetailClose")}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={applyMutation.isPending}
              onClick={() => void applyMutation.mutateAsync()}
            >
              {applyMutation.isPending ? t("reconciliationTriageLoading") : t("reconciliationTriageApplySubmit")}
            </Button>
          </div>
        }
      >
        {modal?.kind === "apply" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <p className={styles.cellMuted}>{t("reconciliationTriageApplyModalHint")}</p>
            <FormField label={t("reconciliationTriageApplyIdempotency")}>
              <Input value={applyIdempotencyKey} onChange={(e) => setApplyIdempotencyKey(e.target.value)} autoComplete="off" />
            </FormField>
            <FormField label={t("reconciliationTriageApplyAmount")}>
              <Input value={applyAmount} onChange={(e) => setApplyAmount(e.target.value)} autoComplete="off" inputMode="numeric" />
            </FormField>
            <FormField label={t("reconciliationTriageApplyFlow")}>
              <Select
                value={applyFlow}
                onChange={(e) => setApplyFlow(e.target.value as ReconciliationLedgerAdjustmentFlow)}
                aria-label={t("reconciliationTriageApplyFlow")}
              >
                <option value="credit_booking_wallet">{t("reconciliationTriageFlowCreditBooking")}</option>
                <option value="debit_booking_wallet">{t("reconciliationTriageFlowDebitBooking")}</option>
              </Select>
            </FormField>
            <FormField label={t("reconciliationTriageApplyCurrencyOverride")}>
              <Input
                value={applyCurrencyOverride}
                onChange={(e) => setApplyCurrencyOverride(e.target.value)}
                placeholder="EUR"
                maxLength={3}
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("reconciliationTriageApplyNote")}>
              <Input value={applyNote} onChange={(e) => setApplyNote(e.target.value)} autoComplete="off" />
            </FormField>
          </div>
        ) : null}
      </Modal>
    </RegisteredWorkspacePage>
  );
}

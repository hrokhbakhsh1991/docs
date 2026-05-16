"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast
} from "@tour/ui";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useAuth } from "@/lib/auth/auth-context";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { ForbiddenError } from "@/lib/api-client";
import { auditTrailKeys } from "@/lib/query-keys";
import {
  downloadTenantAuditExportBlob,
  listTenantAuditEvents,
  triggerBrowserDownload,
  type TenantAuditEventRowDto,
  workspaceAuditUseLiveApi
} from "@/lib/services/workspace-audit.service";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import styles from "./audit-trail-explorer-page.module.css";

const EMPTY_FILTERS: AuditTrailFilters = {
  from: "",
  to: "",
  action: "",
  resourceType: "",
  resourceId: "",
  actorContains: ""
};

type AuditTrailFilters = {
  from: string;
  to: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorContains: string;
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function resourceLabel(row: TenantAuditEventRowDto): string {
  const rt = row.resourceType?.trim() || "—";
  const id = row.resourceId?.trim();
  return id ? `${rt} (${id})` : rt;
}

export function AuditTrailExplorerPage() {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const ability = useAbility();
  const { user } = useAuth();
  const tenantId = user?.tenantId?.trim() ?? "";
  const canRead = ability.can(AbilityAction.Read, "Audit");
  const live = workspaceAuditUseLiveApi();

  const [draft, setDraft] = useState<AuditTrailFilters>({ ...EMPTY_FILTERS });
  const [committed, setCommitted] = useState<AuditTrailFilters>({ ...EMPTY_FILTERS });
  const [detail, setDetail] = useState<TenantAuditEventRowDto | null>(null);
  const [exporting, setExporting] = useState(false);
  const searchParams = useSearchParams();
  const seededFromUrl = useRef(false);

  useEffect(() => {
    if (seededFromUrl.current) return;
    const rt = searchParams.get("resourceType")?.trim();
    const rid = searchParams.get("resourceId")?.trim();
    if (!rt && !rid) return;
    seededFromUrl.current = true;
    setDraft((d) => ({
      ...d,
      ...(rt ? { resourceType: rt } : {}),
      ...(rid ? { resourceId: rid } : {})
    }));
    setCommitted((d) => ({
      ...d,
      ...(rt ? { resourceType: rt } : {}),
      ...(rid ? { resourceId: rid } : {})
    }));
  }, [searchParams]);

  const filterKey = useMemo(
    () => ({
      from: committed.from.trim(),
      to: committed.to.trim(),
      action: committed.action.trim(),
      resourceType: committed.resourceType.trim(),
      resourceId: committed.resourceId.trim(),
      actor: committed.actorContains.trim()
    }),
    [committed]
  );

  const listQuery = useInfiniteQuery({
    queryKey: auditTrailKeys.list(tenantId, filterKey),
    queryFn: ({ pageParam }) =>
      listTenantAuditEvents(tenantId, {
        from: committed.from.trim() || undefined,
        to: committed.to.trim() || undefined,
        action: committed.action.trim() || undefined,
        resourceType: committed.resourceType.trim() || undefined,
        resourceId: committed.resourceId.trim() || undefined,
        actorContains: committed.actorContains.trim() || undefined,
        limit: 50,
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
        { label: t("breadcrumbAuditTrail") }
      ] as const,
    [t]
  );

  const applyFilters = useCallback(() => {
    setCommitted({ ...draft });
  }, [draft]);

  const resetFilters = useCallback(() => {
    const cleared = { ...EMPTY_FILTERS };
    setDraft(cleared);
    setCommitted(cleared);
  }, []);

  const runExport = useCallback(
    async (format: "csv" | "ndjson" | "json") => {
      if (!tenantId) return;
      setExporting(true);
      try {
        const blob = await downloadTenantAuditExportBlob(tenantId, {
          format,
          from: committed.from.trim() || undefined,
          to: committed.to.trim() || undefined,
          limit: 10_000
        });
        const ext = format === "ndjson" ? "ndjson" : format === "json" ? "json" : "csv";
        triggerBrowserDownload(blob, `tenant-audit-${tenantId}.${ext}`);
        showToast({ type: "success", message: t("auditTrailExportSuccess") });
      } catch (error: unknown) {
        if (error instanceof ForbiddenError) {
          showToast({ type: "error", message: t("auditTrailAccessDeniedDescription") });
        } else {
          showToast({ type: "error", message: t("auditTrailExportFailed") });
        }
      } finally {
        setExporting(false);
      }
    },
    [tenantId, committed.from, committed.to, showToast, t]
  );

  if (!live) {
    return (
      <RegisteredWorkspacePage
        documentTitle={t("auditTrailPageTitle")}
        title={t("auditTrailPageTitle")}
        description={t("auditTrailPageDescription")}
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
        documentTitle={t("auditTrailPageTitle")}
        title={t("auditTrailPageTitle")}
        description={t("auditTrailPageDescription")}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <SettingsLayout>
          <div className={styles.accessDenied}>
            <h2 className={styles.accessDeniedTitle}>{t("auditTrailAccessDeniedTitle")}</h2>
            <p className={styles.accessDeniedText}>{t("auditTrailAccessDeniedDescription")}</p>
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
      documentTitle={t("auditTrailPageTitle")}
      title={t("auditTrailPageTitle")}
      description={t("auditTrailPageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard title={t("auditTrailFiltersTitle")} description={null}>
          <div className={styles.filtersGrid}>
            <FormField label={t("auditTrailFilterFrom")}>
              <Input
                value={draft.from}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                placeholder="2026-01-01T00:00:00.000Z"
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("auditTrailFilterTo")}>
              <Input
                value={draft.to}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                placeholder="2026-12-31T23:59:59.999Z"
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("auditTrailFilterAction")}>
              <Input
                value={draft.action}
                onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
                placeholder="auth.login.web"
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("auditTrailFilterResourceType")}>
              <Input
                value={draft.resourceType}
                onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))}
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("auditTrailFilterResourceId")}>
              <Input
                value={draft.resourceId}
                onChange={(e) => setDraft((d) => ({ ...d, resourceId: e.target.value }))}
                autoComplete="off"
              />
            </FormField>
            <FormField label={t("auditTrailFilterActor")}>
              <Input
                value={draft.actorContains}
                onChange={(e) => setDraft((d) => ({ ...d, actorContains: e.target.value }))}
                autoComplete="off"
              />
            </FormField>
          </div>
          <div className={styles.toolbar}>
            <Button type="button" variant="primary" onClick={applyFilters}>
              {t("auditTrailApplyFilters")}
            </Button>
            <Button type="button" variant="secondary" onClick={resetFilters}>
              {t("auditTrailResetFilters")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={exporting}
              onClick={() => void runExport("csv")}
            >
              {exporting ? t("auditTrailExporting") : t("auditTrailExportCsv")}
            </Button>
            <Button type="button" variant="ghost" disabled={exporting} onClick={() => void runExport("ndjson")}>
              {t("auditTrailExportNdjson")}
            </Button>
            <Button type="button" variant="ghost" disabled={exporting} onClick={() => void runExport("json")}>
              {t("auditTrailExportJson")}
            </Button>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard title={t("auditTrailPageTitle")} description={null}>
          {listQuery.isLoading ? <LoadingState message={t("auditTrailLoading")} /> : null}
          {listQuery.isError ? (
            <p className={styles.cellMuted}>{t("auditTrailLoadFailed")}</p>
          ) : null}
          {!listQuery.isLoading && !listQuery.isError && rows.length === 0 ? (
            <EmptyState title={t("auditTrailEmpty")} />
          ) : null}
          {rows.length > 0 ? (
            <>
              <div className={styles.tableWrap}>
                <Table aria-label={t("auditTrailTableAria")}>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{t("auditTrailColWhen")}</TableHeaderCell>
                      <TableHeaderCell>{t("auditTrailColActor")}</TableHeaderCell>
                      <TableHeaderCell>{t("auditTrailColAction")}</TableHeaderCell>
                      <TableHeaderCell>{t("auditTrailColResource")}</TableHeaderCell>
                      <TableHeaderCell>{t("auditTrailColDetail")}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDateTime(row.occurredAt)}</TableCell>
                        <TableCell>
                          <span className={styles.cellTruncate} title={row.actor}>
                            {row.actor}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={styles.cellTruncate} title={row.action}>
                            {row.action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={styles.cellTruncate} title={resourceLabel(row)}>
                            {resourceLabel(row)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setDetail(row)}>
                            {t("auditTrailOpenDetail")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                    {listQuery.isFetchingNextPage ? t("auditTrailLoading") : t("auditTrailLoadMore")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </SettingsSectionCard>
      </SettingsLayout>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? t("auditTrailDetailTitle") : ""}
        className={styles.drawerRoot}
        panelClassName={styles.drawerPanel}
        footer={
          <div className={styles.footerBar}>
            <Button type="button" variant="secondary" onClick={() => setDetail(null)}>
              {t("auditTrailDetailClose")}
            </Button>
          </div>
        }
      >
        {detail ? (
          <div>
            <p className={styles.cellMuted}>
              <strong>ID:</strong> {detail.id}
            </p>
            <p className={styles.cellMuted}>
              <strong>{t("auditTrailColWhen")}:</strong> {formatDateTime(detail.occurredAt)}
            </p>
            <p className={styles.cellMuted}>
              <strong>{t("auditTrailColActor")}:</strong> {detail.actor}
            </p>
            <p className={styles.cellMuted}>
              <strong>actor_user_id:</strong> {detail.actorUserId ?? "—"}
            </p>
            <p className={styles.cellMuted}>
              <strong>user_id:</strong> {detail.userId ?? "—"}
            </p>
            <p className={styles.cellMuted}>
              <strong>{t("auditTrailColAction")}:</strong> {detail.action}
            </p>
            <p className={styles.cellMuted}>
              <strong>{t("auditTrailColResource")}:</strong> {resourceLabel(detail)}
            </p>
            <p className={styles.cellMuted}>
              <strong>client_ip:</strong> {detail.clientIp}
            </p>
            <p className={styles.cellMuted}>
              <strong>request_id:</strong> {detail.requestId ?? "—"}
            </p>
            <p className={styles.cellMuted}>{t("auditTrailDetailMetadata")}</p>
            <pre className={styles.mono}>{JSON.stringify(detail.metadata ?? null, null, 2)}</pre>
          </div>
        ) : null}
      </Modal>
    </RegisteredWorkspacePage>
  );
}

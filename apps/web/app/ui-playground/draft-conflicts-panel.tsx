"use client";

import {
  Button,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@tour/ui";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { ForbiddenError } from "@/lib/api-client";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import {
  listDraftConflictHotspots,
  type DraftConflictHotspotDto,
  workspaceAuditUseLiveApi,
} from "@/lib/services/workspace-audit.service";

import styles from "./playground.module.css";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function DraftConflictsPanel() {
  const { user, isHydrated } = useAuth();
  const ability = useAbility();
  const tenantId = user?.tenantId?.trim() ?? "";
  const canRead = ability.can(AbilityAction.Read, "Audit");
  const live = workspaceAuditUseLiveApi();

  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [committed, setCommitted] = useState({ from: "", to: "" });
  const [rows, setRows] = useState<DraftConflictHotspotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadRows = useCallback(async () => {
    if (!tenantId || !live || !canRead) {
      return;
    }
    setLoading(true);
    setForbidden(false);
    setLoadError(false);
    try {
      const response = await listDraftConflictHotspots(tenantId, {
        from: committed.from.trim() || undefined,
        to: committed.to.trim() || undefined,
        limit: 25,
      });
      setRows(response.data);
    } catch (error: unknown) {
      setRows([]);
      if (error instanceof ForbiddenError) {
        setForbidden(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, live, canRead, committed.from, committed.to]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    void loadRows();
  }, [isHydrated, loadRows]);

  const applyFilters = useCallback(() => {
    setCommitted({ from: draftFrom, to: draftTo });
  }, [draftFrom, draftTo]);

  if (!isHydrated) {
    return <p className={styles.note}>Loading session…</p>;
  }

  if (!live) {
    return (
      <p className={styles.note}>
        Workspace API is unreachable. Open this page on a workspace subdomain with API configured.
      </p>
    );
  }

  if (!tenantId) {
    return <p className={styles.note}>Sign in on a workspace host to load conflict hotspots.</p>;
  }

  if (!canRead) {
    return (
      <p className={styles.note}>
        Audit read permission required (owner/admin/leader with Audit access).
      </p>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={`${styles.row} ${styles.rowStretch}`}>
        <FormField label="From (ISO)">
          <Input
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            placeholder="2026-01-01T00:00:00.000Z"
            autoComplete="off"
          />
        </FormField>
        <FormField label="To (ISO)">
          <Input
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            placeholder="2026-12-31T23:59:59.999Z"
            autoComplete="off"
          />
        </FormField>
      </div>
      <div className={styles.row}>
        <Button type="button" variant="primary" size="sm" onClick={applyFilters}>
          Refresh
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void loadRows()}
          disabled={loading}
        >
          Reload
        </Button>
      </div>

      {loading ? <LoadingState message="Loading conflict hotspots…" /> : null}
      {forbidden ? (
        <p className={styles.note}>Access denied for audit conflict list on this workspace.</p>
      ) : null}
      {!loading && !forbidden && loadError ? (
        <p className={styles.note}>Failed to load draft conflict hotspots.</p>
      ) : null}
      {!loading && !forbidden && !loadError && rows.length === 0 ? (
        <EmptyState title="No draft conflicts in this window" />
      ) : null}

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <Table aria-label="Conflict-ridden drafts">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Resource</TableHeaderCell>
                <TableHeaderCell>Conflicts</TableHeaderCell>
                <TableHeaderCell>Last seen</TableHeaderCell>
                <TableHeaderCell>Sample request_id</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.resourceType}:${row.resourceId}`}>
                  <TableCell>
                    <span className={styles.cellTruncate} title={row.resourceId}>
                      {row.resourceType} — {row.resourceId}
                    </span>
                  </TableCell>
                  <TableCell>{row.conflictCount}</TableCell>
                  <TableCell>{formatDateTime(row.lastOccurredAt)}</TableCell>
                  <TableCell>
                    <span className={styles.cellMono}>{row.sampleRequestId ?? "—"}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

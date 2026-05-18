"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, FormField, Modal, Textarea } from "@tour/ui";

import { useAuth } from "@/lib/auth/auth-context";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import { userKeys } from "@/lib/query-keys";
import { getUserById } from "@/lib/services/users.service";
import type { WorkspaceUserDto } from "@/lib/services/users.service";

import {
  formatMembershipLabelDisplay,
  roleLabel,
  roleVariant,
} from "./users-page-logic";
import { USERS_ROUTE_COPY } from "./users-copy";
import { AdminReceiptReviewPanel } from "./admin-receipt-review-panel";
import { PaymentReceiptUploadPanel } from "./payment-receipt-upload-panel";
import styles from "./user-directory-detail-modal.module.css";

const m = USERS_ROUTE_COPY.list.memberDetailModal;

type DetailTab = "general" | "activity" | "documents" | "notes";

function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized === "INVITED") return "warning";
  if (normalized === "SUSPENDED") return "danger";
  return "neutral";
}

function formatDateTime(value?: string | null): string {
  if (!value) return m.valueNone;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return m.valueNone;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type UserDirectoryDetailModalProps = {
  open: boolean;
  userId: string | null;
  onClose: () => void;
};

export function UserDirectoryDetailModal({ open, userId, onClose }: UserDirectoryDetailModalProps) {
  const router = useRouter();
  const ability = useAbility();
  const { user: sessionUser } = useAuth();
  const { hasFinanceModule, canListManualPayments, canReviewReceipts } =
    useFinanceModuleAccess();
  const tenantScope = sessionUser?.tenantId ?? "anonymous";

  const canDocuments = ability.can(AbilityAction.Read, "UserDirectoryDocuments");
  const showFinancePanels =
    hasFinanceModule && (canListManualPayments || canReviewReceipts);
  const canInternalNotes = ability.can(AbilityAction.Read, "UserDirectoryInternalNotes");

  const [tab, setTab] = useState<DetailTab>("general");
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("general");
    setNotesDraft("");
  }, [open, userId]);

  const query = useQuery({
    queryKey:
      userId && open ? userKeys.detail(tenantScope, userId) : [...userKeys.all, "detail-modal", "idle", { tenantId: tenantScope }],
    queryFn: () => getUserById(userId!),
    enabled: open && Boolean(userId?.trim()),
    staleTime: 15_000,
  });

  const u = query.data;

  const visibleTabs = useMemo(() => {
    const tabs: { id: DetailTab; label: string }[] = [
      { id: "general", label: m.tabGeneral },
      { id: "activity", label: m.tabActivity },
    ];
    if (canDocuments) {
      tabs.push({ id: "documents", label: m.tabDocuments });
    }
    if (canInternalNotes) {
      tabs.push({ id: "notes", label: m.tabInternalNotes });
    }
    return tabs;
  }, [canDocuments, canInternalNotes]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab("general");
    }
  }, [visibleTabs, tab]);

  const title = u?.name?.trim() ? u.name : m.titleFallback;

  const openFullProfile = useCallback(() => {
    if (!userId) return;
    onClose();
    router.push(`/users/${userId}`);
  }, [userId, onClose, router]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={styles.drawerRoot}
      panelClassName={styles.drawerPanel}
      footer={
        <div className={styles.footerBar}>
          <Button type="button" variant="ghost" onClick={onClose}>
            {m.closeButton}
          </Button>
          <Button type="button" variant="secondary" onClick={openFullProfile} disabled={!userId}>
            {m.openFullProfilePage}
          </Button>
        </div>
      }
    >
      {query.isLoading ? <p className={styles.muted}>{m.loading}</p> : null}
      {query.isError ? <p className={styles.error}>{m.loadError}</p> : null}
      {u ? (
        <>
          <div className={styles.tabList} role="tablist" aria-label={m.tabListAria}>
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? styles.tabActive : styles.tab}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "general" ? <GeneralSection user={u} /> : null}
          {tab === "activity" ? (
            <p className={styles.muted}>{m.activityPlaceholder}</p>
          ) : null}
          {tab === "documents" && canDocuments ? (
            <div>
              <p className={styles.muted}>{m.documentsPlaceholder}</p>
              <p className={styles.hint}>{m.documentsHint}</p>
              {showFinancePanels ? (
                <>
                  <PaymentReceiptUploadPanel />
                  <AdminReceiptReviewPanel />
                </>
              ) : (
                <p className={styles.muted}>{m.documentsFinanceModuleRequired}</p>
              )}
            </div>
          ) : null}
          {tab === "notes" && canInternalNotes ? (
            <div>
              <p className={styles.hint}>{m.internalNotesHint}</p>
              <FormField label={m.internalNotesLabel}>
                <Textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder={m.internalNotesPlaceholder}
                  rows={6}
                  disabled={!ability.can(AbilityAction.Update, "UserDirectoryInternalNotes")}
                />
              </FormField>
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}

function GeneralSection({ user }: { user: WorkspaceUserDto }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: m.fieldEmail, value: user.email },
    { label: m.fieldPhone, value: user.phone?.trim() ? user.phone : m.valueNone },
    {
      label: m.fieldPhoneVerified,
      value: (
        <Badge variant={user.isPhoneVerified ? "success" : "neutral"}>
          {user.isPhoneVerified ? "Verified" : "Unverified"}
        </Badge>
      ),
    },
    {
      label: m.fieldRole,
      value: (
        <Badge className={styles.roleBadge} variant={roleVariant(user.role)}>
          {roleLabel(user.role)}
        </Badge>
      ),
    },
    {
      label: m.fieldStatus,
      value: <Badge variant={statusBadgeVariant(user.status)}>{user.status}</Badge>,
    },
    {
      label: m.fieldTelegram,
      value: user.telegramLinked ? m.fieldTelegramLinked : m.fieldTelegramNotLinked,
    },
    {
      label: m.fieldLabels,
      value:
        user.labels && user.labels.length > 0 ? (
          <span className={styles.labelRow}>
            {user.labels.map((label) => (
              <Badge key={label} variant="neutral">
                {formatMembershipLabelDisplay(label)}
              </Badge>
            ))}
          </span>
        ) : (
          m.valueNone
        ),
    },
    { label: m.fieldJoined, value: formatDateTime(user.joinedAt) },
    { label: m.fieldLastLogin, value: formatDateTime(user.lastLoginAt) },
    { label: m.fieldInvited, value: formatDateTime(user.invitedAt) },
    { label: m.fieldSuspended, value: formatDateTime(user.suspendedAt) },
  ];

  return (
    <dl className={styles.dl}>
      {rows.map((row) => (
        <div key={row.label} className={styles.dlRow}>
          <dt className={styles.dt}>{row.label}</dt>
          <dd className={styles.dd}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

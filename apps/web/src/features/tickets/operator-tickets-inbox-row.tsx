"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";

import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import type { OperatorTicketListItemView } from "@/features/tickets/operator-tickets-types";
import { OPERATOR_TICKETS_TEST_IDS } from "@/features/tickets/operator-tickets-types";

type Props = {
  readonly item: OperatorTicketListItemView;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly bulkMode?: boolean;
  readonly bulkSelected?: boolean;
  readonly onBulkToggle?: (ticketId: string) => void;
};

export function OperatorTicketsInboxRow({
  item,
  selected,
  onSelect,
  bulkMode = false,
  bulkSelected = false,
  onBulkToggle,
}: Props) {
  const t = useTranslations("tickets");

  return (
    <div
      role="listitem"
      data-operator-tickets-row
      data-ticket-id={item.id}
      data-operator-tickets-row-selected={selected ? "true" : "false"}
      data-testid={OPERATOR_TICKETS_TEST_IDS.inboxRow}
      className={`group flex w-full min-w-0 items-start gap-2 border-b border-border/60 px-3 py-3 transition-colors ${
        selected ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/40"
      }`}
    >
      {bulkMode ? (
        <Checkbox
          className="mt-1 shrink-0"
          aria-label={t("bulkSelectTicket", { subject: item.subject })}
          checked={bulkSelected}
          onChange={(event) => {
            event.stopPropagation();
            onBulkToggle?.(item.id);
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ) : null}
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col gap-1 text-start"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.subject}</span>
        <OperatorStatusBadge variant="outline" className="shrink-0">
          <span aria-hidden="true">{item.statusIcon}</span> {t(item.statusLabelKey)}
        </OperatorStatusBadge>
      </div>
      <div
        className="flex flex-wrap items-center gap-2 text-xs"
        data-operator-tickets-inbox-meta
      >
        <span>{item.requesterLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{t(item.categoryLabelKey)}</span>
        <span aria-hidden="true">·</span>
        <span>{t(item.priorityLabelKey)}</span>
        {item.assigneeLabel !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{item.assigneeLabel}</span>
          </>
        ) : null}
      </div>
      <div
        className="flex flex-wrap items-center gap-2 text-xs"
        data-operator-tickets-inbox-meta
      >
        <time dateTime={item.lastActivityAt}>{item.lastActivityLabel}</time>
        {item.hasInternalNotes ? (
          <span data-operator-tickets-internal-indicator title={t("internalNoteIndicator")}>
            {t("internalNoteShort")}
          </span>
        ) : null}
        {item.hasAttachments ? (
          <span data-operator-tickets-attachment-indicator title={t("attachmentIndicator")}>
            📎
          </span>
        ) : null}
        {item.tagCodes.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {item.tagCodes.map((tag) => (
              <span key={tag} data-operator-tickets-tag-chip className="rounded bg-muted px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      </button>
    </div>
  );
}

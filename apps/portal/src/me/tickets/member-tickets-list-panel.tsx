"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import type { MemberTicketListView } from "@/me/tickets/member-tickets-bff.server";

type TicketStatusFilter = "" | "open" | "pending_member" | "resolved" | "closed";

type Props = {
  readonly initialList: MemberTicketListView;
  readonly initialStatus: TicketStatusFilter;
};

type ListResponse =
  | { readonly ok: true; readonly list: MemberTicketListView }
  | { readonly ok: false; readonly code: string };

const STATUS_FILTERS: readonly TicketStatusFilter[] = [
  "",
  "open",
  "pending_member",
  "resolved",
  "closed",
];

export function MemberTicketsListPanel({ initialList, initialStatus }: Props) {
  const t = useTranslations("portalMember.tickets");
  const [list, setList] = useState(initialList);
  const [status, setStatus] = useState<TicketStatusFilter>(initialStatus);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadList = useCallback(
    (nextStatus: TicketStatusFilter, cursor?: string | null) => {
      startTransition(async () => {
        setErrorCode(null);
        const params = new URLSearchParams();
        if (nextStatus.length > 0) {
          params.set("status", nextStatus);
        }
        if (cursor !== undefined && cursor !== null && cursor.length > 0) {
          params.set("cursor", cursor);
        }
        const suffix = params.size > 0 ? `?${params.toString()}` : "";
        try {
          const res = await fetch(`/api/me/tickets${suffix}`, { cache: "no-store" });
          const body = (await res.json()) as ListResponse;
          if (!res.ok || !body.ok) {
            setErrorCode(!body.ok ? body.code : "TICKET_LIST_FAILED");
            return;
          }
          if (cursor !== undefined && cursor !== null && cursor.length > 0) {
            setList((current) => ({
              items: [...current.items, ...body.list.items],
              nextCursor: body.list.nextCursor,
              hasMore: body.list.hasMore,
            }));
          } else {
            setList(body.list);
          }
        } catch {
          setErrorCode("BACKEND_UNREACHABLE");
        }
      });
    },
    [],
  );

  const onFilterChange = (nextStatus: TicketStatusFilter) => {
    setStatus(nextStatus);
    loadList(nextStatus);
  };

  return (
    <>
      <nav data-portal-member-tickets-filter aria-label={t("filterAria")}>
        {STATUS_FILTERS.map((filter) => {
          const active = filter === status;
          const label = filter.length === 0 ? t("filterAll") : t(`statuses.${filter}`);
          return (
            <button
              key={filter || "all"}
              type="button"
              data-portal-member-tickets-filter-chip
              data-status={filter || "all"}
              aria-pressed={active}
              disabled={isPending}
              onClick={() => onFilterChange(filter)}
            >
              <span aria-hidden="true">{filter.length === 0 ? "◎" : "●"}</span>
              {label}
            </button>
          );
        })}
      </nav>

      {errorCode !== null ? (
        <div data-portal-member-tickets-error role="alert">
          <p>{t("loadError")}</p>
          <button type="button" onClick={() => loadList(status)} disabled={isPending}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {isPending && list.items.length === 0 ? (
        <div data-portal-member-tickets-skeleton aria-busy="true" aria-live="polite">
          <div data-portal-member-tickets-skeleton-row />
          <div data-portal-member-tickets-skeleton-row />
          <div data-portal-member-tickets-skeleton-row />
        </div>
      ) : list.items.length === 0 ? (
        <div data-portal-member-tickets-empty>
          <h2>{t("emptyTitle")}</h2>
          <p>{t("emptyBody")}</p>
          <a href="/me/tickets/new" data-portal-member-tickets-empty-cta>
            {t("newCta")}
          </a>
        </div>
      ) : (
        <ul data-portal-member-tickets-list>
          {list.items.map((item) => (
            <li key={item.id} data-portal-member-ticket-row data-status={item.status}>
              <a href={`/me/tickets/${item.id}`} data-portal-member-ticket-row-link>
                <div data-portal-member-ticket-row-header>
                  <h2 data-portal-member-ticket-subject>{item.subject}</h2>
                  <span
                    data-portal-member-ticket-status
                    data-status={item.status}
                    aria-label={t(item.statusLabelKey)}
                  >
                    <span aria-hidden="true">{item.statusIcon}</span>
                    {t(item.statusLabelKey)}
                  </span>
                </div>
                <p data-portal-member-ticket-meta>
                  <span data-portal-member-ticket-category>{t(item.categoryLabelKey)}</span>
                  <span data-portal-member-ticket-priority>{t(item.priorityLabelKey)}</span>
                  <span data-portal-member-ticket-message-count>
                    {t("messageCount", { count: item.publicMessageCount })}
                  </span>
                </p>
                <time dateTime={item.lastActivityAt} data-portal-member-ticket-activity>
                  {item.lastActivityLabel}
                </time>
              </a>
            </li>
          ))}
        </ul>
      )}

      {list.hasMore ? (
        <button
          type="button"
          data-portal-member-tickets-load-more
          disabled={isPending}
          onClick={() => loadList(status, list.nextCursor)}
        >
          {isPending ? t("loadingMore") : t("loadMore")}
        </button>
      ) : null}
    </>
  );
}

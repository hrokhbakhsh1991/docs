"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { OperatorEmptyState } from "@/admin/patterns/operator-empty-state";
import { PageHeader } from "@/admin/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";
import {
  buildOperatorTicketsApiQuery,
  buildOperatorTicketsCommandCenterHref,
  findOperatorTicketListItem,
  operatorTicketsHasActiveFilters,
  parseOperatorTicketsCommandCenterQuery,
  withOperatorTicketsFiltersReset,
  withOperatorTicketsSelection,
} from "@/features/tickets/operator-tickets-command-center-logic";
import type { OperatorTicketsServerPrefetch } from "@/features/tickets/fetch-operator-tickets.server";
import { OperatorTicketsDetailPanel } from "@/features/tickets/operator-tickets-detail-panel";
import { OperatorTicketsInboxRow } from "@/features/tickets/operator-tickets-inbox-row";
import { createTicketsIdempotencyKey } from "@/features/tickets/operator-tickets-format";
import {
  canMutateTickets,
  DEFAULT_OPERATOR_TICKETS_QUERY,
  OPERATOR_TICKETS_TEST_IDS,
  type OperatorTicketDetailView,
  type OperatorTicketListView,
  type OperatorTicketsMetaView,
} from "@/features/tickets/operator-tickets-types";

import "./operator-tickets.css";

const MOBILE_MQ = "(max-width: 1023px)";

type Props = {
  readonly session: OperatorSessionContext;
  readonly initialPrefetch?: OperatorTicketsServerPrefetch | null;
};

type ListResponse =
  | { readonly ok: true; readonly list: OperatorTicketListView }
  | { readonly ok: false; readonly code: string };

type DetailResponse =
  | { readonly ok: true; readonly detail: OperatorTicketDetailView }
  | { readonly ok: false; readonly code: string };

type MetaResponse =
  | { readonly ok: true; readonly meta: OperatorTicketsMetaView }
  | { readonly ok: false; readonly code: string };

export function OperatorTicketsCommandCenterShell({ session, initialPrefetch }: Props) {
  const t = useTranslations("tickets");
  const router = useRouter();
  const searchParams = useAppSearchParams();
  const query = useMemo(
    () => parseOperatorTicketsCommandCenterQuery(searchParams),
    [searchParams],
  );
  const canMutate = canMutateTickets(session.role);
  const [selectedId, setSelectedId] = useState(() => query.ticketId);

  const [list, setList] = useState<OperatorTicketListView>(
    initialPrefetch?.list ?? { items: [], nextCursor: null, hasMore: false },
  );
  const [listState, setListState] = useState<"ready" | "loading" | "error">(
    initialPrefetch ? "ready" : "loading",
  );
  const [detail, setDetail] = useState<OperatorTicketDetailView | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [meta, setMeta] = useState<OperatorTicketsMetaView | null>(null);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("resolved");
  const [bulkPending, setBulkPending] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const skipInitialListLoadRef = useRef(
    initialPrefetch !== null && initialPrefetch !== undefined,
  );

  useEffect(() => {
    setSelectedId(query.ticketId);
  }, [query.ticketId]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => {
      const nextIsMobile = mq.matches;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) {
        setMobileOpen(false);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const replaceQuery = useCallback(
    (nextQuery: typeof query) => {
      router.replace(buildOperatorTicketsCommandCenterHref(nextQuery), { scroll: false });
    },
    [router],
  );

  const loadList = useCallback(
    (cursor?: string | null) => {
      startTransition(async () => {
        setListState("loading");
        const apiQuery = buildOperatorTicketsApiQuery({
          ...query,
          listCursor: cursor ?? "",
        });
        try {
          const res = await fetch(`/api/tickets?${apiQuery}`, { cache: "no-store" });
          const body = (await res.json()) as ListResponse;
          if (!res.ok || !body.ok) {
            setListState("error");
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
          setListState("ready");
        } catch {
          setListState("error");
        }
      });
    },
    [query],
  );

  const loadDetail = useCallback(async (ticketId: string) => {
    setDetailState("loading");
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const body = (await res.json()) as DetailResponse;
      if (!res.ok || !body.ok) {
        setDetailState("error");
        return;
      }
      setDetail(body.detail);
      setDetailState("ready");
      setList((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === body.detail.ticket.id ? body.detail.ticket : item,
        ),
      }));
    } catch {
      setDetailState("error");
    }
  }, []);

  useEffect(() => {
    if (skipInitialListLoadRef.current) {
      skipInitialListLoadRef.current = false;
      return;
    }
    loadList();
  }, [
    query.status,
    query.priority,
    query.categoryCode,
    query.queueCode,
    query.teamId,
    query.assigneeUserId,
    query.unassigned,
    query.tagCode,
    query.search,
    loadList,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/tickets/meta", { cache: "no-store" });
        const body = (await res.json()) as MetaResponse;
        if (res.ok && body.ok) {
          setMeta(body.meta);
        }
      } catch {
        // meta optional for viewer
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedId.length === 0) {
      setDetail(null);
      setDetailState("idle");
      return;
    }
    void loadDetail(selectedId);
    if (isMobile) {
      setMobileOpen(true);
    }
  }, [selectedId, loadDetail, isMobile]);

  const applyFilterPatch = (patch: Partial<typeof query>) => {
    setSelectedId("");
    replaceQuery(withOperatorTicketsFiltersReset(query, patch));
  };

  const handleSelect = (ticketId: string) => {
    if (ticketId === selectedId) {
      void loadDetail(ticketId);
      return;
    }
    replaceQuery(withOperatorTicketsSelection(query, ticketId));
  };

  const handleDetailUpdated = (nextDetail: OperatorTicketDetailView) => {
    setDetail(nextDetail);
    setList((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === nextDetail.ticket.id ? nextDetail.ticket : item,
      ),
    }));
    setMutationNotice(t("mutationSuccess"));
  };

  const handleError = (messageKey: string) => {
    setMutationNotice(t(`errors.${messageKey}` as "errors.generic"));
  };

  const toggleBulkSelection = (ticketId: string) => {
    setBulkSelectedIds((current) =>
      current.includes(ticketId)
        ? current.filter((id) => id !== ticketId)
        : [...current, ticketId],
    );
  };

  const toggleBulkSelectAll = () => {
    if (bulkSelectedIds.length === list.items.length) {
      setBulkSelectedIds([]);
      return;
    }
    setBulkSelectedIds(list.items.map((item) => item.id));
  };

  const runBulkStatus = async () => {
    if (!canMutate || bulkSelectedIds.length === 0 || bulkPending) {
      return;
    }
    setBulkPending(true);
    try {
      const res = await fetch("/api/tickets/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createTicketsIdempotencyKey("ticket-bulk"),
        },
        body: JSON.stringify({
          ticketIds: bulkSelectedIds,
          status: bulkStatus,
        }),
      });
      const payload = (await res.json()) as
        | {
            readonly ok: true;
            readonly succeeded: number;
            readonly failed: number;
            readonly results: ReadonlyArray<{
              readonly ticketId: string;
              readonly ok: boolean;
              readonly detail?: OperatorTicketDetailView;
            }>;
          }
        | { readonly ok: false; readonly code: string };
      if (!res.ok || !payload.ok) {
        handleError("generic");
        return;
      }
      setList((current) => ({
        ...current,
        items: current.items.map((item) => {
          const updated = payload.results.find(
            (entry) => entry.ok && entry.detail !== undefined && entry.ticketId === item.id,
          );
          return updated?.detail !== undefined ? updated.detail.ticket : item;
        }),
      }));
      if (
        detail !== null &&
        payload.results.some((entry) => entry.ok && entry.ticketId === detail.ticket.id)
      ) {
        const refreshed = payload.results.find(
          (entry) => entry.ok && entry.detail !== undefined && entry.ticketId === detail.ticket.id,
        );
        if (refreshed?.detail !== undefined) {
          setDetail(refreshed.detail);
        }
      }
      setMutationNotice(t("bulkSuccess", { succeeded: payload.succeeded, failed: payload.failed }));
      setBulkSelectedIds([]);
    } catch {
      handleError("generic");
    } finally {
      setBulkPending(false);
    }
  };

  const inboxPanel = (
    <div
      data-operator-tickets-inbox
      data-operator-tickets-state={listState}
      data-testid={OPERATOR_TICKETS_TEST_IDS.inbox}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="space-y-2 border-b border-border p-3">
        {canMutate ? (
          <div
            data-operator-tickets-bulk-toolbar
            data-testid={OPERATOR_TICKETS_TEST_IDS.bulkToolbar}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/30 p-2"
          >
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                data-testid={OPERATOR_TICKETS_TEST_IDS.bulkSelectAll}
                checked={list.items.length > 0 && bulkSelectedIds.length === list.items.length}
                onChange={toggleBulkSelectAll}
              />
              <span>{t("bulkSelectAll")}</span>
            </label>
            <select
              className="text-xs"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
              aria-label={t("bulkActionStatus")}
            >
              {["open", "pending_member", "resolved", "closed"].map((status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid={OPERATOR_TICKETS_TEST_IDS.bulkApply}
              disabled={bulkPending || bulkSelectedIds.length === 0}
              onClick={() => void runBulkStatus()}
            >
              {bulkPending ? t("bulkApplying") : t("bulkApply", { count: bulkSelectedIds.length })}
            </Button>
          </div>
        ) : null}
        <label className="block text-xs font-medium" htmlFor="operator-tickets-search">
          {t("searchLabel")}
        </label>
        <Input
          id="operator-tickets-search"
          data-testid={OPERATOR_TICKETS_TEST_IDS.filterSearch}
          defaultValue={query.search}
          placeholder={t("searchPlaceholder")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setSelectedId("");
              replaceQuery(
                withOperatorTicketsFiltersReset(query, {
                  search: (event.currentTarget as HTMLInputElement).value.trim(),
                }),
              );
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <label className="text-xs">
            <span className="sr-only">{t("filterStatus")}</span>
            <select
              data-testid={OPERATOR_TICKETS_TEST_IDS.filterStatus}
              defaultValue={query.status}
              onChange={(event) =>
                applyFilterPatch({ status: event.target.value as typeof query.status })
              }
            >
              {["all", "open", "pending_member", "resolved", "closed"].map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? t("filterAll") : t(`statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="sr-only">{t("filterPriority")}</span>
            <select
              data-testid={OPERATOR_TICKETS_TEST_IDS.filterPriority}
              defaultValue={query.priority}
              onChange={(event) =>
                applyFilterPatch({ priority: event.target.value as typeof query.priority })
              }
            >
              {["all", "low", "normal", "high", "urgent"].map((priority) => (
                <option key={priority} value={priority}>
                  {priority === "all" ? t("filterAll") : t(`priorities.${priority}`)}
                </option>
              ))}
            </select>
          </label>
          {meta !== null && meta.categories.length > 0 ? (
            <label className="text-xs">
              <span className="sr-only">{t("filterCategory")}</span>
              <select
                data-testid={OPERATOR_TICKETS_TEST_IDS.filterCategory}
                defaultValue={query.categoryCode}
                onChange={(event) => applyFilterPatch({ categoryCode: event.target.value })}
              >
                <option value="">{t("filterAll")}</option>
                {meta.categories.map((category) => (
                  <option key={category.code} value={category.code}>
                    {t(`categories.${category.code}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div
        role="list"
        aria-label={t("inboxAria")}
        className="min-h-0 flex-1 overflow-y-auto"
        onKeyDown={(event) => {
          if (list.items.length === 0) return;
          const index = list.items.findIndex((item) => item.id === selectedId);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const next = list.items[Math.min(index + 1, list.items.length - 1)];
            if (next !== undefined) handleSelect(next.id);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            const next = list.items[Math.max(index - 1, 0)];
            if (next !== undefined) handleSelect(next.id);
          }
        }}
      >
        {listState === "error" ? (
          <div className="p-4" role="alert">
            <p>{t("loadError")}</p>
            <Button type="button" onClick={() => loadList()}>
              {t("retry")}
            </Button>
          </div>
        ) : list.items.length === 0 && !isPending ? (
          <OperatorEmptyState description={t("emptyBody")} icon="map" />
        ) : (
          list.items.map((item) => (
            <OperatorTicketsInboxRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => handleSelect(item.id)}
              bulkMode={canMutate}
              bulkSelected={bulkSelectedIds.includes(item.id)}
              onBulkToggle={toggleBulkSelection}
            />
          ))
        )}
      </div>

      {list.hasMore ? (
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            data-testid={OPERATOR_TICKETS_TEST_IDS.loadMore}
            disabled={isPending}
            onClick={() => loadList(list.nextCursor)}
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );

  const detailPanelProps = {
    detail,
    detailState,
    canMutate,
    meta,
    onDetailUpdated: handleDetailUpdated,
    onError: handleError,
    onRetry: () => {
      if (selectedId.length > 0) void loadDetail(selectedId);
    },
  } as const;

  return (
    <div
      data-operator-tickets
      data-operator-tickets-ready={clientReady ? "true" : "false"}
      data-operator-tickets-readonly={canMutate ? "false" : "true"}
      data-testid={OPERATOR_TICKETS_TEST_IDS.shell}
      className="operator-tickets-shell"
    >
      <PageHeader title={t("title")} description={t("description")} />
      {mutationNotice !== null ? (
        <p
          role="status"
          aria-live="polite"
          data-testid={OPERATOR_TICKETS_TEST_IDS.mutationNotice}
          className="mx-4 mb-2 rounded-md bg-muted px-3 py-2 text-sm"
        >
          {mutationNotice}
        </p>
      ) : null}

      <div className="operator-tickets-grid px-4 pb-4">
        <div className="operator-tickets-inbox-pane">{inboxPanel}</div>
        <div className="operator-tickets-detail-pane hidden lg:flex">
          <OperatorTicketsDetailPanel key="desktop-detail" {...detailPanelProps} />
        </div>
      </div>

      <Sheet open={isMobile && mobileOpen && selectedId.length > 0} onOpenChange={setMobileOpen}>
        <SheetContent
          side="bottom"
          className="h-[90vh] p-0 lg:hidden"
          data-testid={OPERATOR_TICKETS_TEST_IDS.mobileSheet}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{findOperatorTicketListItem(list.items, selectedId)?.subject ?? t("title")}</SheetTitle>
          </SheetHeader>
          <OperatorTicketsDetailPanel key="mobile-detail" {...detailPanelProps} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { DEFAULT_OPERATOR_TICKETS_QUERY, operatorTicketsHasActiveFilters };

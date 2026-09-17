import {
  DEFAULT_OPERATOR_TICKETS_QUERY,
  OPERATOR_TICKETS_LIST_PAGE_SIZE,
  type OperatorTicketsCommandCenterQuery,
  type TicketPriorityFilter,
  type TicketStatusFilter,
} from "./operator-tickets-types";

export function parseOperatorTicketsCommandCenterQuery(
  params: URLSearchParams,
): OperatorTicketsCommandCenterQuery {
  const statusRaw = params.get("status")?.trim() ?? "";
  const priorityRaw = params.get("priority")?.trim() ?? "";
  const status = (
    ["all", "open", "pending_member", "resolved", "closed"] as const
  ).includes(statusRaw as TicketStatusFilter)
    ? (statusRaw as TicketStatusFilter)
    : DEFAULT_OPERATOR_TICKETS_QUERY.status;
  const priority = (
    ["all", "low", "normal", "high", "urgent"] as const
  ).includes(priorityRaw as TicketPriorityFilter)
    ? (priorityRaw as TicketPriorityFilter)
    : DEFAULT_OPERATOR_TICKETS_QUERY.priority;
  const unassignedRaw = params.get("unassigned")?.trim().toLowerCase() ?? "";

  return {
    status,
    priority,
    categoryCode: params.get("categoryCode")?.trim() ?? "",
    queueCode: params.get("queueCode")?.trim() ?? "",
    teamId: params.get("teamId")?.trim() ?? "",
    assigneeUserId: params.get("assigneeUserId")?.trim() ?? "",
    unassigned: unassignedRaw === "true" || unassignedRaw === "1",
    tagCode: params.get("tagCode")?.trim() ?? "",
    search: params.get("search")?.trim() ?? params.get("q")?.trim() ?? "",
    ticketId: params.get("ticketId")?.trim() ?? "",
    listCursor: params.get("listCursor")?.trim() ?? "",
  };
}

export function serializeOperatorTicketsCommandCenterQuery(
  query: OperatorTicketsCommandCenterQuery,
): string {
  const params = new URLSearchParams();
  if (query.status !== DEFAULT_OPERATOR_TICKETS_QUERY.status) {
    params.set("status", query.status);
  }
  if (query.priority !== DEFAULT_OPERATOR_TICKETS_QUERY.priority) {
    params.set("priority", query.priority);
  }
  if (query.categoryCode.length > 0) {
    params.set("categoryCode", query.categoryCode);
  }
  if (query.queueCode.length > 0) {
    params.set("queueCode", query.queueCode);
  }
  if (query.teamId.length > 0) {
    params.set("teamId", query.teamId);
  }
  if (query.assigneeUserId.length > 0) {
    params.set("assigneeUserId", query.assigneeUserId);
  }
  if (query.unassigned) {
    params.set("unassigned", "true");
  }
  if (query.tagCode.length > 0) {
    params.set("tagCode", query.tagCode);
  }
  if (query.search.length > 0) {
    params.set("search", query.search);
  }
  if (query.ticketId.length > 0) {
    params.set("ticketId", query.ticketId);
  }
  if (query.listCursor.length > 0) {
    params.set("listCursor", query.listCursor);
  }
  return params.toString();
}

export function buildOperatorTicketsCommandCenterHref(
  query: OperatorTicketsCommandCenterQuery,
): string {
  const serialized = serializeOperatorTicketsCommandCenterQuery(query);
  return serialized.length > 0 ? `/tickets?${serialized}` : "/tickets";
}

export function buildOperatorTicketsApiQuery(query: OperatorTicketsCommandCenterQuery): string {
  const params = new URLSearchParams();
  params.set("limit", String(OPERATOR_TICKETS_LIST_PAGE_SIZE));
  params.set("sort", "lastActivityAt");
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.priority !== "all") {
    params.set("priority", query.priority);
  }
  if (query.categoryCode.length > 0) {
    params.set("categoryCode", query.categoryCode);
  }
  if (query.queueCode.length > 0) {
    params.set("queueCode", query.queueCode);
  }
  if (query.teamId.length > 0) {
    params.set("teamId", query.teamId);
  }
  if (query.assigneeUserId.length > 0) {
    params.set("assigneeUserId", query.assigneeUserId);
  }
  if (query.unassigned) {
    params.set("unassigned", "true");
  }
  if (query.tagCode.length > 0) {
    params.set("tagCode", query.tagCode);
  }
  if (query.search.length > 0) {
    params.set("q", query.search);
  }
  if (query.listCursor.length > 0) {
    params.set("cursor", query.listCursor);
  }
  return params.toString();
}

export function operatorTicketsHasActiveFilters(query: OperatorTicketsCommandCenterQuery): boolean {
  return (
    query.status !== "all" ||
    query.priority !== "all" ||
    query.categoryCode.length > 0 ||
    query.queueCode.length > 0 ||
    query.teamId.length > 0 ||
    query.assigneeUserId.length > 0 ||
    query.unassigned ||
    query.tagCode.length > 0 ||
    query.search.length > 0
  );
}

export function resolveSelectedTicketId(query: OperatorTicketsCommandCenterQuery): string {
  return query.ticketId;
}

export function withOperatorTicketsSelection(
  query: OperatorTicketsCommandCenterQuery,
  ticketId: string,
): OperatorTicketsCommandCenterQuery {
  return { ...query, ticketId };
}

export function withOperatorTicketsFiltersReset(
  query: OperatorTicketsCommandCenterQuery,
  patch: Partial<OperatorTicketsCommandCenterQuery>,
): OperatorTicketsCommandCenterQuery {
  return {
    ...query,
    ...patch,
    listCursor: "",
    ticketId: "",
  };
}

export function mergeOperatorTicketsListPages(
  current: { readonly items: readonly unknown[] },
  next: { readonly items: readonly unknown[] },
): { readonly items: readonly unknown[] } {
  return { items: [...current.items, ...next.items] };
}

export function findOperatorTicketListItem<T extends { readonly id: string }>(
  items: readonly T[],
  ticketId: string,
): T | undefined {
  return items.find((item) => item.id === ticketId);
}

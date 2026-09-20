/**
 * Ticket status lifecycle — pure transition matrix (TKT-001 §8.3).
 */
import { TicketLifecycleError } from "./errors";
import type { TicketStatus, TicketTransition, TicketTransitionActor } from "./types";

const TRANSITION_TABLE: {
  readonly [K in TicketStatus]: Partial<{
    readonly [T in TicketStatus]: readonly TicketTransitionActor[];
  }>;
} = {
  open: {
    pending_member: ["operator"],
    resolved: ["operator"],
    closed: ["operator"],
  },
  pending_member: {
    open: ["member", "operator"],
    resolved: ["operator"],
    closed: ["operator"],
  },
  resolved: {
    open: ["member", "operator"],
    pending_member: ["operator"],
    closed: ["operator"],
  },
  closed: {
    open: ["operator", "owner"],
  },
};

export const TICKET_STATUS_TRANSITIONS: readonly TicketTransition[] = Object.freeze(
  (Object.entries(TRANSITION_TABLE) as [TicketStatus, (typeof TRANSITION_TABLE)[TicketStatus]][])
    .flatMap(([from, targets]) =>
      Object.entries(targets ?? {}).map(([to, actors]) => ({
        from,
        to: to as TicketStatus,
        actors: actors as readonly TicketTransitionActor[],
      })),
    ),
);

export function canTransitionTicketStatus(
  from: TicketStatus,
  to: TicketStatus,
  actor: TicketTransitionActor,
): boolean {
  if (from === to) {
    return false;
  }
  const allowed = TRANSITION_TABLE[from][to];
  if (allowed === undefined) {
    return false;
  }
  return allowed.includes(actor);
}

export function getAllowedTicketTransitions(
  from: TicketStatus,
  actor: TicketTransitionActor,
): readonly TicketStatus[] {
  const targets = TRANSITION_TABLE[from];
  const result: TicketStatus[] = [];
  for (const [to, actors] of Object.entries(targets ?? {}) as [
    TicketStatus,
    readonly TicketTransitionActor[],
  ][]) {
    if (actors.includes(actor)) {
      result.push(to);
    }
  }
  return Object.freeze(result);
}

export function transitionTicketStatus(
  from: TicketStatus,
  to: TicketStatus,
  actor: TicketTransitionActor,
): TicketStatus {
  if (!canTransitionTicketStatus(from, to, actor)) {
    throw new TicketLifecycleError(
      "INVALID_STATUS_TRANSITION",
      `transition ${from} → ${to} is not allowed for actor ${actor}`,
      { from, to },
    );
  }
  return to;
}

/** Member public message implicit status resolution (§8.2). */
export function resolveMemberMessageTargetStatus(
  currentStatus: TicketStatus,
): TicketStatus | "TICKET_CLOSED" {
  switch (currentStatus) {
    case "open":
    case "pending_member":
    case "resolved":
      return "open";
    case "closed":
      return "TICKET_CLOSED";
  }
}

export function applyStatusTimestamps(
  current: {
    readonly resolvedAt: string | null;
    readonly closedAt: string | null;
  },
  newStatus: TicketStatus,
  nowIso: string,
): { readonly resolvedAt: string | null; readonly closedAt: string | null } {
  if (newStatus === "resolved") {
    return { resolvedAt: nowIso, closedAt: current.closedAt };
  }
  if (newStatus === "closed") {
    return { resolvedAt: current.resolvedAt, closedAt: nowIso };
  }
  if (newStatus === "open") {
    return { resolvedAt: null, closedAt: null };
  }
  return { resolvedAt: current.resolvedAt, closedAt: current.closedAt };
}

export function mapActorRoleToTransitionActors(
  role: import("./types").TicketActorRole,
): readonly TicketTransitionActor[] {
  switch (role) {
    case "member":
      return ["member"];
    case "admin":
      return ["operator"];
    case "owner":
      return ["operator", "owner"];
    default:
      return [];
  }
}

export function canActorTransitionStatus(
  from: TicketStatus,
  to: TicketStatus,
  role: import("./types").TicketActorRole,
): boolean {
  const actors = mapActorRoleToTransitionActors(role);
  return actors.some((actor) => canTransitionTicketStatus(from, to, actor));
}

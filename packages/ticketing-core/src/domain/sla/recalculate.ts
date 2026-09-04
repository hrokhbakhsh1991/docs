import { addBusinessMinutes, warningThresholdInstant } from "./business-hours";
import type {
  RecalculateTicketSlaInput,
  SlaPolicyShape,
  TicketSlaClockSnapshot,
} from "./types";

function isTerminalStatus(status: string): boolean {
  return status === "resolved" || status === "closed";
}

export function resolveSlaPolicyMatch(
  policies: readonly SlaPolicyShape[],
  ticket: {
    readonly workspaceType: string;
    readonly categoryCode: string;
    readonly priority: string;
    readonly queueId: string | null;
  },
): SlaPolicyShape | null {
  const enabled = policies.filter((policy) => policy.enabled);
  let best: SlaPolicyShape | null = null;
  let bestScore = -1;
  for (const policy of enabled) {
    if (policy.workspaceType !== null && policy.workspaceType !== ticket.workspaceType) {
      continue;
    }
    if (policy.categoryCode !== null && policy.categoryCode !== ticket.categoryCode) {
      continue;
    }
    if (policy.priority !== null && policy.priority !== ticket.priority) {
      continue;
    }
    if (policy.queueId !== null && policy.queueId !== ticket.queueId) {
      continue;
    }
    let score = 0;
    if (policy.workspaceType !== null) score += 1;
    if (policy.categoryCode !== null) score += 2;
    if (policy.priority !== null) score += 4;
    if (policy.queueId !== null) score += 8;
    if (score > bestScore || (score === bestScore && best !== null && policy.code < best.code)) {
      best = policy;
      bestScore = score;
    } else if (score === bestScore && best === null) {
      best = policy;
      bestScore = score;
    }
  }
  return best;
}

export function recalculateTicketSlaState(input: RecalculateTicketSlaInput): TicketSlaClockSnapshot {
  const { policy, ticketCreatedAt, ticketStatus, nowIso } = input;
  const pausedExtraMs =
    input.pausedAt !== null
      ? input.pausedMs + Math.max(0, Date.parse(nowIso) - Date.parse(input.pausedAt))
      : input.pausedMs;

  const pauseMinutes = Math.ceil(pausedExtraMs / 60_000);

  const firstResponseDueAt =
    input.firstRespondedAt === null && !isTerminalStatus(ticketStatus)
      ? addBusinessMinutes(
          ticketCreatedAt,
          policy.firstResponseMinutes + pauseMinutes,
          policy.businessHours,
        )
      : null;

  const nextResponseAnchor = input.lastMemberMessageAt ?? ticketCreatedAt;
  const nextResponseDueAt =
    input.firstRespondedAt !== null &&
    input.lastMemberMessageAt !== null &&
    !isTerminalStatus(ticketStatus)
      ? addBusinessMinutes(
          nextResponseAnchor,
          policy.nextResponseMinutes + pauseMinutes,
          policy.businessHours,
        )
      : null;

  const resolutionDueAt = !isTerminalStatus(ticketStatus)
    ? addBusinessMinutes(
        ticketCreatedAt,
        policy.resolutionMinutes + pauseMinutes,
        policy.businessHours,
      )
    : null;

  return {
    policyId: policy.id,
    firstResponseDueAt,
    nextResponseDueAt,
    resolutionDueAt,
    firstRespondedAt: input.firstRespondedAt,
    lastMemberMessageAt: input.lastMemberMessageAt,
    breachedAt: null,
    escalationLevel: 0,
    pausedAt: input.pausedAt,
    pausedMs: input.pausedMs,
  };
}

export function computeSlaWarningAt(
  anchorIso: string,
  dueIso: string,
  warningThresholdPercent: number,
): string {
  return warningThresholdInstant(anchorIso, dueIso, warningThresholdPercent);
}

export function isSlaDue(dueIso: string | null, nowIso: string): boolean {
  if (dueIso === null) return false;
  return Date.parse(nowIso) >= Date.parse(dueIso);
}

export function isSlaWarningDue(
  anchorIso: string,
  dueIso: string | null,
  warningThresholdPercent: number,
  nowIso: string,
  warningEmittedAt: string | null,
): boolean {
  if (dueIso === null || warningEmittedAt !== null) return false;
  const warningAt = computeSlaWarningAt(anchorIso, dueIso, warningThresholdPercent);
  return Date.parse(nowIso) >= Date.parse(warningAt);
}

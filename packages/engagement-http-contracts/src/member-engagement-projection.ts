import type {
  EngagementMemberPointEventHttpItem,
  EngagementMemberPointEventViewKind,
  EngagementPointEventHttpItem,
} from "./engagement-response.schemas";

export const MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS = Object.freeze({
  correction: "history.correction",
  reversal: "history.reversal",
  reversalDetail: "history.reversalDetail",
} as const);

const REVERSAL_EVENT_TYPE = "engagement.points.reversed";
const MANUAL_ADJUSTMENT_EVENT_TYPE = "engagement.points.manual_adjustment";

export function projectMemberDisplayPoints(totalPoints: number): number {
  if (!Number.isFinite(totalPoints)) {
    return 0;
  }
  return Math.max(0, Math.trunc(totalPoints));
}

function resolveAwardLabelKey(sourceEventType: string): string {
  return `eventTypes.${sourceEventType.replaceAll(".", "_")}`;
}

function resolveMemberPointEventKind(
  event: Pick<EngagementPointEventHttpItem, "pointsDelta" | "sourceEventType">,
): EngagementMemberPointEventViewKind {
  if (event.sourceEventType === REVERSAL_EVENT_TYPE) {
    return "reversal";
  }
  if (event.sourceEventType === MANUAL_ADJUSTMENT_EVENT_TYPE && event.pointsDelta < 0) {
    return "correction";
  }
  return "award";
}

export function projectMemberPointEvent(
  event: EngagementPointEventHttpItem,
): EngagementMemberPointEventHttpItem {
  const kind = resolveMemberPointEventKind(event);

  if (kind === "reversal") {
    return {
      id: event.id,
      kind,
      labelKey: MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS.reversal,
      detailLabelKey: MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS.reversalDetail,
      createdAt: event.createdAt,
      pointsAwarded: null,
    };
  }

  if (kind === "correction") {
    return {
      id: event.id,
      kind,
      labelKey: MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS.correction,
      detailLabelKey: null,
      createdAt: event.createdAt,
      pointsAwarded: null,
    };
  }

  return {
    id: event.id,
    kind: "award",
    labelKey: resolveAwardLabelKey(event.sourceEventType),
    detailLabelKey: null,
    createdAt: event.createdAt,
    pointsAwarded: event.pointsDelta > 0 ? event.pointsDelta : null,
  };
}

export function projectMemberPointEvents(
  events: readonly EngagementPointEventHttpItem[],
): readonly EngagementMemberPointEventHttpItem[] {
  return events.map((event) => projectMemberPointEvent(event));
}

export function toOperatorPointEventHttpItem(event: {
  readonly id: string;
  readonly pointsDelta: number;
  readonly sourceModule: string;
  readonly sourceEventType: string;
  readonly sourceEntityId: string | null;
  readonly reason: string | null;
  readonly actorRole: string | null;
  readonly createdAt: string;
}): EngagementPointEventHttpItem {
  return {
    id: event.id,
    pointsDelta: event.pointsDelta,
    sourceModule: event.sourceModule,
    sourceEventType: event.sourceEventType,
    sourceEntityId: event.sourceEntityId,
    reason: event.reason,
    actorRole: event.actorRole,
    createdAt: event.createdAt,
  };
}

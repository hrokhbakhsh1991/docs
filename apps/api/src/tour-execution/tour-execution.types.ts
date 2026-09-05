export type TourExecutionState =
  | "draft"
  | "manifest_locked"
  | "pre_tour"
  | "in_progress"
  | "post_tour"
  | "completed"
  | "cancelled";

export type TourExecutionChecklistPhase = "pre" | "during" | "post";

export type TourExecutionChangeKind = "schedule" | "location" | "tour_leader";

export const TOUR_EXECUTION_STATE_TRANSITIONS: Readonly<
  Record<TourExecutionState, readonly TourExecutionState[]>
> = Object.freeze({
  draft: Object.freeze(["manifest_locked", "cancelled"]),
  manifest_locked: Object.freeze(["pre_tour", "cancelled"]),
  pre_tour: Object.freeze(["in_progress", "cancelled"]),
  in_progress: Object.freeze(["post_tour", "cancelled"]),
  post_tour: Object.freeze(["completed", "cancelled"]),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

export const DEFAULT_CHECKLIST_TEMPLATES: Readonly<
  Record<TourExecutionChecklistPhase, readonly string[]>
> = Object.freeze({
  pre: Object.freeze([
    "Verify participant manifest",
    "Confirm meeting point signage",
    "Brief tour leader and group leaders",
  ]),
  during: Object.freeze([
    "Headcount at departure",
    "Mid-tour safety check",
  ]),
  post: Object.freeze([
    "Confirm all participants returned",
    "Collect operational notes",
  ]),
});

export type TourExecutionManifestRowView = {
  readonly id: string;
  readonly registrationId: string;
  readonly guestLabel: string;
  readonly partySize: number;
  readonly registrationStatus: string;
  readonly paymentStatus: string;
  readonly insuranceStatus: string | null;
  readonly attendanceStatus: string | null;
  readonly groupId: string | null;
  readonly sortOrder: number;
};

export type TourExecutionGroupView = {
  readonly id: string;
  readonly name: string;
  readonly leaderUserId: string | null;
  readonly sortOrder: number;
};

export type TourExecutionChecklistItemView = {
  readonly id: string;
  readonly phase: TourExecutionChecklistPhase;
  readonly label: string;
  readonly completedAt: string | null;
  readonly completedByUserId: string | null;
  readonly sortOrder: number;
};

export type TourExecutionOperationalEventView = {
  readonly id: string;
  readonly eventKind: string;
  readonly severity: string;
  readonly description: string;
  readonly reportedByUserId: string;
  readonly reportedAt: string;
  readonly resolvedAt: string | null;
};

export type TourExecutionView = {
  readonly id: string;
  readonly tourId: string;
  readonly state: TourExecutionState;
  readonly rowVersion: number;
  readonly tourLeaderUserId: string | null;
  readonly scheduledMeetingAt: string | null;
  readonly meetingLocation: string | null;
  readonly manifestLockedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly manifest: readonly TourExecutionManifestRowView[];
  readonly groups: readonly TourExecutionGroupView[];
  readonly checklist: readonly TourExecutionChecklistItemView[];
  readonly operationalEvents: readonly TourExecutionOperationalEventView[];
};

export type MemberTourExecutionSummaryView = {
  readonly tourId: string;
  readonly state: TourExecutionState;
  readonly scheduledMeetingAt: string | null;
  readonly meetingLocation: string | null;
  readonly registrationId: string;
  readonly guestLabel: string;
  readonly paymentStatus: string;
  readonly insuranceStatus: string | null;
  readonly attendanceStatus: string | null;
};

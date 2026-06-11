/**
 * Phase 9.5 — Registration Command Center manifest types (DEC-P9-011).
 * @see docs/phase-9/appendices/BOOKINGS-OPS-UX.md §5
 */

export type RegistrationOpsViewId = "inbox_table" | "tour_board" | "departure_timeline";

export type RegistrationOpsKpiCardId =
  | "pending"
  | "approved_today"
  | "departures_7d"
  | "waitlist";

export type RegistrationOpsFilterId =
  | "tourId"
  | "status"
  | "departureRange"
  | "paymentStatus"
  | "search";

const REGISTRATION_OPS_VIEW_IDS: readonly RegistrationOpsViewId[] = [
  "inbox_table",
  "tour_board",
  "departure_timeline",
] as const;

export type RegistrationOpsManifest = {
  readonly id: string;
  readonly defaultView: RegistrationOpsViewId;
  readonly views: readonly RegistrationOpsViewId[];
  readonly statusPipeline: readonly string[];
  readonly kpiCards: readonly RegistrationOpsKpiCardId[];
  readonly filters: readonly RegistrationOpsFilterId[];
  readonly columns: {
    readonly inbox_table: readonly string[];
    readonly tour_board: { readonly groupBy: "tourId"; readonly columns: readonly string[] };
  };
  readonly actions: {
    readonly approve: { readonly ability: string; readonly outboxEvent: string };
    readonly reject: { readonly ability: string; readonly requiresReason?: boolean };
    readonly promoteWaitlist: { readonly ability: string };
    readonly bulkApprove: { readonly ability: string; readonly maxBatch: number };
  };
  readonly leaderReviewAlias: {
    readonly enabled: boolean;
    readonly path: string;
    readonly query: string;
  };
};

export type OperatorRegistrationOpsSurface = {
  readonly manifestVersion: 1;
  readonly manifest: RegistrationOpsManifest;
};

function isRegistrationOpsViewId(value: string): value is RegistrationOpsViewId {
  return (REGISTRATION_OPS_VIEW_IDS as readonly string[]).includes(value);
}

/** Fail closed when manifest declares unsupported view modes (ASM-9.5-012). */
export function validateRegistrationOpsManifest(manifest: RegistrationOpsManifest): void {
  for (const view of manifest.views) {
    if (!isRegistrationOpsViewId(view)) {
      throw new Error(`REGISTRATION_OPS_UNKNOWN_VIEW:${view}`);
    }
  }
  if (!isRegistrationOpsViewId(manifest.defaultView)) {
    throw new Error(`REGISTRATION_OPS_UNKNOWN_VIEW:${manifest.defaultView}`);
  }
  if (!manifest.views.includes(manifest.defaultView)) {
    throw new Error("REGISTRATION_OPS_DEFAULT_VIEW_NOT_LISTED");
  }
}

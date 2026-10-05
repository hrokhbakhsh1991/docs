import type {
  BookingCancellationStatus,
  BookingPaymentStatus,
  BookingStatus,
} from "@app-tour/booking-http-contracts";

export type BookingCancellationEffect =
  | "paymentHold"
  | "transportSettlement"
  | "refund"
  | "notification"
  | "waitlistReview";

export type BookingCancellationEffectStatus =
  | "pending"
  | "completed"
  | "not_required"
  | "manual_review";

export type BookingCancellationWorkState = Readonly<{
  paymentHold: BookingCancellationEffectStatus;
  transportSettlement: BookingCancellationEffectStatus;
  refund: BookingCancellationEffectStatus;
  notification: BookingCancellationEffectStatus;
  waitlistReview: BookingCancellationEffectStatus;
  updatedAt: string;
}>;

export type BookingCancellationTransportImpact = Readonly<{
  affectedDriverRegistrationIds: readonly string[];
  affectedPassengerRegistrationIds: readonly string[];
}>;

const MAX_AFFECTED_TRANSPORT_REGISTRATIONS = 500;

const EFFECT_STATUSES = new Set<BookingCancellationEffectStatus>([
  "pending",
  "completed",
  "not_required",
  "manual_review",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readEffectStatus(value: unknown): BookingCancellationEffectStatus | null {
  return typeof value === "string" && EFFECT_STATUSES.has(value as BookingCancellationEffectStatus)
    ? (value as BookingCancellationEffectStatus)
    : null;
}

function normalizeRegistrationIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    ),
  ].slice(0, MAX_AFFECTED_TRANSPORT_REGISTRATIONS);
}

export function readCancellationTransportImpact(
  value: unknown
): BookingCancellationTransportImpact | null {
  if (!isRecord(value) || !isRecord(value.transportImpact)) {
    return null;
  }
  if (
    !Array.isArray(value.transportImpact.affectedDriverRegistrationIds) ||
    !Array.isArray(value.transportImpact.affectedPassengerRegistrationIds)
  ) {
    return null;
  }
  return {
    affectedDriverRegistrationIds: normalizeRegistrationIds(
      value.transportImpact.affectedDriverRegistrationIds
    ),
    affectedPassengerRegistrationIds: normalizeRegistrationIds(
      value.transportImpact.affectedPassengerRegistrationIds
    ),
  };
}

export function mergeCancellationTransportImpact(
  current: BookingCancellationTransportImpact | null | undefined,
  next: BookingCancellationTransportImpact
): BookingCancellationTransportImpact {
  return {
    affectedDriverRegistrationIds: normalizeRegistrationIds([
      ...(current?.affectedDriverRegistrationIds ?? []),
      ...next.affectedDriverRegistrationIds,
    ]),
    affectedPassengerRegistrationIds: normalizeRegistrationIds([
      ...(current?.affectedPassengerRegistrationIds ?? []),
      ...next.affectedPassengerRegistrationIds,
    ]),
  };
}

function hasNewTransportImpact(
  current: BookingCancellationTransportImpact | null,
  next: BookingCancellationTransportImpact
): boolean {
  const currentDrivers = new Set(current?.affectedDriverRegistrationIds ?? []);
  const currentPassengers = new Set(current?.affectedPassengerRegistrationIds ?? []);
  return (
    next.affectedDriverRegistrationIds.some((id) => !currentDrivers.has(id)) ||
    next.affectedPassengerRegistrationIds.some((id) => !currentPassengers.has(id))
  );
}

export function advanceCancellationEffectStatus(
  current: BookingCancellationEffectStatus | null,
  next: BookingCancellationEffectStatus,
  options: { readonly reopenForNewWork?: boolean } = {}
): BookingCancellationEffectStatus {
  if (options.reopenForNewWork === true) {
    return next;
  }
  if (current === "completed" || current === "not_required") {
    return current;
  }
  if (current === "manual_review" && next === "pending") {
    return current;
  }
  return next;
}

export function createInitialCancellationWorkState(input: {
  readonly previousStatus: BookingStatus;
  readonly departureAt: string;
  readonly updatedAt: string;
}): BookingCancellationWorkState {
  const approved = input.previousStatus === "approved";
  return {
    paymentHold: approved ? "pending" : "not_required",
    transportSettlement: "pending",
    refund: "pending",
    notification: "pending",
    waitlistReview:
      approved && Date.parse(input.departureAt) > Date.parse(input.updatedAt)
        ? "pending"
        : "not_required",
    updatedAt: input.updatedAt,
  };
}

export function readCancellationWorkState(value: unknown): BookingCancellationWorkState | null {
  if (!isRecord(value) || !isRecord(value.work)) {
    return null;
  }
  const work = value.work;
  const paymentHold = readEffectStatus(work.paymentHold);
  const transportSettlement = readEffectStatus(work.transportSettlement);
  const refund = readEffectStatus(work.refund);
  const notification = readEffectStatus(work.notification);
  const waitlistReview = readEffectStatus(work.waitlistReview);
  const updatedAt = typeof work.updatedAt === "string" ? work.updatedAt : null;
  if (
    paymentHold === null ||
    transportSettlement === null ||
    refund === null ||
    notification === null ||
    waitlistReview === null ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    paymentHold,
    transportSettlement,
    refund,
    notification,
    waitlistReview,
    updatedAt,
  };
}

export function buildCancellationSnapshot(input: {
  readonly previousStatus: BookingStatus;
  readonly previousFinalizationStatus: string | null | undefined;
  readonly previousPaymentStatus: BookingPaymentStatus;
  readonly partySize: number;
  readonly finalizedAt: string | null;
  readonly departureAt: string;
  readonly updatedAt: string;
}): Readonly<Record<string, unknown>> {
  return {
    previousStatus: input.previousStatus,
    previousFinalizationStatus: input.previousFinalizationStatus ?? "not_final",
    previousPaymentStatus: input.previousPaymentStatus,
    partySize: input.partySize,
    finalizedAt: input.finalizedAt,
    work: createInitialCancellationWorkState({
      previousStatus: input.previousStatus,
      departureAt: input.departureAt,
      updatedAt: input.updatedAt,
    }),
  };
}

export function updateCancellationSnapshotEffect(input: {
  readonly snapshot: unknown;
  readonly fallbackWork?: BookingCancellationWorkState;
  readonly effect: BookingCancellationEffect;
  readonly status: BookingCancellationEffectStatus;
  readonly updatedAt: string;
  readonly transportImpact?: BookingCancellationTransportImpact;
}): Readonly<Record<string, unknown>> {
  const snapshot = isRecord(input.snapshot) ? input.snapshot : {};
  const currentWork = isRecord(snapshot.work) ? snapshot.work : (input.fallbackWork ?? {});
  const currentTransportImpact = readCancellationTransportImpact(snapshot);
  const newTransportWork =
    input.effect === "notification" &&
    input.status === "pending" &&
    input.transportImpact !== undefined &&
    hasNewTransportImpact(currentTransportImpact, input.transportImpact);
  const transportImpact =
    input.transportImpact === undefined
      ? currentTransportImpact
      : mergeCancellationTransportImpact(currentTransportImpact, input.transportImpact);
  const status = advanceCancellationEffectStatus(
    readEffectStatus(currentWork[input.effect]),
    input.status,
    { reopenForNewWork: newTransportWork }
  );
  return {
    ...snapshot,
    ...(transportImpact !== null ? { transportImpact } : {}),
    work: {
      ...currentWork,
      [input.effect]: status,
      updatedAt: input.updatedAt,
    },
  };
}

export function summarizeCancellationWork(input: {
  readonly work: BookingCancellationWorkState;
  readonly cancellationApprovedAt: string | null | undefined;
  readonly departureAt: string;
}): Extract<
  BookingCancellationStatus,
  "applied" | "late_correction" | "manual_review" | "completed"
> {
  const effectStatuses = [
    input.work.paymentHold,
    input.work.transportSettlement,
    input.work.refund,
    input.work.notification,
    input.work.waitlistReview,
  ];
  if (effectStatuses.includes("manual_review")) {
    return "manual_review";
  }
  const approvedAtMs = Date.parse(input.cancellationApprovedAt ?? "");
  const departureAtMs = Date.parse(input.departureAt);
  const isLateCorrection =
    !Number.isNaN(approvedAtMs) && !Number.isNaN(departureAtMs) && approvedAtMs >= departureAtMs;
  if (isLateCorrection) {
    return "late_correction";
  }
  return effectStatuses.includes("pending") ? "applied" : "completed";
}

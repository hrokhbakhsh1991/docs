import type { BookingActorContext } from "./ports/booking-actor-context";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port";
import type { BookingClockPort } from "./ports/booking-clock.port";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import type { BookingRuntimeCapabilities } from "./ports/booking-runtime-capabilities.port";
import type { BookingAssistedRegistrationMembersPort } from "./ports/booking-assisted-registration-members.port";
import type { BookingTenantWorkspaceBindingPort } from "./ports/booking-tenant-workspace-binding.port";
import type { BookingTourCapacityPort } from "./ports/booking-tour-capacity.port";
import type { BookingFinancialDisplayStatePort } from "./ports/booking-financial-display-state.port";
import type { BookingCapacitySnapshot, BookingListItem } from "@app-tour/booking-http-contracts";
import type { BookingApprovedCapacitySnapshot } from "@app-tour/booking-http-contracts";
import type {
  ApproveBookingResponse,
  BookingCapacityPolicyPort,
  BookingCreatePolicyContext,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryQuery,
  BookingsSummaryResponse,
  BookingPublicCapabilityPort,
  BookingPublicOutboxEvent,
  BookingValidationPolicyPort,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CancelBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  FinalizeBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WaitlistBookingResponse,
  WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";
import {
  BOOKING_TRANSPORT_CAPACITY_REJECTED,
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
  BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE,
  BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
  readTourCapacityMaxFromIntake,
} from "@app-tour/booking-http-contracts";
import { hashTenantIdForLog } from "../observability/log-safety";
import { logger } from "../observability/logger";
import type { BookingRecord, WaitlistCapacityAdmissionResponse } from "./bookings.types";
import {
  BookingCapabilityViolationError,
  BookingCapacityReleaseRejectedError,
  BookingNotFoundError,
  BookingWaitlistCapacityAdmissionNotAllowedError,
} from "./bookings.errors";
import {
  resolvePaymentDueAtForProjection,
  resolveUtcApprovedWithinDaysWindow,
} from "./booking-list-query";
import { enrichBookingListItemsWithMemberAvatars } from "./enrich-booking-list-member-avatars";
import type { BookingPostCancelSideEffectsPort } from "./ports/booking-post-cancel-side-effects.port";
import type { BookingRegistrationSloPort } from "./ports/booking-registration-slo.port";
import type { BookingSerialMutationPort } from "./ports/booking-serial-mutation.port";

const BULK_APPROVE_MAX_BATCH = 25;

/** Opt-in, PII-free capacity tracing for isolated staging diagnosis. */
function assertCapacityWithDiagnostics(input: {
  readonly stage: "create" | "approve";
  readonly workspaceType: string;
  readonly tenantId: string;
  readonly context: BookingCreatePolicyContext;
  readonly assertCapacity: (context: BookingCreatePolicyContext) => void;
}): void {
  const configuredTourId = process.env.DENALI_CAPACITY_DIAGNOSTICS_TOUR_ID?.trim();
  const diagnosticEnabled =
    process.env.DENALI_CAPACITY_DIAGNOSTICS === "true" &&
    input.workspaceType.toLowerCase() === "denali" &&
    configuredTourId !== undefined &&
    configuredTourId.length > 0 &&
    configuredTourId === input.context.tourId;
  if (!diagnosticEnabled) {
    input.assertCapacity(input.context);
    return;
  }

  const transport = input.context.registrationIntake?.transport;
  const candidateTransportKind =
    transport !== null && typeof transport === "object" && !Array.isArray(transport)
      ? (transport as Readonly<Record<string, unknown>>).kind
      : undefined;
  const approvedSnapshots = input.context.approvedCapacitySnapshots ?? [];
  const offeredCarSeats = approvedSnapshots.reduce((total, snapshot) => {
    const snapshotTransport = snapshot.registrationIntake?.transport;
    if (
      snapshotTransport === null ||
      typeof snapshotTransport !== "object" ||
      Array.isArray(snapshotTransport)
    ) {
      return total;
    }
    const record = snapshotTransport as Readonly<Record<string, unknown>>;
    const seats = record.personalCarOccupants;
    return record.kind === "personal_car" && typeof seats === "number" ? total + seats : total;
  }, 0);
  const existingDongSeats = approvedSnapshots.reduce((total, snapshot) => {
    const snapshotTransport = snapshot.registrationIntake?.transport;
    return snapshotTransport !== null &&
      typeof snapshotTransport === "object" &&
      !Array.isArray(snapshotTransport) &&
      (snapshotTransport as Readonly<Record<string, unknown>>).kind === "no_car_dong"
      ? total + snapshot.partySize
      : total;
  }, 0);
  let tenantHash: string | undefined;
  let tourHash: string | undefined;
  try {
    tenantHash = hashTenantIdForLog(input.tenantId);
    tourHash = hashTenantIdForLog(input.context.tourId);
  } catch {
    // Diagnostics must never alter the capacity decision if a log key is absent.
  }
  const fields = {
    event: "booking.capacity_policy_diagnostic",
    stage: input.stage,
    workspaceType: input.workspaceType,
    ...(tenantHash === undefined ? {} : { tenantHash }),
    ...(tourHash === undefined ? {} : { tourHash }),
    candidateTransportKind:
      candidateTransportKind === "personal_car" || candidateTransportKind === "no_car_dong"
        ? candidateTransportKind
        : "other_or_missing",
    candidatePartySize: input.context.partySize,
    tourCapacityMax: input.context.tourCapacityMax,
    occupiedApprovedPartySize: input.context.occupiedApprovedPartySize,
    approvedSnapshotCount: approvedSnapshots.length,
    offeredCarSeats,
    existingDongSeats,
    requiredDongSeats:
      existingDongSeats + (candidateTransportKind === "no_car_dong" ? input.context.partySize : 0),
  };

  const emitDiagnostic = (outcome: "invoked" | "accepted" | "rejected", extra = {}) => {
    try {
      logger.info({ ...fields, ...extra, outcome }, "capacity policy diagnostic");
    } catch {
      // Diagnostic logging is best effort and cannot alter a capacity decision.
    }
  };
  emitDiagnostic("invoked");
  try {
    input.assertCapacity(input.context);
    emitDiagnostic("accepted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    emitDiagnostic("rejected", { reasonCode: message.split(/[: ]/, 1)[0] ?? "unknown" });
    throw error;
  }
}

export type BookingsServiceDeps = {
  readonly repository: BookingRepositoryPort;
  readonly authorization: BookingAuthorizationPort;
  readonly clock: BookingClockPort;
  readonly eventReaction: WorkspaceBookingEventReactionPort;
  readonly publicBooking: BookingPublicCapabilityPort;
  readonly validationPolicy: BookingValidationPolicyPort;
  readonly capacityPolicy: BookingCapacityPolicyPort;
  readonly assistedRegistrationMembers: BookingAssistedRegistrationMembersPort;
  /** Tour SoT capacity ceiling — preferred over client registrationIntake.tourCapacityMax. */
  readonly tourCapacity: BookingTourCapacityPort;
  /** Bound workspaceType for this runtime — must match tenant-owned type (B2.0). */
  readonly workspaceType: string;
  readonly tenantWorkspaceBinding: BookingTenantWorkspaceBindingPort;
  /** Composition-resolved capability decisions (not generated matrix). */
  readonly capabilities: BookingRuntimeCapabilities;
  /**
   * Host integrity profile — fail-closed when tour SoT lacks capacityMax.
   * Injected at composition (never import runtime-profile into this service).
   */
  readonly productionGradeIntegrity: boolean;
  readonly postCancelSideEffects: BookingPostCancelSideEffectsPort;
  readonly registrationSlo: BookingRegistrationSloPort;
  readonly financialDisplayState: BookingFinancialDisplayStatePort;
  readonly serialMutation: BookingSerialMutationPort;
  /** Optional workspace-owned policy invoked after capacity-affecting writes. */
  readonly waitlistPromotion?: {
    afterCapacityChange(input: {
      readonly tenantId: string;
      readonly tourId: string;
    }): Promise<unknown>;
  };
};

/** Booking-owned capacity: missing max is never a silent allow. */
function requireTourCapacityMax(intake: Readonly<Record<string, unknown>> | undefined): number {
  const max = readTourCapacityMaxFromIntake(intake);
  if (max === null) {
    throw new Error(BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE);
  }
  return max;
}

function toListItem(
  record: BookingRecord,
  capacitySnapshot?: BookingCapacitySnapshot,
  options?: {
    readonly includeRegistrationIntake?: boolean;
    readonly financialDisplayState?: BookingListItem["financialDisplayState"];
  }
): BookingListItem {
  const guestEmail =
    record.guestEmail !== null && record.guestEmail.trim().length > 0
      ? record.guestEmail.trim()
      : undefined;
  const guestPhone =
    record.guestPhone !== null && record.guestPhone.trim().length > 0
      ? record.guestPhone.trim()
      : undefined;
  const approvedAt =
    record.approvedAt !== null && record.approvedAt.trim().length > 0
      ? record.approvedAt.trim()
      : undefined;
  const includeIntake = options?.includeRegistrationIntake === true;
  const registrantTarget = record.registrantTarget ?? "self";
  const transportKind = record.transportKind ?? null;
  const personalCarOccupants = record.personalCarOccupants ?? null;
  const financialDisplayState = options?.financialDisplayState;
  return {
    id: record.id,
    tourId: record.tourId,
    tourTitle: record.tourTitle,
    guestLabel: record.guestLabel,
    ...(guestEmail !== undefined ? { guestEmail } : {}),
    ...(guestPhone !== undefined ? { guestPhone } : {}),
    registrantTarget,
    transportKind,
    personalCarOccupants,
    partySize: record.partySize,
    status: record.status,
    finalizationStatus: record.finalizationStatus ?? "not_final",
    paymentStatus: record.paymentStatus,
    ...(financialDisplayState !== undefined ? { financialDisplayState } : {}),
    departureAt: record.departureAt,
    submittedAt: record.submittedAt,
    ...(approvedAt !== undefined ? { approvedAt } : {}),
    ...(record.finalizedAt !== undefined && record.finalizedAt !== null
      ? { finalizedAt: record.finalizedAt }
      : {}),
    ...(includeIntake && record.registrationIntake !== undefined
      ? { registrationIntake: record.registrationIntake }
      : {}),
    ...(record.rejectReason !== undefined ? { rejectReason: record.rejectReason } : {}),
    ...(resolvePaymentDueAtForProjection(record) !== undefined
      ? { paymentDueAt: resolvePaymentDueAtForProjection(record) }
      : {}),
    ...(record.cancelSource !== undefined ? { cancelSource: record.cancelSource } : {}),
    ...(record.cancellationStatus !== undefined
      ? { cancellationStatus: record.cancellationStatus }
      : {}),
    ...(record.cancellationReasonCode !== undefined
      ? { cancellationReasonCode: record.cancellationReasonCode }
      : {}),
    ...(record.cancellationReasonNote !== undefined
      ? { cancellationReasonNote: record.cancellationReasonNote }
      : {}),
    ...(record.cancellationRequestedAt !== undefined
      ? { cancellationRequestedAt: record.cancellationRequestedAt }
      : {}),
    ...(record.cancellationApprovedAt !== undefined
      ? { cancellationApprovedAt: record.cancellationApprovedAt }
      : {}),
    ...(record.cancellationApprovedByUserId !== undefined
      ? { cancellationApprovedByUserId: record.cancellationApprovedByUserId }
      : {}),
    ...(record.cancellationCorrelationId !== undefined
      ? { cancellationCorrelationId: record.cancellationCorrelationId }
      : {}),
    ...(capacitySnapshot !== undefined ? { capacitySnapshot } : {}),
  };
}

/**
 * Booking application service — constructor DI only (Phase B0.5 + B2.0 binding).
 * Dependencies are injected; persistence is not resolved inside this class.
 * Runtime workspaceType is fixed at construction; every tenant-scoped call
 * asserts tenantId → workspaceType matches this runtime.
 */
export class BookingsService {
  private readonly repository: BookingRepositoryPort;
  private readonly authorization: BookingAuthorizationPort;
  private readonly clock: BookingClockPort;
  private readonly eventReaction: WorkspaceBookingEventReactionPort;
  private readonly publicBooking: BookingPublicCapabilityPort;
  private readonly validationPolicy: BookingValidationPolicyPort;
  private readonly capacityPolicy: BookingCapacityPolicyPort;
  private readonly assistedRegistrationMembers: BookingAssistedRegistrationMembersPort;
  private readonly tourCapacity: BookingTourCapacityPort;
  private readonly workspaceType: string;
  private readonly tenantWorkspaceBinding: BookingTenantWorkspaceBindingPort;
  private readonly capabilities: BookingRuntimeCapabilities;
  private readonly productionGradeIntegrity: boolean;
  private readonly postCancelSideEffects: BookingPostCancelSideEffectsPort;
  private readonly registrationSlo: BookingRegistrationSloPort;
  private readonly financialDisplayState: BookingFinancialDisplayStatePort;
  private readonly serialMutation: BookingSerialMutationPort;
  private readonly waitlistPromotion: BookingsServiceDeps["waitlistPromotion"];

  constructor(deps: BookingsServiceDeps) {
    if (deps.repository == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:repository");
    }
    if (deps.authorization == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:authorization");
    }
    if (deps.clock == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:clock");
    }
    if (deps.eventReaction == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:eventReaction");
    }
    if (deps.publicBooking == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:publicBooking");
    }
    if (deps.validationPolicy == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:validationPolicy");
    }
    if (deps.capacityPolicy == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:capacityPolicy");
    }
    if (deps.assistedRegistrationMembers == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:assistedRegistrationMembers");
    }
    if (deps.tourCapacity == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:tourCapacity");
    }
    if (deps.tenantWorkspaceBinding == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:tenantWorkspaceBinding");
    }
    if (deps.capabilities == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:capabilities");
    }
    if (typeof deps.productionGradeIntegrity !== "boolean") {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:productionGradeIntegrity");
    }
    if (deps.postCancelSideEffects == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:postCancelSideEffects");
    }
    if (deps.registrationSlo == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:registrationSlo");
    }
    if (deps.financialDisplayState == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:financialDisplayState");
    }
    if (deps.serialMutation == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:serialMutation");
    }
    const workspaceType = deps.workspaceType.trim().toLowerCase();
    if (workspaceType.length === 0) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:workspaceType");
    }
    this.repository = deps.repository;
    this.authorization = deps.authorization;
    this.clock = deps.clock;
    this.eventReaction = deps.eventReaction;
    this.publicBooking = deps.publicBooking;
    this.validationPolicy = deps.validationPolicy;
    this.capacityPolicy = deps.capacityPolicy;
    this.assistedRegistrationMembers = deps.assistedRegistrationMembers;
    this.tourCapacity = deps.tourCapacity;
    this.workspaceType = workspaceType;
    this.tenantWorkspaceBinding = deps.tenantWorkspaceBinding;
    this.capabilities = deps.capabilities;
    this.productionGradeIntegrity = deps.productionGradeIntegrity;
    this.postCancelSideEffects = deps.postCancelSideEffects;
    this.registrationSlo = deps.registrationSlo;
    this.financialDisplayState = deps.financialDisplayState;
    this.serialMutation = deps.serialMutation;
    this.waitlistPromotion = deps.waitlistPromotion;
  }

  /** Bound workspaceType for this runtime (capability composition key). */
  get boundWorkspaceType(): string {
    return this.workspaceType;
  }

  private async assertTenantBound(tenantId: string): Promise<void> {
    await this.tenantWorkspaceBinding.assertTenantBoundToRuntime(tenantId, this.workspaceType);
  }

  /** A post-commit reconciliation never turns an already-persisted write into a false failure. */
  private async recheckWaitlistAfterCapacityChange(
    tenantId: string,
    tourId: string
  ): Promise<boolean> {
    if (this.waitlistPromotion === undefined) {
      return false;
    }
    const startedAt = this.clock.now().getTime();
    try {
      await this.waitlistPromotion.afterCapacityChange({ tenantId, tourId });
      this.registrationSlo.record({
        workspaceType: this.workspaceType,
        tenantId,
        outcome: "success",
        durationMs: Math.max(0, this.clock.now().getTime() - startedAt),
      });
    } catch {
      this.registrationSlo.record({
        workspaceType: this.workspaceType,
        tenantId,
        outcome: "error",
        durationMs: Math.max(0, this.clock.now().getTime() - startedAt),
      });
    }
    return true;
  }

  async recheckWaitlistAfterCapacityChangeForTenant(input: {
    readonly tenantId: string;
    readonly tourId: string;
  }): Promise<boolean> {
    await this.assertTenantBound(input.tenantId);
    return this.recheckWaitlistAfterCapacityChange(input.tenantId, input.tourId);
  }

  private assertPublicCreateCapability(): void {
    const claim = this.capabilities.publicCreate;
    if (!claim.enabled || claim.mode !== "create-pipeline") {
      throw new BookingCapabilityViolationError({
        workspaceType: this.workspaceType,
        capability: "publicCreate",
        detail: `required mode=create-pipeline; claimed enabled=${claim.enabled} mode=${claim.mode}`,
      });
    }
    if (!this.publicBooking.supportsPublicCreate()) {
      throw new BookingCapabilityViolationError({
        workspaceType: this.workspaceType,
        capability: "publicCreate",
        detail: "adapter.supportsPublicCreate()=false (required behavior missing)",
      });
    }
  }

  private assertOperatorCreateCapability(): void {
    const claim = this.capabilities.operatorCreate;
    if (!claim.enabled || claim.mode !== "create-pipeline") {
      throw new BookingCapabilityViolationError({
        workspaceType: this.workspaceType,
        capability: "operatorCreate",
        detail: `required mode=create-pipeline; claimed enabled=${claim.enabled} mode=${claim.mode}`,
      });
    }
  }

  private assertCapacityCapabilityLevel(): void {
    const capacity = this.capabilities.capacity;
    if (!capacity.enabled || capacity.mode !== "booking-owned") {
      throw new BookingCapabilityViolationError({
        workspaceType: this.workspaceType,
        capability: "capacityMode",
        detail: `lifecycle requires capacityMode=booking-owned; claimed mode=${capacity.mode}`,
      });
    }
  }

  private assertCreatePolicyCapabilityLevels(): void {
    const validation = this.capabilities.validation;
    if (!validation.enabled || validation.mode === "none") {
      throw new BookingCapabilityViolationError({
        workspaceType: this.workspaceType,
        capability: "validationMode",
        detail: `create requires validationMode != none; claimed mode=${validation.mode}`,
      });
    }
    this.assertCapacityCapabilityLevel();
  }

  private assertApprovalCapability(): void {
    const approval = this.capabilities.approval;
    if (!approval.enabled || approval.mode !== "host-lifecycle") {
      throw new BookingCapabilityViolationError({
        workspaceType: this.workspaceType,
        capability: "approval",
        detail: `approve requires host-lifecycle; claimed mode=${approval.mode}`,
      });
    }
    // Same capacityMode resolution as create — approve must not bypass graded capacity.
    this.assertCapacityCapabilityLevel();
  }

  async listBookings(
    auth: BookingActorContext,
    query: BookingsListQuery
  ): Promise<BookingsListResponse> {
    await this.assertTenantBound(auth.tenantId);
    if (query.view === "ops") {
      this.authorization.assertOpsAccess(auth);
    }

    const filters = {
      tenantId: auth.tenantId,
      ...(query.view === "mine" ? { submittedByUserId: auth.userId } : {}),
      ...(query.statuses !== undefined && query.statuses.length > 0
        ? { statuses: query.statuses }
        : query.status !== undefined
          ? { status: query.status }
          : query.view === "mine"
            ? // Member trips list: active seats only (omit cancelled/rejected history).
              { statuses: ["pending", "waitlisted", "approved"] as const }
            : {}),
      ...(query.tourId !== undefined && query.tourId.length > 0 ? { tourId: query.tourId } : {}),
      ...(query.paymentStatus !== undefined ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.q !== undefined && query.q.length > 0 ? { q: query.q } : {}),
      ...(query.departureWithinDays !== undefined
        ? (() => {
            const now = this.clock.now();
            const to = new Date(now.getTime() + query.departureWithinDays * 24 * 60 * 60 * 1000);
            return {
              departureFrom: now.toISOString(),
              departureTo: to.toISOString(),
            };
          })()
        : {}),
      ...(query.approvedWithinDays !== undefined
        ? resolveUtcApprovedWithinDaysWindow(this.clock.now(), query.approvedWithinDays)
        : {}),
    };

    const [page, total] = await Promise.all([
      this.repository.listByTenantPage({
        ...filters,
        limit: query.limit,
        sort: query.sort === "departureAt" ? "departureAt" : "submittedAt",
        ...(query.cursor !== undefined && query.cursor.length > 0 ? { cursor: query.cursor } : {}),
      }),
      this.repository.countByTenantFilters(filters),
    ]);

    const tourIds = [...new Set(page.items.map((row) => (row as BookingRecord).tourId))];
    const occupiedByTour =
      tourIds.length > 0
        ? await this.repository.sumApprovedPartySizeByTourIds(auth.tenantId, tourIds)
        : {};
    const maxByTour =
      tourIds.length > 0
        ? await this.tourCapacity.resolveTourCapacityMaxMany(auth.tenantId, tourIds)
        : {};

    return {
      items: await enrichBookingListItemsWithMemberAvatars(
        auth.tenantId,
        page.items as BookingRecord[],
        page.items.map((row) => {
          const record = row as BookingRecord;
          return toListItem(
            record,
            {
              occupied: occupiedByTour[record.tourId] ?? 0,
              max: maxByTour[record.tourId] ?? null,
            },
            {
              financialDisplayState: this.financialDisplayState.resolve(record),
            }
          );
        })
      ),
      total,
      nextCursor: page.nextCursor,
    };
  }

  /**
   * Ops detail — includes `registrationIntake` (list projection must omit it).
   * @see UX-BKG-50 amend / docs/dev/list-projection-guards.mdoc
   */
  async getBooking(auth: BookingActorContext, bookingId: string): Promise<BookingListItem> {
    await this.assertTenantBound(auth.tenantId);
    const record = await this.repository.getById(bookingId, auth.tenantId);
    if (record === null) {
      throw new BookingNotFoundError();
    }

    const ownsRegistration = record.submittedByUserId === auth.userId;
    if (ownsRegistration && auth.role !== "admin" && auth.role !== "owner") {
      return toListItem(
        record,
        { occupied: 0, max: null },
        {
          includeRegistrationIntake: false,
          financialDisplayState: this.financialDisplayState.resolve(record),
        }
      );
    }

    this.authorization.assertOpsAccess(auth);
    const [occupiedByTour, maxByTour] = await Promise.all([
      this.repository.sumApprovedPartySizeByTourIds(auth.tenantId, [record.tourId]),
      this.tourCapacity.resolveTourCapacityMaxMany(auth.tenantId, [record.tourId]),
    ]);
    return toListItem(
      record,
      {
        occupied: occupiedByTour[record.tourId] ?? 0,
        max: maxByTour[record.tourId] ?? null,
      },
      {
        includeRegistrationIntake: true,
        financialDisplayState: this.financialDisplayState.resolve(record),
      }
    );
  }

  async getBookingsSummary(
    auth: BookingActorContext,
    query: BookingsSummaryQuery = { tourChipScope: "ops" }
  ): Promise<BookingsSummaryResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    return this.repository.getBookingsSummaryStats({
      tenantId: auth.tenantId,
      now: this.clock.now(),
      tourChipScope: query.tourChipScope,
    });
  }

  async createBooking(
    auth: BookingActorContext,
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    this.assertOperatorCreateCapability();
    const submittedByUserId = await this.resolveSubmittedByUserIdForOperatorCreate(auth, body);
    // Operator-created records must exist before approval decides capacity. This
    // lets an auto-approval flow move the same record to waitlisted instead of
    // turning a capacity conflict into a misleading duplicate error.
    return this.executeCreatePipeline(auth, body, submittedByUserId, undefined, {
      enforceCapacityAtCreate: false,
    });
  }

  async sumApprovedPartySizeByTourIds(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number>>> {
    await this.assertTenantBound(tenantId);
    if (tourIds.length === 0) {
      return {};
    }
    return this.repository.sumApprovedPartySizeByTourIds(tenantId, tourIds);
  }

  /**
   * Single guest-duplicate rule for public registration (all match kinds).
   * Active = not cancelled/rejected; dedicated repository lookup (uncapped).
   */
  async findGuestBookingDuplicateMatch(
    tenantId: string,
    tourId: string,
    match:
      | { readonly kind: "user"; readonly value: string }
      | { readonly kind: "label"; readonly value: string }
      | { readonly kind: "email"; readonly value: string }
      | { readonly kind: "nationalId"; readonly value: string }
      | { readonly kind: "phone"; readonly value: string }
  ): Promise<BookingRecord | null> {
    await this.assertTenantBound(tenantId);
    const raw = match.value.trim();
    if (raw.length === 0) {
      return null;
    }
    return this.repository.findActiveGuestDuplicate({
      tenantId,
      tourId,
      match: { kind: match.kind, value: raw },
    });
  }

  /**
   * Public guest create — graded publicCreate + adapter supportsPublicCreate, then same
   * workspace policy boundary as operator create (validationPolicy + capacityPolicy).
   */
  async createPublicGuestBooking(
    auth: BookingActorContext,
    body: CreateBookingRequest,
    outboxEvent?: BookingPublicOutboxEvent
  ): Promise<CreateBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.assertPublicCreateCapability();
    return this.executeCreatePipeline(auth, body, auth.userId, outboxEvent);
  }

  /** Public waitlist create: same validation boundary, without claiming approved capacity. */
  async createPublicWaitlistedBooking(
    auth: BookingActorContext,
    body: CreateBookingRequest,
    outboxEvent?: BookingPublicOutboxEvent
  ): Promise<CreateBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.assertPublicCreateCapability();
    return this.executeCreatePipeline(auth, body, auth.userId, outboxEvent, {
      initialStatus: "waitlisted",
      enforceCapacityAtCreate: false,
    });
  }

  private async resolveSubmittedByUserIdForOperatorCreate(
    auth: BookingActorContext,
    body: CreateBookingRequest
  ): Promise<string> {
    const memberUserId = body.memberUserId?.trim() ?? "";
    if (memberUserId.length === 0 || memberUserId === auth.userId) {
      return auth.userId;
    }
    const membership = await this.assistedRegistrationMembers.findTenantMember(
      auth.tenantId,
      memberUserId
    );
    if (membership === null) {
      throw new Error("BOOKING_MEMBER_NOT_FOUND");
    }
    if (membership.status !== "ACTIVE") {
      throw new Error("BOOKING_MEMBER_INACTIVE");
    }
    return memberUserId;
  }

  /**
   * Single application create pipeline — all pending-booking writes share this boundary.
   * Occupancy is loaded from the shared repository; workspace policies decide accept/reject.
   */
  /**
   * Prefer tour canonical capacityMax when present; never let client intake raise the ceiling.
   * When tour SoT has no capacityMax:
   * - prodlike/production → fail-closed (never trust client intake as ceiling)
   * - test/dev → intake last-resort for fixtures / workspaces without the field
   */
  private async resolveEffectiveTourCapacityMax(
    tenantId: string,
    tourId: string,
    intake: Readonly<Record<string, unknown>> | undefined
  ): Promise<number> {
    const serverMax = await this.tourCapacity.resolveTourCapacityMax(tenantId, tourId);
    if (serverMax !== null) {
      return serverMax;
    }
    if (this.productionGradeIntegrity) {
      throw new Error(BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE);
    }
    return requireTourCapacityMax(intake);
  }

  private withServerTourCapacityMax(
    intake: Readonly<Record<string, unknown>> | undefined,
    tourCapacityMax: number
  ): Readonly<Record<string, unknown>> {
    return { ...(intake ?? {}), tourCapacityMax };
  }

  private async executeCreatePipeline(
    auth: BookingActorContext,
    body: CreateBookingRequest,
    submittedByUserId: string,
    outboxEvent?: BookingPublicOutboxEvent,
    options: {
      readonly initialStatus?: "pending" | "waitlisted";
      readonly enforceCapacityAtCreate?: boolean;
    } = {}
  ): Promise<CreateBookingResponse> {
    const started = performance.now();
    try {
      const initialStatus = options.initialStatus ?? "pending";
      const enforceCapacityAtCreate = options.enforceCapacityAtCreate ?? true;
      this.assertCreatePolicyCapabilityLevels();
      const tourCapacityMax = await this.resolveEffectiveTourCapacityMax(
        auth.tenantId,
        body.tourId,
        body.registrationIntake
      );
      const registrationIntake = this.withServerTourCapacityMax(
        body.registrationIntake,
        tourCapacityMax
      );
      const securedBody: CreateBookingRequest = {
        ...body,
        registrationIntake,
      };
      const baseCtx = this.buildCapacityPolicyContext(
        auth.tenantId,
        {
          tourId: securedBody.tourId,
          tourTitle: securedBody.tourTitle,
          guestLabel: securedBody.guestLabel,
          guestEmail: securedBody.guestEmail ?? null,
          guestPhone: securedBody.guestPhone ?? null,
          partySize: securedBody.partySize,
          departureAt: securedBody.departureAt,
          registrationIntake,
        },
        0,
        tourCapacityMax
      );
      // Shape validation does not need the tour lock; capacity re-checks under lock in createBooking.
      this.validationPolicy.assertCreateValid(baseCtx);

      const created = await this.repository.createBooking({
        tenantId: auth.tenantId,
        submittedByUserId,
        body: securedBody,
        ...(initialStatus === "pending" && enforceCapacityAtCreate
          ? {
              assertCapacityInTx: (ctx: {
                readonly tourId: string;
                readonly partySize: number;
                readonly occupiedApprovedPartySize: number;
                readonly approvedCapacitySnapshots: readonly BookingApprovedCapacitySnapshot[];
              }) => {
                assertCapacityWithDiagnostics({
                  stage: "create",
                  workspaceType: this.workspaceType,
                  tenantId: auth.tenantId,
                  context: {
                    ...baseCtx,
                    occupiedApprovedPartySize: ctx.occupiedApprovedPartySize,
                    approvedCapacitySnapshots: ctx.approvedCapacitySnapshots,
                  },
                  assertCapacity: (context) => this.capacityPolicy.assertCreateCapacity(context),
                });
              },
            }
          : {}),
        initialStatus,
        ...(outboxEvent === undefined ? {} : { outboxEvent }),
      });
      this.registrationSlo.record({
        workspaceType: this.workspaceType,
        tenantId: auth.tenantId,
        outcome: "success",
        durationMs: performance.now() - started,
      });
      return { id: created.id, status: created.status };
    } catch (error) {
      this.registrationSlo.record({
        workspaceType: this.workspaceType,
        tenantId: auth.tenantId,
        outcome: "error",
        durationMs: performance.now() - started,
      });
      throw error;
    }
  }

  /** One capacity policy context builder for create + approve (same business fields). */
  private buildCapacityPolicyContext(
    tenantId: string,
    source: {
      readonly tourId: string;
      readonly tourTitle: string;
      readonly guestLabel: string;
      readonly guestEmail: string | null | undefined;
      readonly guestPhone: string | null | undefined;
      readonly partySize: number;
      readonly departureAt: string;
      readonly registrationIntake: Readonly<Record<string, unknown>> | undefined;
    },
    occupiedApprovedPartySize: number,
    tourCapacityMax: number,
    approvedCapacitySnapshots?: readonly BookingApprovedCapacitySnapshot[]
  ): BookingCreatePolicyContext {
    const guestEmail =
      source.guestEmail !== undefined && source.guestEmail !== null && source.guestEmail.length > 0
        ? source.guestEmail
        : undefined;
    const guestPhone =
      source.guestPhone !== undefined && source.guestPhone !== null && source.guestPhone.length > 0
        ? source.guestPhone
        : undefined;
    return {
      tenantId,
      tourId: source.tourId,
      tourTitle: source.tourTitle,
      guestLabel: source.guestLabel,
      ...(guestEmail !== undefined ? { guestEmail } : {}),
      ...(guestPhone !== undefined ? { guestPhone } : {}),
      partySize: source.partySize,
      departureAt: source.departureAt,
      ...(source.registrationIntake !== undefined
        ? { registrationIntake: source.registrationIntake }
        : {}),
      occupiedApprovedPartySize,
      tourCapacityMax,
      ...(approvedCapacitySnapshots !== undefined ? { approvedCapacitySnapshots } : {}),
    };
  }

  /**
   * Capacity assert used inside approve TX — same policy builder as create.
   * Resolves tour SoT asynchronously before the TX callback runs synchronously.
   */
  private buildApproveCapacityAssert(tenantId: string) {
    return async (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
      readonly approvedCapacitySnapshots: readonly BookingApprovedCapacitySnapshot[];
      readonly tourCapacityMax?: number;
    }): Promise<void> => {
      const booking = ctx.booking;
      const tourCapacityMax =
        ctx.tourCapacityMax ??
        (await this.resolveEffectiveTourCapacityMax(
          tenantId,
          booking.tourId,
          booking.registrationIntake
        ));
      assertCapacityWithDiagnostics({
        stage: "approve",
        workspaceType: this.workspaceType,
        tenantId,
        context: this.buildCapacityPolicyContext(
          tenantId,
          {
            tourId: booking.tourId,
            tourTitle: booking.tourTitle,
            guestLabel: booking.guestLabel,
            guestEmail: booking.guestEmail,
            guestPhone: booking.guestPhone,
            partySize: booking.partySize,
            departureAt: booking.departureAt,
            registrationIntake: this.withServerTourCapacityMax(
              booking.registrationIntake,
              tourCapacityMax
            ),
          },
          ctx.occupiedApprovedPartySize,
          tourCapacityMax,
          ctx.approvedCapacitySnapshots
        ),
        assertCapacity: (context) => this.capacityPolicy.assertCreateCapacity(context),
      });
    };
  }

  /**
   * Verify a capacity release while the repository still holds the tour lock.
   * This is not a create/approve decision: a driver removal can invalidate
   * seats already consumed by dong passengers even though it frees tour seats.
   */
  buildPostRemovalCapacityAssert() {
    return async (ctx: {
      readonly booking: BookingRecord;
      readonly occupiedApprovedPartySize: number;
      readonly approvedCapacitySnapshots: readonly BookingApprovedCapacitySnapshot[];
    }): Promise<void> => {
      const decision = this.capacityPolicy.evaluateCapacityRelease({
        bookingStatus: ctx.booking.status,
        booking: {
          partySize: ctx.booking.partySize,
          ...(ctx.booking.registrationIntake !== undefined
            ? { registrationIntake: ctx.booking.registrationIntake }
            : {}),
        },
        approvedCapacitySnapshots: ctx.approvedCapacitySnapshots,
      });
      if (!decision.allowed) {
        throw new BookingCapacityReleaseRejectedError(decision.reasonCode);
      }
    };
  }

  async createCapacityReleaseAssertion(tenantId: string) {
    await this.assertTenantBound(tenantId);
    return this.buildPostRemovalCapacityAssert();
  }

  async approveBooking(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<ApproveBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    this.assertApprovalCapability();
    // Capacity runs inside approveWithOutbox TX (re-read occupancy; no check-then-act gap).
    const updated = await this.repository.approveWithOutbox({
      bookingId,
      tenantId: auth.tenantId,
      outboxEvent: this.eventReaction.approveOutboxEventType,
      assertCapacityInTx: this.buildApproveCapacityAssert(auth.tenantId),
    });
    await this.invokeApproveReaction(auth.tenantId, updated.id);
    await this.recheckWaitlistAfterCapacityChange(auth.tenantId, updated.tourId);
    return {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt ?? this.clock.now().toISOString(),
    };
  }

  async finalizeBooking(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<FinalizeBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.finalizeBooking({
      bookingId,
      tenantId: auth.tenantId,
      finalizedByUserId: auth.userId,
    });
    return {
      id: updated.id,
      status: updated.status,
      finalizationStatus: updated.finalizationStatus ?? "not_final",
      finalizedAt: updated.finalizedAt ?? this.clock.now().toISOString(),
    };
  }

  async finalizeBookingWithOpenPayment(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<FinalizeBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.finalizeBookingWithOpenPayment({
      bookingId,
      tenantId: auth.tenantId,
      finalizedByUserId: auth.userId,
    });
    return {
      id: updated.id,
      status: updated.status,
      finalizationStatus: updated.finalizationStatus ?? "not_final",
      finalizedAt: updated.finalizedAt ?? this.clock.now().toISOString(),
    };
  }

  async waiveAndFinalizeBooking(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<FinalizeBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.waiveAndFinalizeBooking({
      bookingId,
      tenantId: auth.tenantId,
      finalizedByUserId: auth.userId,
    });
    return {
      id: updated.id,
      status: updated.status,
      finalizationStatus: updated.finalizationStatus ?? "not_final",
      finalizedAt: updated.finalizedAt ?? this.clock.now().toISOString(),
    };
  }

  /**
   * Tour-policy public auto-approve — no ops CASL.
   * Ownership: actorUserId must equal submittedByUserId.
   * A workspace can opt in to waitlisting only after a concrete capacity decision.
   * Other failures remain pending for a safe operator decision.
   */
  async autoApprovePublicBooking(input: {
    readonly tenantId: string;
    readonly bookingId: string;
    readonly actorUserId: string;
    readonly capacityFallback?: "waitlist";
  }): Promise<{ readonly id: string; readonly status: string }> {
    await this.assertTenantBound(input.tenantId);
    this.assertApprovalCapability();
    const booking = await this.repository.getById(input.bookingId, input.tenantId);
    if (booking === null || booking.submittedByUserId !== input.actorUserId) {
      throw new BookingNotFoundError();
    }
    if (booking.status !== "pending") {
      return { id: booking.id, status: booking.status };
    }
    try {
      const updated = await this.repository.approveWithOutbox({
        bookingId: input.bookingId,
        tenantId: input.tenantId,
        outboxEvent: this.eventReaction.approveOutboxEventType,
        assertCapacityInTx: this.buildApproveCapacityAssert(input.tenantId),
      });
      await this.invokeApproveReaction(input.tenantId, updated.id);
      await this.recheckWaitlistAfterCapacityChange(input.tenantId, booking.tourId);
      return { id: updated.id, status: updated.status };
    } catch (error) {
      const capacityRejected =
        error instanceof Error &&
        (error.message.startsWith(BOOKING_TRANSPORT_CAPACITY_REJECTED) ||
          (error.message.startsWith("BOOKING_CAPACITY_REJECTED") &&
            /occupied=\d+ partySize=\d+ capacityMax=\d+/.test(error.message)));
      if (input.capacityFallback === "waitlist" && capacityRejected) {
        const waitlisted = await this.repository.waitlistBooking({
          bookingId: booking.id,
          tenantId: input.tenantId,
          outboxEvent: BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
        });
        return { id: waitlisted.id, status: waitlisted.status };
      }
      if (capacityRejected) {
        return { id: booking.id, status: booking.status };
      }
      throw error;
    }
  }

  /**
   * Ops reject — status + optional rejectReason; intentionally silent (decision B).
   */
  async rejectBooking(
    auth: BookingActorContext,
    bookingId: string,
    body: RejectBookingRequest
  ): Promise<RejectBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.rejectBooking({
      bookingId,
      tenantId: auth.tenantId,
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
    return {
      id: updated.id,
      status: updated.status,
      ...(updated.rejectReason !== undefined ? { rejectReason: updated.rejectReason } : {}),
    };
  }

  async waitlistBooking(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<WaitlistBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.waitlistBooking({
      bookingId,
      tenantId: auth.tenantId,
      outboxEvent: BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
    });
    return { id: updated.id, status: updated.status };
  }

  async promoteWaitlistWithCapacityIncrease(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<WaitlistCapacityAdmissionResponse> {
    return this.serialMutation.run(async () => {
      await this.assertTenantBound(auth.tenantId);
      this.authorization.assertOpsAccess(auth);
      const current = await this.repository.getById(bookingId, auth.tenantId);
      if (current === null) {
        throw new BookingNotFoundError();
      }
      const marker = current.registrationIntake?.waitlistCapacityAdmission;
      if (
        current.status === "approved" &&
        marker !== undefined &&
        typeof marker === "object" &&
        marker !== null
      ) {
        const record = marker as Record<string, unknown>;
        return {
          id: current.id,
          status: current.status,
          paymentStatus: current.paymentStatus,
          capacityAdded:
            typeof record.capacityAdded === "number" ? record.capacityAdded : current.partySize,
          previousCapacity:
            typeof record.previousCapacity === "number" ? record.previousCapacity : 0,
          nextCapacity: typeof record.nextCapacity === "number" ? record.nextCapacity : 0,
        };
      }
      if (current.status !== "waitlisted" || current.partySize < 1) {
        throw new BookingWaitlistCapacityAdmissionNotAllowedError();
      }
      const atomicPromotion = this.repository.approveWaitlistedWithCapacityIncrease;
      if (atomicPromotion !== undefined) {
        let approved: BookingRecord;
        try {
          approved = await atomicPromotion.call(this.repository, {
            bookingId,
            tenantId: auth.tenantId,
            outboxEvent: "registration.waitlist_promoted_with_capacity_increase",
            // The repository commits capacity, booking state, and outbox as one
            // transaction, then supplies the new ceiling to this policy check.
            assertCapacityInTx: this.buildApproveCapacityAssert(auth.tenantId),
          });
        } catch (error) {
          // A committed transaction can lose its response. Read the durable
          // admission marker before deciding whether this is a failed attempt.
          let afterFailure: BookingRecord | null;
          try {
            afterFailure = await this.repository.getById(bookingId, auth.tenantId);
          } catch {
            this.registrationSlo.record({
              workspaceType: this.workspaceType,
              tenantId: auth.tenantId,
              outcome: "error",
            });
            throw error;
          }
          const committedMarker = afterFailure?.registrationIntake?.waitlistCapacityAdmission;
          if (
            afterFailure === null ||
            afterFailure.status !== "approved" ||
            committedMarker === null ||
            typeof committedMarker !== "object"
          ) {
            throw error;
          }
          approved = afterFailure;
        }
        const committedMarker = approved.registrationIntake?.waitlistCapacityAdmission;
        const admission =
          committedMarker !== null && typeof committedMarker === "object"
            ? (committedMarker as Record<string, unknown>)
            : {};
        await this.invokeApproveReaction(auth.tenantId, approved.id);
        return {
          id: approved.id,
          status: approved.status,
          paymentStatus: approved.paymentStatus,
          capacityAdded:
            typeof admission.capacityAdded === "number"
              ? admission.capacityAdded
              : current.partySize,
          previousCapacity:
            typeof admission.previousCapacity === "number" ? admission.previousCapacity : 0,
          nextCapacity: typeof admission.nextCapacity === "number" ? admission.nextCapacity : 0,
        };
      }
      const increaseTourCapacity = this.tourCapacity.increaseTourCapacity;
      if (increaseTourCapacity === undefined) {
        throw new Error("BOOKING_CAPACITY_INCREMENT_UNSUPPORTED");
      }
      const expansion = await increaseTourCapacity({
        tenantId: auth.tenantId,
        tourId: current.tourId,
        delta: current.partySize,
      });
      let approved: BookingRecord;
      try {
        approved = await this.repository.approveWithOutbox({
          bookingId,
          tenantId: auth.tenantId,
          outboxEvent: "registration.waitlist_promoted_with_capacity_increase",
          // Increasing the tour's global ceiling does not add personal-car
          // seats. Re-run the normal workspace capacity policy against the
          // locked approved snapshot before admitting the waitlisted party.
          assertCapacityInTx: this.buildApproveCapacityAssert(auth.tenantId),
          registrationIntakePatch: {
            waitlistCapacityAdmission: {
              capacityAdded: current.partySize,
              previousCapacity: expansion.previousCapacity,
              nextCapacity: expansion.nextCapacity,
            },
          },
        });
      } catch (error) {
        // The DB may have committed while the response was lost. Confirm the
        // durable booking state before compensating the separately stored tour.
        let afterFailure: BookingRecord | null;
        try {
          afterFailure = await this.repository.getById(bookingId, auth.tenantId);
        } catch {
          this.registrationSlo.record({
            workspaceType: this.workspaceType,
            tenantId: auth.tenantId,
            outcome: "error",
          });
          throw error;
        }
        const admission = afterFailure?.registrationIntake?.waitlistCapacityAdmission;
        const committed =
          afterFailure !== null &&
          afterFailure.status === "approved" &&
          admission !== null &&
          typeof admission === "object" &&
          (admission as Record<string, unknown>).nextCapacity === expansion.nextCapacity;
        if (committed && afterFailure !== null) {
          approved = afterFailure;
        } else {
          if (afterFailure?.status === "waitlisted") {
            const restore = this.tourCapacity.restoreTourCapacityIfUnchanged;
            if (restore !== undefined) {
              try {
                const restored = await restore({
                  tenantId: auth.tenantId,
                  tourId: current.tourId,
                  expectedCapacity: expansion.nextCapacity,
                  restoreCapacity: expansion.previousCapacity,
                });
                if (!restored) {
                  this.registrationSlo.record({
                    workspaceType: this.workspaceType,
                    tenantId: auth.tenantId,
                    outcome: "error",
                  });
                }
              } catch {
                this.registrationSlo.record({
                  workspaceType: this.workspaceType,
                  tenantId: auth.tenantId,
                  outcome: "error",
                });
              }
            } else {
              this.registrationSlo.record({
                workspaceType: this.workspaceType,
                tenantId: auth.tenantId,
                outcome: "error",
              });
            }
          } else {
            // Unknown/changed state: never risk removing capacity relied on by
            // a possibly committed registration. Emit an operational signal.
            this.registrationSlo.record({
              workspaceType: this.workspaceType,
              tenantId: auth.tenantId,
              outcome: "error",
            });
          }
          throw error;
        }
      }
      await this.invokeApproveReaction(auth.tenantId, approved.id);
      const result = approved;
      return {
        id: result.id,
        status: result.status,
        paymentStatus: result.paymentStatus,
        capacityAdded: current.partySize,
        previousCapacity: expansion.previousCapacity,
        nextCapacity: expansion.nextCapacity,
      };
    });
  }

  async cancelBooking(
    auth: BookingActorContext,
    bookingId: string,
    input: { readonly reasonCode: string; readonly reasonNote?: string } = {
      reasonCode: "operator_correction",
    }
  ): Promise<CancelBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const before = await this.repository.getById(bookingId, auth.tenantId);
    if (before === null) {
      throw new BookingNotFoundError();
    }
    const previousStatus = before.status;
    const correlationId = `registration.cancelled:${bookingId}`;
    const updated = await this.repository.cancelBooking({
      bookingId,
      tenantId: auth.tenantId,
      outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
      cancelSource: "operator",
      cancellationStatus:
        Date.parse(before.departureAt) <= Date.now() ? "late_correction" : "applied",
      cancellationReasonCode: input.reasonCode,
      cancellationReasonNote: input.reasonNote,
      cancellationApprovedByUserId: auth.userId,
      cancellationCorrelationId: correlationId,
      assertCapacityAfterRemovalInTx: this.buildPostRemovalCapacityAssert(),
    });
    let settlementStatus: CancelBookingResponse["settlementStatus"] = "not_affected";
    try {
      const effects = await this.postCancelSideEffects.run({
        auth,
        booking: { ...before, status: "cancelled", cancelSource: "operator" },
        previousStatus,
        cancelDomainEventId: correlationId,
        cancelSource: "operator",
      });
      settlementStatus = effects.settlementStatus;
    } catch {
      // The lifecycle transition is already persisted. Surface a recoverable
      // finance/settlement case instead of returning a retry-shaped 500.
      settlementStatus = "manual_review";
    }
    await this.recheckWaitlistAfterCapacityChange(auth.tenantId, updated.tourId);
    const isWaivedCollection =
      before.financialDisplayState === "WAIVED" ||
      before.registrationIntake?.freeCollectionApplied === true;
    return {
      id: updated.id,
      status: updated.status,
      cancellationStatus: updated.cancellationStatus,
      refundStatus:
        !isWaivedCollection &&
        (before.paymentStatus === "paid" || before.paymentStatus === "partial")
          ? "pending_finance_approval"
          : "not_required",
      settlementStatus,
    };
  }

  async bulkApproveBookings(
    auth: BookingActorContext,
    body: BulkApproveBookingsRequest
  ): Promise<BulkApproveBookingsResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    this.assertApprovalCapability();
    const uniqueIds = [...new Set(body.ids.filter((id) => id.trim().length > 0))];
    if (uniqueIds.length === 0) {
      return { approvedIds: [], skippedIds: [] };
    }

    const approved = await this.repository.bulkApproveWithOutbox({
      ids: uniqueIds,
      tenantId: auth.tenantId,
      outboxEvent: this.eventReaction.approveOutboxEventType,
      maxBatch: BULK_APPROVE_MAX_BATCH,
      assertCapacityInTx: this.buildApproveCapacityAssert(auth.tenantId),
    });
    // WHEN: after bulk approve TX — one reaction per approved id (adapter enforces idempotency).
    for (const row of approved) {
      await this.invokeApproveReaction(auth.tenantId, row.id);
      await this.recheckWaitlistAfterCapacityChange(auth.tenantId, row.tourId);
    }
    const approvedIds = approved.map((row) => row.id);
    const approvedSet = new Set(approvedIds);
    const skippedIds = uniqueIds.filter((id) => !approvedSet.has(id));
    return { approvedIds, skippedIds };
  }

  /**
   * Optional in-process reaction — only when capability claims `in-process`.
   * Durable approve fact is always the host outbox (Option A: no hollow claim).
   * @see docs/phase-20/p7/appendices/BOOKING_EVENT_REACTION_OPTION_A.md
   */
  private async invokeApproveReaction(tenantId: string, bookingId: string): Promise<void> {
    const reaction = this.capabilities.eventReaction;
    if (!reaction.enabled || reaction.mode !== "in-process") {
      return;
    }
    await this.eventReaction.reactAfterApprove({
      tenantId,
      bookingId,
      outboxEventType: this.eventReaction.approveOutboxEventType,
    });
  }
}

export function createBookingsService(deps: BookingsServiceDeps): BookingsService {
  return new BookingsService(deps);
}

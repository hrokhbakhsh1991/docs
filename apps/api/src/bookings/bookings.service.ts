import type { BookingActorContext } from "./ports/booking-actor-context";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port";
import type { BookingClockPort } from "./ports/booking-clock.port";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import type { BookingRuntimeCapabilities } from "./ports/booking-runtime-capabilities.port";
import type { BookingTenantWorkspaceBindingPort } from "./ports/booking-tenant-workspace-binding.port";
import type { BookingTourCapacityPort } from "./ports/booking-tour-capacity.port";
import type {
  ApproveBookingResponse,
  BookingCapacityPolicyPort,
  BookingCreatePolicyContext,
  BookingListItem,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryResponse,
  BookingPublicCapabilityPort,
  BookingValidationPolicyPort,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CancelBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WaitlistBookingResponse,
  WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";
import {
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
  BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE,
  BOOKING_WAITLIST_OUTBOX_EVENT_TYPE,
  readTourCapacityMaxFromIntake,
} from "@app-tour/booking-http-contracts";
import type { BookingRecord } from "./bookings.types";
import {
  BookingCapabilityViolationError,
} from "./bookings.errors";

const BULK_APPROVE_MAX_BATCH = 25;

export type BookingsServiceDeps = {
  readonly repository: BookingRepositoryPort;
  readonly authorization: BookingAuthorizationPort;
  readonly clock: BookingClockPort;
  readonly eventReaction: WorkspaceBookingEventReactionPort;
  readonly publicBooking: BookingPublicCapabilityPort;
  readonly validationPolicy: BookingValidationPolicyPort;
  readonly capacityPolicy: BookingCapacityPolicyPort;
  /** Tour SoT capacity ceiling — preferred over client registrationIntake.tourCapacityMax. */
  readonly tourCapacity: BookingTourCapacityPort;
  /** Bound workspaceType for this runtime — must match tenant-owned type (B2.0). */
  readonly workspaceType: string;
  readonly tenantWorkspaceBinding: BookingTenantWorkspaceBindingPort;
  /** Composition-resolved capability decisions (not generated matrix). */
  readonly capabilities: BookingRuntimeCapabilities;
};


/** Booking-owned capacity: missing max is never a silent allow. */
function requireTourCapacityMax(
  intake: Readonly<Record<string, unknown>> | undefined
): number {
  const max = readTourCapacityMaxFromIntake(intake);
  if (max === null) {
    throw new Error(BOOKING_CAPACITY_MAX_REQUIRED_MESSAGE);
  }
  return max;
}

function toListItem(record: BookingRecord): BookingListItem {
  return {
    id: record.id,
    tourId: record.tourId,
    tourTitle: record.tourTitle,
    guestLabel: record.guestLabel,
    partySize: record.partySize,
    status: record.status,
    paymentStatus: record.paymentStatus,
    departureAt: record.departureAt,
    submittedAt: record.submittedAt,
    ...(record.registrationIntake !== undefined
      ? { registrationIntake: record.registrationIntake }
      : {}),
    ...(record.rejectReason !== undefined ? { rejectReason: record.rejectReason } : {}),
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
  private readonly tourCapacity: BookingTourCapacityPort;
  private readonly workspaceType: string;
  private readonly tenantWorkspaceBinding: BookingTenantWorkspaceBindingPort;
  private readonly capabilities: BookingRuntimeCapabilities;

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
    if (deps.tourCapacity == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:tourCapacity");
    }
    if (deps.tenantWorkspaceBinding == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:tenantWorkspaceBinding");
    }
    if (deps.capabilities == null) {
      throw new Error("BOOKINGS_SERVICE_DEP_REQUIRED:capabilities");
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
    this.tourCapacity = deps.tourCapacity;
    this.workspaceType = workspaceType;
    this.tenantWorkspaceBinding = deps.tenantWorkspaceBinding;
    this.capabilities = deps.capabilities;
  }

  /** Bound workspaceType for this runtime (capability composition key). */
  get boundWorkspaceType(): string {
    return this.workspaceType;
  }

  private async assertTenantBound(tenantId: string): Promise<void> {
    await this.tenantWorkspaceBinding.assertTenantBoundToRuntime(tenantId, this.workspaceType);
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
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.tourId !== undefined && query.tourId.length > 0 ? { tourId: query.tourId } : {}),
      ...(query.paymentStatus !== undefined ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.q !== undefined && query.q.length > 0 ? { q: query.q } : {}),
    };

    const [page, total] = await Promise.all([
      this.repository.listByTenantPage({
        ...filters,
        limit: query.limit,
        ...(query.cursor !== undefined && query.cursor.length > 0
          ? { cursor: query.cursor }
          : {}),
      }),
      this.repository.countByTenantFilters(filters),
    ]);

    return {
      items: page.items.map((row) => toListItem(row as BookingRecord)),
      total,
      nextCursor: page.nextCursor,
    };
  }

  async getBookingsSummary(auth: BookingActorContext): Promise<BookingsSummaryResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    return this.repository.getBookingsSummaryStats({
      tenantId: auth.tenantId,
      now: this.clock.now(),
    });
  }

  async createBooking(
    auth: BookingActorContext,
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    this.assertOperatorCreateCapability();
    return this.executeCreatePipeline(auth, body);
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
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.assertPublicCreateCapability();
    return this.executeCreatePipeline(auth, body);
  }

  /**
   * Single application create pipeline — all pending-booking writes share this boundary.
   * Occupancy is loaded from the shared repository; workspace policies decide accept/reject.
   */
  /**
   * Prefer tour canonical capacityMax when present; never let client intake raise the ceiling.
   * Intake remains last-resort only when tour SoT has no capacityMax (fixtures / workspaces without field).
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
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
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
      submittedByUserId: auth.userId,
      body: securedBody,
      assertCapacityInTx: (ctx) => {
        this.capacityPolicy.assertCreateCapacity({
          ...baseCtx,
          occupiedApprovedPartySize: ctx.occupiedApprovedPartySize,
        });
      },
    });
    return { id: created.id, status: created.status };
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
    tourCapacityMax: number
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
    }): Promise<void> => {
      const booking = ctx.booking;
      const tourCapacityMax = await this.resolveEffectiveTourCapacityMax(
        tenantId,
        booking.tourId,
        booking.registrationIntake
      );
      this.capacityPolicy.assertCreateCapacity(
        this.buildCapacityPolicyContext(
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
          tourCapacityMax
        )
      );
    };
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
    return {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt ?? this.clock.now().toISOString(),
    };
  }

  /**
   * Ops reject — status + optional rejectReason. No outbox (decision B: intentionally silent).
   * Cancel remains the observable terminal path (`registration.cancelled`).
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

  async cancelBooking(
    auth: BookingActorContext,
    bookingId: string
  ): Promise<CancelBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.authorization.assertOpsAccess(auth);
    const updated = await this.repository.cancelBooking({
      bookingId,
      tenantId: auth.tenantId,
      outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
    });
    return { id: updated.id, status: updated.status };
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

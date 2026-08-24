import type { BookingActorContext } from "./ports/booking-actor-context";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port";
import type { BookingClockPort } from "./ports/booking-clock.port";
import type { BookingRepositoryPort } from "./ports/booking-repository.port";
import type { BookingRuntimeCapabilities } from "./ports/booking-runtime-capabilities.port";
import type { BookingAssistedRegistrationMembersPort } from "./ports/booking-assisted-registration-members.port";
import type { BookingTenantWorkspaceBindingPort } from "./ports/booking-tenant-workspace-binding.port";
import type { BookingTourCapacityPort } from "./ports/booking-tour-capacity.port";
import type { BookingCapacitySnapshot, BookingListItem } from "@app-tour/booking-http-contracts";
import type {
  ApproveBookingResponse,
  BookingCapacityPolicyPort,
  BookingCreatePolicyContext,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryQuery,
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
  BookingNotFoundError,
} from "./bookings.errors";
import { resolveUtcApprovedWithinDaysWindow } from "./booking-list-query";
import { recordRegistrationSloEvent } from "../observability/workspace-slo-telemetry.ts";

const BULK_APPROVE_MAX_BATCH = 25;

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

function toListItem(
  record: BookingRecord,
  capacitySnapshot?: BookingCapacitySnapshot,
  options?: { readonly includeRegistrationIntake?: boolean }
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
    paymentStatus: record.paymentStatus,
    departureAt: record.departureAt,
    submittedAt: record.submittedAt,
    ...(approvedAt !== undefined ? { approvedAt } : {}),
    ...(includeIntake && record.registrationIntake !== undefined
      ? { registrationIntake: record.registrationIntake }
      : {}),
    ...(record.rejectReason !== undefined ? { rejectReason: record.rejectReason } : {}),
    ...(record.paymentDueAt !== undefined && record.paymentDueAt !== null
      ? { paymentDueAt: record.paymentDueAt }
      : {}),
    ...(record.cancelSource !== undefined ? { cancelSource: record.cancelSource } : {}),
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
            const to = new Date(
              now.getTime() + query.departureWithinDays * 24 * 60 * 60 * 1000
            );
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
        ...(query.cursor !== undefined && query.cursor.length > 0
          ? { cursor: query.cursor }
          : {}),
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
      items: page.items.map((row) => {
        const record = row as BookingRecord;
        return toListItem(record, {
          occupied: occupiedByTour[record.tourId] ?? 0,
          max: maxByTour[record.tourId] ?? null,
        });
      }),
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
        { includeRegistrationIntake: false }
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
      { includeRegistrationIntake: true }
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
    return this.executeCreatePipeline(auth, body, submittedByUserId);
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
    body: CreateBookingRequest
  ): Promise<CreateBookingResponse> {
    await this.assertTenantBound(auth.tenantId);
    this.assertPublicCreateCapability();
    return this.executeCreatePipeline(auth, body, auth.userId);
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
    submittedByUserId: string
  ): Promise<CreateBookingResponse> {
    const started = performance.now();
    try {
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
        assertCapacityInTx: (ctx) => {
          this.capacityPolicy.assertCreateCapacity({
            ...baseCtx,
            occupiedApprovedPartySize: ctx.occupiedApprovedPartySize,
          });
        },
      });
      recordRegistrationSloEvent({
        workspaceType: this.workspaceType,
        tenantId: auth.tenantId,
        outcome: "success",
        durationMs: performance.now() - started,
      });
      return { id: created.id, status: created.status };
    } catch (error) {
      recordRegistrationSloEvent({
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
   * Tour-policy public auto-approve — no ops CASL.
   * Ownership: actorUserId must equal submittedByUserId.
   * Capacity reject → leave pending (fail closed to manual queue).
   */
  async autoApprovePublicBooking(input: {
    readonly tenantId: string;
    readonly bookingId: string;
    readonly actorUserId: string;
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
      return { id: updated.id, status: updated.status };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("BOOKING_CAPACITY_REJECTED")
      ) {
        return { id: booking.id, status: booking.status };
      }
      throw error;
    }
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

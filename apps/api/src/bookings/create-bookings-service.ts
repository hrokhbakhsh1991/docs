/**
 * Host composition root for BookingsService (B0.5 + B1.5 tenant resolve + B2.0 binding).
 * Routes / Denali host keep calling façade functions — those resolve here.
 *
 * Invariant (B2.0): tenantId → workspaceType. Callers must not pick a workspaceType
 * for a tenant; façades always resolve type from tenant, then bind the runtime.
 */

import { getBookingsRepository } from "./create-bookings-repository";
import { requiresProductionGradeIntegrity } from "../server/runtime-profile";
import { createBookingsService, type BookingsService } from "./bookings.service";
import { HostBookingAuthorizationAdapter } from "./infrastructure/host-booking-authorization.adapter";
import { HostBookingClockAdapter } from "./infrastructure/host-booking-clock.adapter";
import { HostBookingTenantWorkspaceBindingAdapter } from "./infrastructure/host-booking-tenant-workspace-binding.adapter";
import { HostBookingTourCapacityAdapter } from "./infrastructure/host-booking-tour-capacity.adapter";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port";
import type { BookingClockPort } from "./ports/booking-clock.port";
import type { BookingTenantWorkspaceBindingPort } from "./ports/booking-tenant-workspace-binding.port";
import type { BookingTourCapacityPort } from "./ports/booking-tour-capacity.port";
import type { BookingActorContext } from "./ports/booking-actor-context";
import { BookingWorkspaceUnsupportedError } from "./bookings.errors";
import { assertBookingRuntimeCapabilityLevels } from "./assert-booking-runtime-capabilities";
import { toBookingRuntimeCapabilities } from "./map-booking-runtime-capabilities";
import { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant";
import { resolveWorkspaceBookingEventReaction } from "./booking-event-reaction-registry";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry";
import { isBookingSupportedWorkspace } from "./workspace-booking-bindings.generated";
import type {
  ApproveBookingResponse,
  BookingListItem,
  BookingRecord,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryQuery,
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CancelBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
  WaitlistBookingResponse,
} from "./bookings.types";
import type { WorkspaceBookingEventReactionPort } from "@app-tour/booking-http-contracts";

export type BookingWorkspaceDependencies = ReturnType<typeof resolveBookingWorkspaceDependencies>;

/** Per-workspaceType runtime — service + event reaction; shared repo/authz/clock/binding. */
export type BookingRuntime = {
  readonly workspaceType: string;
  readonly service: BookingsService;
  /** Injected approve reaction — same instance the service invokes. */
  readonly eventReaction: WorkspaceBookingEventReactionPort;
};

/** workspaceType → BookingRuntime (capability cache). Never keyed by tenantId. */
const bookingRuntimeByWorkspaceType = new Map<string, BookingRuntime>();

let sharedAuthorization: BookingAuthorizationPort | null = null;
let sharedClock: BookingClockPort | null = null;
let sharedTenantWorkspaceBinding: BookingTenantWorkspaceBindingPort | null = null;
let sharedTourCapacity: BookingTourCapacityPort | null = null;

function getSharedAuthorization(): BookingAuthorizationPort {
  if (sharedAuthorization === null) {
    sharedAuthorization = new HostBookingAuthorizationAdapter();
  }
  return sharedAuthorization;
}

function getSharedClock(): BookingClockPort {
  if (sharedClock === null) {
    sharedClock = new HostBookingClockAdapter();
  }
  return sharedClock;
}

function getSharedTenantWorkspaceBinding(): BookingTenantWorkspaceBindingPort {
  if (sharedTenantWorkspaceBinding === null) {
    sharedTenantWorkspaceBinding = new HostBookingTenantWorkspaceBindingAdapter();
  }
  return sharedTenantWorkspaceBinding;
}

function getSharedTourCapacity(): BookingTourCapacityPort {
  if (sharedTourCapacity === null) {
    sharedTourCapacity = new HostBookingTourCapacityAdapter();
  }
  return sharedTourCapacity;
}

/**
 * Capability cache: create or reuse BookingRuntime for a registry-registered workspaceType.
 * Not a tenant entry point — tenant operations must use resolve*ForTenant.
 * Service methods still enforce tenantId → workspaceType (B2.0).
 */
export function getOrCreateBookingRuntimeForWorkspaceType(workspaceType: string): BookingRuntime {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("BOOKING_WORKSPACE_TYPE_REQUIRED: workspaceType is required");
  }
  if (!isBookingSupportedWorkspace(normalized)) {
    throw new BookingWorkspaceUnsupportedError(`workspaceType=${normalized}`);
  }
  const existing = bookingRuntimeByWorkspaceType.get(normalized);
  if (existing !== undefined) {
    return existing;
  }
  const dependencies = resolveBookingWorkspaceDependencies(normalized);
  const eventReaction = resolveWorkspaceBookingEventReaction(normalized);
  const capabilities = assertBookingRuntimeCapabilityLevels(normalized, {
    publicBooking: dependencies.publicBooking,
    validationPolicy: dependencies.validationPolicy,
    capacityPolicy: dependencies.capacityPolicy,
    eventReaction,
  });
  const service = createBookingsService({
    repository: getBookingsRepository(),
    authorization: getSharedAuthorization(),
    clock: getSharedClock(),
    eventReaction,
    publicBooking: dependencies.publicBooking,
    validationPolicy: dependencies.validationPolicy,
    capacityPolicy: dependencies.capacityPolicy,
    tourCapacity: getSharedTourCapacity(),
    workspaceType: normalized,
    tenantWorkspaceBinding: getSharedTenantWorkspaceBinding(),
    capabilities: toBookingRuntimeCapabilities(capabilities),
    productionGradeIntegrity: requiresProductionGradeIntegrity(),
  });
  const runtime: BookingRuntime = {
    workspaceType: normalized,
    service,
    eventReaction,
  };
  bookingRuntimeByWorkspaceType.set(normalized, runtime);
  return runtime;
}

/**
 * Tenant-aware composition — only supported entry for tenant operations.
 * tenantId → workspaceType → cached BookingsService.
 */
export async function resolveBookingsServiceForTenant(tenantId: string): Promise<BookingsService> {
  const workspaceType = await resolveBookingWorkspaceTypeForTenant(tenantId);
  return getOrCreateBookingRuntimeForWorkspaceType(workspaceType).service;
}

export function resetBookingsServiceCompositionForTests(): void {
  bookingRuntimeByWorkspaceType.clear();
  sharedAuthorization = null;
  sharedClock = null;
  sharedTenantWorkspaceBinding = null;
  sharedTourCapacity = null;
}

/** HTTP / host façades — tenant-aware service selection (B1.5). */
export async function listBookings(
  auth: BookingActorContext,
  query: BookingsListQuery
): Promise<BookingsListResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).listBookings(auth, query);
}

export async function getBooking(
  auth: BookingActorContext,
  bookingId: string
): Promise<BookingListItem> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).getBooking(auth, bookingId);
}

export async function getBookingsSummary(
  auth: BookingActorContext,
  query: BookingsSummaryQuery = { tourChipScope: "ops" }
): Promise<BookingsSummaryResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).getBookingsSummary(auth, query);
}

export async function createBooking(
  auth: BookingActorContext,
  body: CreateBookingRequest
): Promise<CreateBookingResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).createBooking(auth, body);
}

export async function sumApprovedPartySizeByTourIds(
  tenantId: string,
  tourIds: readonly string[]
): Promise<Readonly<Record<string, number>>> {
  return (await resolveBookingsServiceForTenant(tenantId)).sumApprovedPartySizeByTourIds(
    tenantId,
    tourIds
  );
}

export type GuestBookingDuplicateMatch =
  | { readonly kind: "user"; readonly value: string }
  | { readonly kind: "label"; readonly value: string }
  | { readonly kind: "email"; readonly value: string }
  | { readonly kind: "nationalId"; readonly value: string };

/** Single guest-duplicate façade — all public match kinds. */
export async function findGuestBookingDuplicateMatch(
  tenantId: string,
  tourId: string,
  match: GuestBookingDuplicateMatch
): Promise<BookingRecord | null> {
  return (await resolveBookingsServiceForTenant(tenantId)).findGuestBookingDuplicateMatch(
    tenantId,
    tourId,
    match
  );
}

export async function createPublicGuestBooking(
  auth: BookingActorContext,
  body: CreateBookingRequest
): Promise<CreateBookingResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).createPublicGuestBooking(
    auth,
    body
  );
}

export async function approveBooking(
  auth: BookingActorContext,
  bookingId: string
): Promise<ApproveBookingResponse> {
  const result = await (
    await resolveBookingsServiceForTenant(auth.tenantId)
  ).approveBooking(auth, bookingId);
  if (result.status === "approved") {
    const { applyFreeCollectionAfterBookingApprove } = await import(
      "../workspace-finance/apply-free-collection-after-booking-approve"
    );
    await applyFreeCollectionAfterBookingApprove({
      tenantId: auth.tenantId,
      bookingId: result.id,
    });
  }
  return result;
}

export async function autoApprovePublicBooking(input: {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly actorUserId: string;
}): Promise<{ readonly id: string; readonly status: string }> {
  const result = await (
    await resolveBookingsServiceForTenant(input.tenantId)
  ).autoApprovePublicBooking(input);
  if (result.status === "approved") {
    const { applyFreeCollectionAfterBookingApprove } = await import(
      "../workspace-finance/apply-free-collection-after-booking-approve"
    );
    await applyFreeCollectionAfterBookingApprove({
      tenantId: input.tenantId,
      bookingId: result.id,
    });
  }
  return result;
}

export async function rejectBooking(
  auth: BookingActorContext,
  bookingId: string,
  body: RejectBookingRequest
): Promise<RejectBookingResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).rejectBooking(
    auth,
    bookingId,
    body
  );
}

export async function waitlistBooking(
  auth: BookingActorContext,
  bookingId: string
): Promise<WaitlistBookingResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).waitlistBooking(auth, bookingId);
}

export async function cancelBooking(
  auth: BookingActorContext,
  bookingId: string
): Promise<CancelBookingResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).cancelBooking(auth, bookingId);
}

export async function bulkApproveBookings(
  auth: BookingActorContext,
  body: BulkApproveBookingsRequest
): Promise<BulkApproveBookingsResponse> {
  const result = await (
    await resolveBookingsServiceForTenant(auth.tenantId)
  ).bulkApproveBookings(auth, body);
  if (result.approvedIds.length > 0) {
    const { applyFreeCollectionAfterBookingApprove } = await import(
      "../workspace-finance/apply-free-collection-after-booking-approve"
    );
    for (const bookingId of result.approvedIds) {
      await applyFreeCollectionAfterBookingApprove({
        tenantId: auth.tenantId,
        bookingId,
      });
    }
  }
  return result;
}

export {
  BookingNotFoundError,
  BookingStatusConflictError,
  BookingsOpsForbiddenError,
  BookingWorkspaceTenantMismatchError,
  BookingWorkspaceUnsupportedError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";
export { BookingsService, createBookingsService } from "./bookings.service";
export type { BookingsServiceDeps } from "./bookings.service";
export { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant";

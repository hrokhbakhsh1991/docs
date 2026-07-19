/**
 * Host composition root for BookingsService (Phase B0.5 + B1.5 tenant resolve).
 * Routes / Denali host keep calling façade functions — those resolve here.
 */

import { getBookingsRepository } from "./create-bookings-repository";
import { createBookingsService, type BookingsService } from "./bookings.service";
import { HostBookingAuthorizationAdapter } from "./infrastructure/host-booking-authorization.adapter";
import { HostBookingClockAdapter } from "./infrastructure/host-booking-clock.adapter";
import type { BookingAuthorizationPort } from "./ports/booking-authorization.port";
import type { BookingClockPort } from "./ports/booking-clock.port";
import type { BookingActorContext } from "./ports/booking-actor-context";
import {
  BOOT_BOOKING_WORKSPACE_TYPE,
  resolveBookingWorkspaceTypeForTenant,
} from "./resolve-booking-workspace-type-for-tenant";
import { resolveWorkspaceBookingEventReaction } from "./booking-event-reaction-registry";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry";
import type {
  ApproveBookingResponse,
  BookingRecord,
  BookingsListQuery,
  BookingsListResponse,
  BookingsSummaryResponse,
  BulkApproveBookingsRequest,
  BulkApproveBookingsResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  RejectBookingRequest,
  RejectBookingResponse,
} from "./bookings.types";

export type BookingWorkspaceDependencies = ReturnType<typeof resolveBookingWorkspaceDependencies>;

/** Per-workspaceType runtime — service + capability deps; shared repo/authz/clock. */
export type BookingRuntime = {
  readonly workspaceType: string;
  readonly service: BookingsService;
  readonly dependencies: BookingWorkspaceDependencies;
};

/** workspaceType → BookingRuntime (Phase B1.5). Never keyed by tenantId. */
const bookingRuntimeByWorkspaceType = new Map<string, BookingRuntime>();

let sharedAuthorization: BookingAuthorizationPort | null = null;
let sharedClock: BookingClockPort | null = null;

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

/**
 * Create or reuse BookingRuntime for a registry-registered workspaceType.
 * Repository / authz / clock are process singletons (not duplicated per type).
 */
export function getOrCreateBookingRuntimeForWorkspaceType(workspaceType: string): BookingRuntime {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("BOOKING_WORKSPACE_TYPE_REQUIRED: workspaceType is required");
  }
  const existing = bookingRuntimeByWorkspaceType.get(normalized);
  if (existing !== undefined) {
    return existing;
  }
  const dependencies = resolveBookingWorkspaceDependencies(normalized);
  const eventReaction = resolveWorkspaceBookingEventReaction(normalized);
  const service = createBookingsService({
    repository: getBookingsRepository(),
    authorization: getSharedAuthorization(),
    clock: getSharedClock(),
    eventReaction,
  });
  const runtime: BookingRuntime = {
    workspaceType: normalized,
    service,
    dependencies,
  };
  bookingRuntimeByWorkspaceType.set(normalized, runtime);
  return runtime;
}

/** Boot / legacy composition — Denali workspace type. */
export function resolveBookingsService(): BookingsService {
  return getOrCreateBookingRuntimeForWorkspaceType(BOOT_BOOKING_WORKSPACE_TYPE).service;
}

/**
 * Phase B1.5 — tenant-aware composition.
 * tenantId → workspaceType → cached BookingsService.
 */
export async function resolveBookingsServiceForTenant(tenantId: string): Promise<BookingsService> {
  const workspaceType = await resolveBookingWorkspaceTypeForTenant(tenantId);
  return getOrCreateBookingRuntimeForWorkspaceType(workspaceType).service;
}

/**
 * Phase B1.5 — tenant → Booking workspace dependency bag (policies / public registration tokens).
 */
export async function resolveBookingDependenciesForTenant(
  tenantId: string
): Promise<BookingWorkspaceDependencies> {
  const workspaceType = await resolveBookingWorkspaceTypeForTenant(tenantId);
  return getOrCreateBookingRuntimeForWorkspaceType(workspaceType).dependencies;
}

export function resetBookingsServiceCompositionForTests(): void {
  bookingRuntimeByWorkspaceType.clear();
  sharedAuthorization = null;
  sharedClock = null;
}

/** HTTP / host façades — tenant-aware service selection (B1.5). */
export async function listBookings(
  auth: BookingActorContext,
  query: BookingsListQuery
): Promise<BookingsListResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).listBookings(auth, query);
}

export async function getBookingsSummary(
  auth: BookingActorContext
): Promise<BookingsSummaryResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).getBookingsSummary(auth);
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

export async function findGuestBookingDuplicateByUser(
  tenantId: string,
  tourId: string,
  guestUserId: string
): Promise<BookingRecord | null> {
  return (await resolveBookingsServiceForTenant(tenantId)).findGuestBookingDuplicateByUser(
    tenantId,
    tourId,
    guestUserId
  );
}

export async function findGuestBookingDuplicateByGuestLabel(
  tenantId: string,
  tourId: string,
  guestLabel: string
): Promise<BookingRecord | null> {
  return (await resolveBookingsServiceForTenant(tenantId)).findGuestBookingDuplicateByGuestLabel(
    tenantId,
    tourId,
    guestLabel
  );
}

export async function findGuestBookingDuplicateByTourNationalId(
  tenantId: string,
  tourId: string,
  nationalId: string
): Promise<BookingRecord | null> {
  return (
    await resolveBookingsServiceForTenant(tenantId)
  ).findGuestBookingDuplicateByTourNationalId(tenantId, tourId, nationalId);
}

export async function findGuestBookingDuplicate(
  tenantId: string,
  tourId: string,
  email: string
): Promise<BookingRecord | null> {
  return (await resolveBookingsServiceForTenant(tenantId)).findGuestBookingDuplicate(
    tenantId,
    tourId,
    email
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
  return (await resolveBookingsServiceForTenant(auth.tenantId)).approveBooking(auth, bookingId);
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

export async function bulkApproveBookings(
  auth: BookingActorContext,
  body: BulkApproveBookingsRequest
): Promise<BulkApproveBookingsResponse> {
  return (await resolveBookingsServiceForTenant(auth.tenantId)).bulkApproveBookings(auth, body);
}

export {
  BookingNotFoundError,
  BookingStatusConflictError,
  BookingsOpsForbiddenError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";
export { BookingsService, createBookingsService } from "./bookings.service";
export type { BookingsServiceDeps } from "./bookings.service";
export {
  BOOT_BOOKING_WORKSPACE_TYPE,
  resolveBookingWorkspaceTypeForTenant,
} from "./resolve-booking-workspace-type-for-tenant";

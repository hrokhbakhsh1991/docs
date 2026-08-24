/**
 * DP-5 — transport allocation types (facts only; no money).
 */

export type TransportAllocation = {
  readonly allocationId: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly driverRegistrationId: string;
  readonly passengerRegistrationId: string;
  readonly createdAt: string;
  readonly createdByUserId: string;
};

export type TransportAllocationInput = {
  readonly driverRegistrationId: string;
  readonly passengerRegistrationId: string;
};

export type RosterParticipant = {
  readonly registrationId: string;
  readonly status: string;
  readonly transportKind: string | null;
  readonly personalCarOccupants: number | null;
};

export type ValidateAllocationsInput = {
  readonly tourId: string;
  readonly allocations: readonly TransportAllocationInput[];
  readonly participants: readonly RosterParticipant[];
  readonly rosterFrozen: boolean;
};

export type ValidateAllocationsResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

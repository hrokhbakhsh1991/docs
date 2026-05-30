export const TOUR_CAPACITY_RESERVATION_PORT = Symbol("TOUR_CAPACITY_RESERVATION_PORT");

export type TourCapacitySnapshotInput = {
  tenantId: string;
  tourId: string;
  totalCapacity: number;
  acceptedCount: number;
};

export type TourCapacityReleaseInput = {
  tenantId: string;
  tourId: string;
  totalCapacity: number;
};

export interface TourCapacityReservationPort {
  /** Atomically consume one remaining slot. Throws CapacityExceededException if full. */
  reserveTicket(input: TourCapacitySnapshotInput): Promise<void>;
  /** Restore one slot after failed DB commit or explicit rollback. */
  releaseTicket(input: TourCapacityReleaseInput): Promise<void>;
  /** Reconcile Redis remaining counter from authoritative DB snapshot. */
  syncRemainingFromSnapshot(input: TourCapacitySnapshotInput): Promise<void>;
}

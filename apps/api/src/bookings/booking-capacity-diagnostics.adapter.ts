import { hashTenantIdForLog } from "../observability/log-safety";
import { logger } from "../observability/logger";
import type { BookingCapacityDiagnosticsPort } from "./bookings.service";

/** Opt-in, PII-free capacity tracing for one isolated Denali staging tour. */
export function createBookingCapacityDiagnosticsAdapter(): BookingCapacityDiagnosticsPort {
  return {
    assert(input) {
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
          existingDongSeats +
          (candidateTransportKind === "no_car_dong" ? input.context.partySize : 0),
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
    },
  };
}

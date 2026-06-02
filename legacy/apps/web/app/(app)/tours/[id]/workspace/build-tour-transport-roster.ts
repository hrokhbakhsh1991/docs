import type { BookingDto } from "@repo/types";

import {
  isCapacityConsumingRegistrationStatus,
  readRegistrationIsDriver,
} from "./aggregate-tour-transport-metrics";

export type TransportDriverSource = "registration" | "manual";

export type TransportDriverRow = {
  id: string;
  source: TransportDriverSource;
  driverName: string;
  availableSeats: number;
  registrationId?: string;
};

export type TransportPassengerRow = {
  id: string;
  passengerName: string;
  registrationId: string;
};

export type ManualTransportVehicle = {
  id: string;
  driverName: string;
  availableSeats: number;
};

export function buildTransportRosterFromRegistrations(
  registrations: readonly BookingDto[],
): {
  drivers: TransportDriverRow[];
  passengers: TransportPassengerRow[];
} {
  const drivers: TransportDriverRow[] = [];
  const passengers: TransportPassengerRow[] = [];

  for (const reg of registrations) {
    if (!isCapacityConsumingRegistrationStatus(reg.status)) {
      continue;
    }
    if (reg.transportMode !== "self_vehicle") {
      continue;
    }

    const isDriver = readRegistrationIsDriver(reg);
    if (isDriver === true) {
      const seats =
        typeof reg.vehicleSeatCapacity === "number" &&
        Number.isFinite(reg.vehicleSeatCapacity) &&
        reg.vehicleSeatCapacity > 0
          ? Math.floor(reg.vehicleSeatCapacity)
          : 0;
      drivers.push({
        id: reg.id,
        source: "registration",
        driverName: reg.participantFullName.trim() || "—",
        availableSeats: seats,
        registrationId: reg.id,
      });
    } else if (isDriver === false) {
      passengers.push({
        id: reg.id,
        passengerName: reg.participantFullName.trim() || "—",
        registrationId: reg.id,
      });
    }
  }

  return { drivers, passengers };
}

export function manualVehicleToDriverRow(vehicle: ManualTransportVehicle): TransportDriverRow {
  return {
    id: vehicle.id,
    source: "manual",
    driverName: vehicle.driverName,
    availableSeats: vehicle.availableSeats,
  };
}

export type DriverWithLoad = TransportDriverRow & {
  passengersAssigned: number;
  passengerNames: string[];
  status: "full" | "has_capacity";
};

/** Drivers with fewest assigned passengers first; ties by more empty seats first. */
export function sortDriversByLoad(rows: readonly DriverWithLoad[]): DriverWithLoad[] {
  return [...rows].sort((a, b) => {
    if (a.passengersAssigned !== b.passengersAssigned) {
      return a.passengersAssigned - b.passengersAssigned;
    }
    const emptyA = a.availableSeats - a.passengersAssigned;
    const emptyB = b.availableSeats - b.passengersAssigned;
    if (emptyB !== emptyA) {
      return emptyB - emptyA;
    }
    return a.driverName.localeCompare(b.driverName, "fa");
  });
}

export function deriveDriverLoadRows(
  drivers: readonly TransportDriverRow[],
  passengers: readonly TransportPassengerRow[],
  assignments: Readonly<Record<string, string>>,
): DriverWithLoad[] {
  const passengerById = new Map(passengers.map((p) => [p.registrationId, p]));

  const rows: DriverWithLoad[] = drivers.map((driver) => {
    const assigned = Object.entries(assignments)
      .filter(([, driverId]) => driverId === driver.id)
      .map(([passengerRegId]) => passengerById.get(passengerRegId))
      .filter((p): p is TransportPassengerRow => p != null);

    const passengersAssigned = assigned.length;
    const available = driver.availableSeats;

    let status: DriverWithLoad["status"];
    if (available > 0 && passengersAssigned >= available) {
      status = "full";
    } else {
      status = "has_capacity";
    }

    return {
      ...driver,
      passengersAssigned,
      passengerNames: assigned.map((p) => p.passengerName),
      status,
    };
  });

  return sortDriversByLoad(rows);
}

export function listUnassignedPassengers(
  passengers: readonly TransportPassengerRow[],
  assignments: Readonly<Record<string, string>>,
): TransportPassengerRow[] {
  return passengers.filter((p) => assignments[p.registrationId] == null);
}

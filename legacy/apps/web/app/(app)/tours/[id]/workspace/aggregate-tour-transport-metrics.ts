import type { BookingDto, RegistrationStatus } from "@repo/types";

const CAPACITY_CONSUMING_STATUSES = new Set<RegistrationStatus>(["Accepted", "AcceptedPaid"]);

export type TourTransportMetrics = {
  busHeadcount: number;
  totalCarDrivers: number;
  totalCarAvailableSeats: number;
  totalCarPassengers: number;
  carCapacityBalance: number;
  totalCapacity: number;
  busLoadRatio: number;
  selfVehicleWithoutDriverFlag: number;
};

export function isCapacityConsumingRegistrationStatus(status: RegistrationStatus): boolean {
  return CAPACITY_CONSUMING_STATUSES.has(status);
}

export function readRegistrationIsDriver(reg: BookingDto): boolean | undefined {
  const isDriver = reg.participantMetadata?.transportIntake?.isDriver;
  return typeof isDriver === "boolean" ? isDriver : undefined;
}

export function aggregateTourTransportMetrics(
  registrations: readonly BookingDto[],
  totalCapacity: number,
): TourTransportMetrics {
  let busHeadcount = 0;
  let totalCarDrivers = 0;
  let totalCarAvailableSeats = 0;
  let totalCarPassengers = 0;
  let selfVehicleWithoutDriverFlag = 0;

  for (const reg of registrations) {
    if (!isCapacityConsumingRegistrationStatus(reg.status)) {
      continue;
    }

    if (reg.transportMode === "group_vehicle") {
      busHeadcount += 1;
      continue;
    }

    if (reg.transportMode !== "self_vehicle") {
      continue;
    }

    const isDriver = readRegistrationIsDriver(reg);
    if (isDriver === true) {
      totalCarDrivers += 1;
      const seats = reg.vehicleSeatCapacity;
      if (typeof seats === "number" && Number.isFinite(seats) && seats > 0) {
        totalCarAvailableSeats += Math.floor(seats);
      }
    } else if (isDriver === false) {
      totalCarPassengers += 1;
    } else {
      selfVehicleWithoutDriverFlag += 1;
    }
  }

  const carCapacityBalance = totalCarAvailableSeats - totalCarPassengers;
  const capacity = Number.isFinite(totalCapacity) && totalCapacity > 0 ? totalCapacity : 0;
  const busLoadRatio = capacity > 0 ? Math.min(1, busHeadcount / capacity) : 0;

  return {
    busHeadcount,
    totalCarDrivers,
    totalCarAvailableSeats,
    totalCarPassengers,
    carCapacityBalance,
    totalCapacity: capacity,
    busLoadRatio,
    selfVehicleWithoutDriverFlag,
  };
}

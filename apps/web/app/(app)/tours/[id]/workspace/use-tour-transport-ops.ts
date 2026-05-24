"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { notifyDrivers } from "@/lib/services/transport-ops.service";

import {
  buildTransportRosterFromRegistrations,
  deriveDriverLoadRows,
  listUnassignedPassengers,
  manualVehicleToDriverRow,
  type DriverWithLoad,
  type ManualTransportVehicle,
  type TransportPassengerRow,
} from "./build-tour-transport-roster";
import {
  createManualVehicleId,
  loadTourTransportOps,
  saveTourTransportOps,
} from "./tour-transport-ops-storage";
import { useTourWorkspace } from "./tour-workspace-context";

export function useTourTransportOps() {
  const { tourId, registrations, readOnly } = useTourWorkspace();

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [manualVehicles, setManualVehicles] = useState<ManualTransportVehicle[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [notifyPending, setNotifyPending] = useState(false);

  useEffect(() => {
    const stored = loadTourTransportOps(tourId);
    setAssignments(stored.assignments);
    setManualVehicles(stored.manualVehicles);
    setHydrated(true);
  }, [tourId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveTourTransportOps(tourId, { assignments, manualVehicles });
  }, [tourId, assignments, manualVehicles, hydrated]);

  const { drivers: regDrivers, passengers } = useMemo(
    () => buildTransportRosterFromRegistrations(registrations),
    [registrations],
  );

  const allDrivers = useMemo(
    () => [...regDrivers, ...manualVehicles.map(manualVehicleToDriverRow)],
    [regDrivers, manualVehicles],
  );

  const driverRows: DriverWithLoad[] = useMemo(
    () => deriveDriverLoadRows(allDrivers, passengers, assignments),
    [allDrivers, passengers, assignments],
  );

  const unassignedPassengers = useMemo(
    () => listUnassignedPassengers(passengers, assignments),
    [passengers, assignments],
  );

  const assignPassenger = useCallback(
    (passengerRegistrationId: string, driverId: string) => {
      if (readOnly) {
        return;
      }
      setAssignments((prev) => ({ ...prev, [passengerRegistrationId]: driverId }));
    },
    [readOnly],
  );

  const unassignPassenger = useCallback(
    (passengerRegistrationId: string) => {
      if (readOnly) {
        return;
      }
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[passengerRegistrationId];
        return next;
      });
    },
    [readOnly],
  );

  const addManualVehicle = useCallback(
    (input: { driverName: string; availableSeats: number }) => {
      if (readOnly) {
        return;
      }
      const name = input.driverName.trim();
      if (!name) {
        return;
      }
      const seats = Math.min(3, Math.max(0, Math.floor(input.availableSeats)));
      setManualVehicles((prev) => [
        ...prev,
        { id: createManualVehicleId(), driverName: name, availableSeats: seats },
      ]);
    },
    [readOnly],
  );

  const sendTransportPlan = useCallback(async () => {
    setNotifyPending(true);
    try {
      return await notifyDrivers(tourId, {
        drivers: driverRows.map((d) => ({
          driverId: d.id,
          driverName: d.driverName,
          availableSeats: d.availableSeats,
          passengerNames: d.passengerNames,
        })),
      });
    } finally {
      setNotifyPending(false);
    }
  }, [tourId, driverRows]);

  return {
    hydrated,
    readOnly,
    driverRows,
    passengers,
    unassignedPassengers,
    assignPassenger,
    unassignPassenger,
    addManualVehicle,
    sendTransportPlan,
    notifyPending,
  };
}

export type { DriverWithLoad, TransportPassengerRow };

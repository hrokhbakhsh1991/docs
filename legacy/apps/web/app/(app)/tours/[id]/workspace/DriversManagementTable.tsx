"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  Select,
} from "@tour/ui";

import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";
import type { DriverWithLoad, TransportPassengerRow } from "./use-tour-transport-ops";

import workspaceStyles from "./tour-workspace.module.css";
import styles from "./tour-workspace-transport.module.css";

const copy = TOUR_WORKSPACE_COPY.transport.driversTable;

export type DriversManagementTableProps = {
  drivers: DriverWithLoad[];
  unassignedPassengers: TransportPassengerRow[];
  readOnly: boolean;
  onAssign: (_passengerRegistrationId: string, _driverId: string) => void;
};

function formatCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export function DriversManagementTable({
  drivers,
  unassignedPassengers,
  readOnly,
  onAssign,
}: DriversManagementTableProps) {
  const [assignDriverId, setAssignDriverId] = useState<string | null>(null);
  const [selectedPassengerId, setSelectedPassengerId] = useState("");

  const activeDriver = drivers.find((d) => d.id === assignDriverId) ?? null;
  const canAssignMore =
    activeDriver != null &&
    unassignedPassengers.length > 0 &&
    (activeDriver.availableSeats === 0 || activeDriver.passengersAssigned < activeDriver.availableSeats);

  function closeAssignModal() {
    setAssignDriverId(null);
    setSelectedPassengerId("");
  }

  function confirmAssign() {
    if (!assignDriverId || !selectedPassengerId) {
      return;
    }
    onAssign(selectedPassengerId, assignDriverId);
    closeAssignModal();
  }

  return (
    <>
      <Card data-testid="drivers-management-table">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardBody>
          {drivers.length === 0 ? (
            <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
          ) : (
            <div className={workspaceStyles.tableWrap}>
              <table className={workspaceStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">{copy.colDriverName}</th>
                    <th scope="col">{copy.colAvailableSeats}</th>
                    <th scope="col">{copy.colPassengersAssigned}</th>
                    <th scope="col">{copy.colStatus}</th>
                    <th scope="col">{copy.colAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id} data-testid={`driver-row-${driver.id}`}>
                      <th scope="row" className={workspaceStyles.rowHeader}>
                        {driver.driverName}
                        {driver.source === "manual" ? (
                          <span className={workspaceStyles.muted}> ({copy.manualBadge})</span>
                        ) : null}
                      </th>
                      <td>{formatCount(driver.availableSeats)}</td>
                      <td>
                        {formatCount(driver.passengersAssigned)}
                        {driver.passengerNames.length > 0 ? (
                          <p className={styles.assignedNames} title={driver.passengerNames.join("، ")}>
                            {driver.passengerNames.join("، ")}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <Badge
                          variant={driver.status === "full" ? "success" : "warning"}
                          data-testid={`driver-status-${driver.id}`}
                        >
                          {driver.status === "full" ? copy.statusFull : copy.statusHasCapacity}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={
                            readOnly ||
                            unassignedPassengers.length === 0 ||
                            (driver.availableSeats > 0 &&
                              driver.passengersAssigned >= driver.availableSeats)
                          }
                          data-testid={`driver-assign-${driver.id}`}
                          onClick={() => {
                            setAssignDriverId(driver.id);
                            setSelectedPassengerId(unassignedPassengers[0]?.registrationId ?? "");
                          }}
                        >
                          {copy.assign}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {unassignedPassengers.length > 0 ? (
            <p className={styles.unassignedHint} role="status">
              {copy.unassignedCount}: <strong>{formatCount(unassignedPassengers.length)}</strong>
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Modal
        open={assignDriverId != null}
        onClose={closeAssignModal}
        title={copy.assignModalTitle}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeAssignModal}>
              {copy.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!canAssignMore || !selectedPassengerId}
              onClick={confirmAssign}
            >
              {copy.confirmAssign}
            </Button>
          </>
        }
      >
        {activeDriver ? (
          <p className={styles.assignModalLead}>{copy.assignModalDescription(activeDriver.driverName)}</p>
        ) : null}
        {unassignedPassengers.length === 0 ? (
          <p>{copy.noUnassigned}</p>
        ) : (
          <label className={styles.assignField}>
            <span className={styles.assignLabel}>{copy.selectPassenger}</span>
            <Select
              value={selectedPassengerId}
              onChange={(e) => setSelectedPassengerId(e.target.value)}
              data-testid="assign-passenger-select"
            >
              {unassignedPassengers.map((p) => (
                <option key={p.registrationId} value={p.registrationId}>
                  {p.passengerName}
                </option>
              ))}
            </Select>
          </label>
        )}
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";

import { Button, Input, Modal } from "@tour/ui";

import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";

import styles from "./tour-workspace-transport.module.css";

const copy = TOUR_WORKSPACE_COPY.transport.actionCenter;

export type TransportActionCenterProps = {
  readOnly: boolean;
  notifyPending: boolean;
  onSendPlan: () => Promise<{ driversNotified: number } | undefined>;
  onAddManualVehicle: (input: { driverName: string; availableSeats: number }) => void;
};

export function TransportActionCenter({
  readOnly,
  notifyPending,
  onSendPlan,
  onAddManualVehicle,
}: TransportActionCenterProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [seatsRaw, setSeatsRaw] = useState("2");

  function closeManual() {
    setManualOpen(false);
    setDriverName("");
    setSeatsRaw("2");
  }

  function submitManual() {
    const seats = Number.parseInt(seatsRaw, 10);
    onAddManualVehicle({
      driverName,
      availableSeats: Number.isFinite(seats) ? seats : 0,
    });
    closeManual();
  }

  return (
    <>
      <div className={styles.actionCenter} data-testid="transport-action-center">
        <div className={styles.actionCenterText}>
          <h2 className={styles.actionCenterTitle}>{copy.title}</h2>
          <p className={styles.actionCenterHint}>{copy.hint}</p>
        </div>
        <div className={styles.actionCenterButtons}>
          <Button
            type="button"
            variant="secondary"
            disabled={readOnly}
            data-testid="transport-add-manual-vehicle"
            onClick={() => setManualOpen(true)}
          >
            {copy.addManualVehicle}
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={notifyPending}
            disabled={readOnly || notifyPending}
            data-testid="transport-send-plan"
            onClick={() => void onSendPlan()}
          >
            {copy.exportSendPlan}
          </Button>
        </div>
      </div>

      <Modal
        open={manualOpen}
        onClose={closeManual}
        title={copy.manualModalTitle}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeManual}>
              {copy.cancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!driverName.trim()}
              onClick={submitManual}
            >
              {copy.addVehicleConfirm}
            </Button>
          </>
        }
      >
        <p className={styles.assignModalLead}>{copy.manualModalDescription}</p>
        <div className={styles.manualForm}>
          <label className={styles.assignField}>
            <span className={styles.assignLabel}>{copy.driverNameLabel}</span>
            <Input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder={copy.driverNamePlaceholder}
              data-testid="manual-vehicle-driver-name"
            />
          </label>
          <label className={styles.assignField}>
            <span className={styles.assignLabel}>{copy.seatsLabel}</span>
            <Input
              inputMode="numeric"
              value={seatsRaw}
              onChange={(e) => setSeatsRaw(e.target.value)}
              data-testid="manual-vehicle-seats"
            />
          </label>
        </div>
      </Modal>
    </>
  );
}

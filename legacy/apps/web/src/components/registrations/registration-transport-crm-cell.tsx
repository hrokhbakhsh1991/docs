"use client";

import { memo } from "react";

import type { BookingDto } from "@repo/types";

import { formatRegistrationCrmSummary } from "@/lib/registrations/format-registration-crm";

import styles from "./registration-transport-crm-cell.module.css";

export type RegistrationTransportCrmCellProps = {
  reg: Pick<BookingDto, "transportMode" | "vehicleSeatCapacity" | "participantNote">;
};

function transportCrmPropsEqual(
  prev: RegistrationTransportCrmCellProps,
  next: RegistrationTransportCrmCellProps,
): boolean {
  return (
    prev.reg.transportMode === next.reg.transportMode &&
    prev.reg.vehicleSeatCapacity === next.reg.vehicleSeatCapacity &&
    prev.reg.participantNote === next.reg.participantNote
  );
}

export const RegistrationTransportCrmCell = memo(function RegistrationTransportCrmCell({
  reg,
}: RegistrationTransportCrmCellProps) {
  const { transportLabel, seatBadge, notePreview, noteFull } = formatRegistrationCrmSummary(reg);

  return (
    <div className={styles.root}>
      <div className={styles.transportRow}>
        <span className={styles.transportLabel}>{transportLabel}</span>
        {seatBadge ? <span className={styles.seatBadge}>{seatBadge}</span> : null}
      </div>
      {notePreview ? (
        <p className={styles.note} title={noteFull ?? undefined}>
          {notePreview}
        </p>
      ) : (
        <p className={styles.noteMuted}>—</p>
      )}
    </div>
  );
}, transportCrmPropsEqual);

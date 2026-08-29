import { isZeroObligationMinor, readObligationOverrideFromIntake } from "@app-tour/finance-core";
import { Prisma } from "@prisma/client";

import type { BookingRecord } from "./bookings.types";
import { readRegistrantTargetFromIntake } from "./read-registrant-target";
import {
  readPersonalCarOccupantsFromIntake,
  readTransportKindFromIntake,
  type BookingTransportKind,
} from "./read-transport-kind-from-intake";

export type BookingListIntakeScalars = {
  readonly registrantTarget: "self" | "other";
  readonly transportKind: BookingTransportKind | null;
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly obligationOverride: Readonly<Record<string, unknown>> | null;
};

export function resolveFinancialDisplayStateForListRecord(
  record: Pick<BookingRecord, "status" | "paymentStatus" | "financialDisplayState">,
  obligationOverride: Readonly<Record<string, unknown>> | null | undefined
): BookingRecord["financialDisplayState"] {
  if (record.financialDisplayState !== undefined) {
    return record.financialDisplayState;
  }
  if (record.status !== "approved" || record.paymentStatus !== "paid") {
    return undefined;
  }
  const override = readObligationOverrideFromIntake(
    obligationOverride === null || obligationOverride === undefined
      ? undefined
      : { obligationOverride }
  );
  if (override === null || !isZeroObligationMinor(override.obligationMinor)) {
    return undefined;
  }
  return "WAIVED";
}

export async function loadBookingListIntakeScalarsById(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ids: readonly string[]
): Promise<Map<string, BookingListIntakeScalars>> {
  if (ids.length === 0) {
    return new Map();
  }

  const idSql = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  const scalarRows = await tx.$queryRaw<
    Array<{
      readonly id: string;
      readonly registrant_target: "self" | "other";
      readonly transport_kind: BookingTransportKind | null;
      readonly personal_car_occupants: number | null;
      readonly obligation_override: Prisma.JsonValue | null;
    }>
  >`
    SELECT
      id,
      CASE
        WHEN registration_intake->>'registrantTarget' = 'other' THEN 'other'
        ELSE 'self'
      END AS registrant_target,
      CASE
        WHEN registration_intake->'transport'->>'kind' IN (
          'primary',
          'personal_car',
          'no_car_dong',
          'no_car_acquaintance'
        )
        THEN registration_intake->'transport'->>'kind'
        ELSE NULL
      END AS transport_kind,
      CASE
        WHEN registration_intake->'transport'->>'personalCarOccupants' IN ('1','2','3')
        THEN (registration_intake->'transport'->>'personalCarOccupants')::int
        ELSE NULL
      END AS personal_car_occupants,
      registration_intake->'obligationOverride' AS obligation_override
    FROM operator_registrations
    WHERE tenant_id = ${tenantId}::uuid
      AND id IN (${idSql})
  `;

  return new Map(
    scalarRows.map((row) => {
      const personalCarOccupants =
        row.personal_car_occupants === 1 ||
        row.personal_car_occupants === 2 ||
        row.personal_car_occupants === 3
          ? (row.personal_car_occupants as 1 | 2 | 3)
          : null;
      const obligationOverride =
        row.obligation_override !== null &&
        typeof row.obligation_override === "object" &&
        !Array.isArray(row.obligation_override)
          ? (row.obligation_override as Readonly<Record<string, unknown>>)
          : null;

      return [
        row.id,
        {
          registrantTarget: row.registrant_target,
          transportKind: row.transport_kind,
          personalCarOccupants,
          obligationOverride,
        },
      ] as const;
    })
  );
}

export function attachBookingListIntakeScalars(
  records: readonly BookingRecord[],
  scalarsById: ReadonlyMap<string, BookingListIntakeScalars>
): BookingRecord[] {
  return records.map((record) => {
    const scalars = scalarsById.get(record.id);
    if (scalars === undefined) {
      return record;
    }

    const financialDisplayState = resolveFinancialDisplayStateForListRecord(
      record,
      scalars.obligationOverride
    );

    return {
      ...record,
      registrantTarget: scalars.registrantTarget,
      transportKind: scalars.transportKind,
      personalCarOccupants: scalars.personalCarOccupants,
      ...(financialDisplayState !== undefined ? { financialDisplayState } : {}),
    };
  });
}

export async function enrichBookingListRecordsWithIntakeScalars(
  tx: Prisma.TransactionClient,
  tenantId: string,
  records: readonly BookingRecord[]
): Promise<BookingRecord[]> {
  if (records.length === 0) {
    return [];
  }
  const scalarsById = await loadBookingListIntakeScalarsById(
    tx,
    tenantId,
    records.map((record) => record.id)
  );
  return attachBookingListIntakeScalars(records, scalarsById);
}

/** In-memory list projection — derive scalars from full intake without exposing blob. */
export function enrichInMemoryBookingListRecord(record: BookingRecord): BookingRecord {
  const registrationIntake = record.registrationIntake;
  const obligationOverride =
    registrationIntake !== undefined &&
    registrationIntake !== null &&
    typeof registrationIntake.obligationOverride === "object" &&
    registrationIntake.obligationOverride !== null &&
    !Array.isArray(registrationIntake.obligationOverride)
      ? (registrationIntake.obligationOverride as Readonly<Record<string, unknown>>)
      : null;
  const financialDisplayState = resolveFinancialDisplayStateForListRecord(
    record,
    obligationOverride
  );
  const { registrationIntake: _intake, ...rest } = record;
  return {
    ...rest,
    registrantTarget: readRegistrantTargetFromIntake(registrationIntake),
    transportKind: readTransportKindFromIntake(registrationIntake),
    personalCarOccupants: readPersonalCarOccupantsFromIntake(registrationIntake),
    ...(financialDisplayState !== undefined ? { financialDisplayState } : {}),
  };
}

/**
 * Derive transport intake scalars from registrationIntake JSON without exposing the blob on list.
 * @see docs/dev/list-projection-guards.mdoc · H5-T3 / BK-SAFE-01
 */

export type BookingTransportKind =
  | "primary"
  | "personal_car"
  | "no_car_dong"
  | "no_car_acquaintance";

export function readTransportKindFromIntake(
  intake: Readonly<Record<string, unknown>> | null | undefined
): BookingTransportKind | null {
  if (intake === null || intake === undefined) {
    return null;
  }
  const transport = intake.transport;
  if (typeof transport !== "object" || transport === null) {
    return null;
  }
  const kind = (transport as Record<string, unknown>).kind;
  if (
    kind === "primary" ||
    kind === "personal_car" ||
    kind === "no_car_dong" ||
    kind === "no_car_acquaintance"
  ) {
    return kind;
  }
  return null;
}

export function readPersonalCarOccupantsFromIntake(
  intake: Readonly<Record<string, unknown>> | null | undefined
): 1 | 2 | 3 | null {
  if (intake === null || intake === undefined) {
    return null;
  }
  const transport = intake.transport;
  if (typeof transport !== "object" || transport === null) {
    return null;
  }
  const occupants = (transport as Record<string, unknown>).personalCarOccupants;
  if (occupants === 1 || occupants === 2 || occupants === 3) {
    return occupants;
  }
  return null;
}

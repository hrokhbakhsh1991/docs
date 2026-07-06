import type { DenaliGlobalStructuralInvariant } from "../field-registry/DenaliFieldRegistry.types";

/** Global structural invariants (not expressible as per-field matrix tags). */
export const DENALI_GLOBAL_STRUCTURAL_INVARIANTS: readonly DenaliGlobalStructuralInvariant[] = [
  {
    kind: "clearFieldWhenTransportMode",
    targetCanonical: "transport.allowPersonalCar",
    modes: ["shared_cars"],
  },
  {
    kind: "clearFieldWhenTransportMode",
    targetCanonical: "transport.dongAmount",
    modes: ["organizer_vehicle", "bus", "minibus", "train", "none"],
  },
  { kind: "syncProgramItineraryToDayCount" },
  { kind: "pruneItinerarySegmentPhotoIds" },
];

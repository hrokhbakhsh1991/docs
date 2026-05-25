import type { DenaliGlobalStructuralInvariant } from "./DenaliFieldRegistry.types";

/** Global structural invariants (not expressible as per-field matrix tags). */
export const DENALI_GLOBAL_STRUCTURAL_INVARIANTS: readonly DenaliGlobalStructuralInvariant[] = [
  {
    kind: "clearFieldWhenTransportMode",
    targetCanonical: "transport.allowPersonalCar",
    modes: ["shared_cars"],
  },
  { kind: "syncProgramItineraryToDayCount" },
];

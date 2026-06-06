/**
 * Trunk shim for legacy `@repo/types/denali`.
 */

export type { DenaliCanonicalTransportMode } from "./denali-transport-rules";

export type DenaliCanonicalDuration = "single" | "multi";

export type DenaliCanonicalTourModel = {
  readonly category: import("./denali-canonical-basics").DenaliTourCategory;
  readonly duration: DenaliCanonicalDuration;
};

export {
  isDenaliAdminCapacityApprovalVisible,
  isDenaliAllowPersonalCarVisible,
  isDenaliOrganizedTransportMode,
  isDenaliOrganizedTransportWithPersonalCarOption,
  isDenaliSeatPreferenceRequired,
  isDenaliSeatPreferenceVisible,
  isDenaliTransportCostVisible,
  isDenaliTransportDongAmountRequired,
  isDenaliTransportDongAmountVisible,
} from "./denali-transport-rules";

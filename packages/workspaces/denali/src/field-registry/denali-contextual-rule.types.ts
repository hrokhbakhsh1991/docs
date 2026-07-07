/** Workspace UI flags from {@link getCapabilitiesForProfile} (not tour category × duration matrix). */
export type DenaliWorkspaceCapabilityFlag = "canDefineCustomServices";

/**
 * Runtime visibility/required rule evaluated from registry (replaces denaliUIAdapter if-chains).
 * Transport kinds delegate to `@repo/types/denali` — do not duplicate mode logic here.
 */
export type DenaliContextualRule =
  | { readonly kind: "whenTruthy"; readonly watchCanonical: string }
  | { readonly kind: "capability"; readonly flag: DenaliWorkspaceCapabilityFlag }
  | { readonly kind: "transportOrganizedCostVisible" }
  | { readonly kind: "transportPersonalCarOptionVisible" }
  | { readonly kind: "transportDongVisible" }
  | { readonly kind: "transportAdminCapacityVisible" }
  | { readonly kind: "transportTrainSeatVisible" }
  | { readonly kind: "multiDayEndDateTimeRequired" }
  | { readonly kind: "singleDayTourOnly" }
  | { readonly kind: "peakExperienceVisible" }
  | { readonly kind: "groupInsuranceVisible" }
  | { readonly kind: "telegramIntegrationActive" };

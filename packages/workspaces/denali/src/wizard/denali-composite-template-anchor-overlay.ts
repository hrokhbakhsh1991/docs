import { DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR } from "../composites/denali-composite-anchors";

/** P3 wizard overlay — transport composite dependents (metadata SoT frozen under composites/). */
export const DENALI_COMPOSITE_TEMPLATE_ANCHOR_OVERLAY: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  "transport.mode": [
    "transport.transportCost",
    "transport.allowPersonalCar",
    "transport.dongAmount",
    "transport.transportNotes",
    "transport.seatPreference",
    "transport.adminCapacityApproval",
  ],
});

export function listDenaliCompositeTemplateDependentsForAnchor(
  anchorPath: string
): readonly string[] {
  return (
    DENALI_COMPOSITE_TEMPLATE_ANCHOR_OVERLAY[anchorPath] ??
    DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[anchorPath] ??
    []
  );
}

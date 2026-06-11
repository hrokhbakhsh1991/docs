/**
 * Phase 9.8 — legacy `(app)/` route parity inventory (DEC-P9-008).
 * Authority: docs/phase-9/appendices/OPERATOR-PRODUCT-SCOPE.md
 */
export type OperatorRouteParityStatus = "landed" | "alias" | "deferred";

export type OperatorRouteParityEntry = {
  readonly id: string;
  readonly legacyPath: string;
  /** Relative to `apps/web/app/` — must exist when status is `landed` or `alias`. */
  readonly trunkAppPath: string;
  readonly aliasTarget?: string;
  readonly subphase: string;
  readonly status: OperatorRouteParityStatus;
};

export const OPERATOR_ROUTE_PARITY_INVENTORY: readonly OperatorRouteParityEntry[] = [
  {
    id: "P9-R-01",
    legacyPath: "auth/login",
    trunkAppPath: "auth/login/page.tsx",
    subphase: "9.1",
    status: "landed",
  },
  {
    id: "P9-R-02",
    legacyPath: "(app)/dashboard",
    trunkAppPath: "(app)/dashboard/page.tsx",
    subphase: "9.2",
    status: "landed",
  },
  {
    id: "P9-R-03",
    legacyPath: "(app)/tours",
    trunkAppPath: "(app)/tours/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-04",
    legacyPath: "(app)/tours/[id]/workspace",
    trunkAppPath: "(app)/tours/[id]/workspace/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-05",
    legacyPath: "(app)/tours/[id]/workspace/waitlist",
    trunkAppPath: "(app)/tours/[id]/workspace/waitlist/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-06",
    legacyPath: "(app)/tours/[id]/workspace/transport",
    trunkAppPath: "(app)/tours/[id]/workspace/transport/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-07",
    legacyPath: "(app)/tours/[id]/edit",
    trunkAppPath: "(app)/tours/[id]/edit/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-08",
    legacyPath: "(app)/tours/[id]/register",
    trunkAppPath: "(app)/tours/[id]/register/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-09",
    legacyPath: "(app)/leader/review",
    trunkAppPath: "(app)/leader/review/page.tsx",
    aliasTarget: "/bookings?view=inbox_table&scope=leader",
    subphase: "9.5",
    status: "alias",
  },
  {
    id: "P9-R-10",
    legacyPath: "/tours/new",
    trunkAppPath: "tours/new/page.tsx",
    subphase: "9.3",
    status: "landed",
  },
  {
    id: "P9-R-11",
    legacyPath: "(app)/users",
    trunkAppPath: "(app)/users/page.tsx",
    subphase: "9.4",
    status: "landed",
  },
  {
    id: "P9-R-12",
    legacyPath: "(app)/bookings",
    trunkAppPath: "(app)/bookings/page.tsx",
    subphase: "9.5",
    status: "landed",
  },
  {
    id: "P9-R-13",
    legacyPath: "(app)/bookings/new",
    trunkAppPath: "(app)/bookings/new/page.tsx",
    subphase: "9.5",
    status: "landed",
  },
  {
    id: "P9-R-14",
    legacyPath: "(app)/bookings/[id]",
    trunkAppPath: "(app)/bookings/[id]/page.tsx",
    aliasTarget: "/bookings?bookingId={id}",
    subphase: "9.5",
    status: "alias",
  },
  {
    id: "P9-R-15",
    legacyPath: "(app)/settings",
    trunkAppPath: "(app)/settings/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-16",
    legacyPath: "(app)/settings/tour-wizard-template",
    trunkAppPath: "(app)/settings/tour-wizard-template/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-17",
    legacyPath: "(app)/settings/tour-form-defaults",
    trunkAppPath: "(app)/settings/tour-presets/page.tsx",
    aliasTarget: "(app)/settings/tour-presets",
    subphase: "9.6",
    status: "alias",
  },
  {
    id: "P9-R-18",
    legacyPath: "(app)/settings/tour-presets/advanced",
    trunkAppPath: "(app)/settings/tour-presets/advanced/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-19",
    legacyPath: "(app)/settings/guide-languages",
    trunkAppPath: "(app)/settings/guide-languages/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-20",
    legacyPath: "(app)/settings/equipment",
    trunkAppPath: "(app)/settings/equipment/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-21",
    legacyPath: "(app)/settings/tour-themes",
    trunkAppPath: "(app)/settings/tour-themes/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-22",
    legacyPath: "(app)/settings/locations",
    trunkAppPath: "(app)/settings/locations/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-23",
    legacyPath: "(app)/settings/audit-trail",
    trunkAppPath: "(app)/settings/audit-trail/page.tsx",
    subphase: "9.6",
    status: "landed",
  },
  {
    id: "P9-R-24",
    legacyPath: "(app)/finance",
    trunkAppPath: "(app)/finance/page.tsx",
    subphase: "9.7",
    status: "landed",
  },
  {
    id: "P9-R-25",
    legacyPath: "(app)/finance?tab=prepayments",
    trunkAppPath: "(app)/finance/page.tsx",
    subphase: "9.7",
    status: "landed",
  },
  {
    id: "P9-R-26",
    legacyPath: "(app)/settings/reconciliation-triage",
    trunkAppPath: "(app)/settings/reconciliation-triage/page.tsx",
    subphase: "9.7",
    status: "landed",
  },
];

export function listOperatorRouteParityByStatus(
  status: OperatorRouteParityStatus
): readonly OperatorRouteParityEntry[] {
  return OPERATOR_ROUTE_PARITY_INVENTORY.filter((entry) => entry.status === status);
}

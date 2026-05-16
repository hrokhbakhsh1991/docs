import type { WorkspaceRole } from "@repo/shared";

/**
 * Immutable inputs for one finance pricing evaluation (server-side only).
 *
 * TODO: Extend for coupons, seasonal windows, dynamic catalog keys, surge multipliers (see `README` on rules).
 */
export type PricingContext = {
  tenantId: string;
  tourId: string;
  departureId: string;
  userRole: WorkspaceRole;
  discountCode?: string | null;
};

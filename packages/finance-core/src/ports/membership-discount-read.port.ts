/**
 * Identity membership discount read port (CQ-2A — interface only).
 * Finance reads tenant-scoped eligibility at quote freeze; Identity implements.
 */

export interface MembershipDiscountReadPort {
  /**
   * Permanent membership discount percentage for `(tenantId, userId)`.
   * Returns null when no discount is configured or membership is absent.
   */
  getMembershipDiscountPercentage(tenantId: string, userId: string): Promise<number | null>;
}

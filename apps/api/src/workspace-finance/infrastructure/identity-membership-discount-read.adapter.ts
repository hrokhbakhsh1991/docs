import { normalizeMemberDiscountPercentage } from "@app-tour/finance-core/domain";
import type { MembershipDiscountReadPort } from "@app-tour/finance-core/ports";

import { getIdentityRepository } from "../../identity/create-identity-repository";

/**
 * Identity-backed membership discount read for commercial quote freeze (CQ-2B).
 * Finance-core never imports Identity — host adapter only.
 */
export class IdentityMembershipDiscountReadAdapter implements MembershipDiscountReadPort {
  async getMembershipDiscountPercentage(
    tenantId: string,
    userId: string
  ): Promise<number | null> {
    const membership = await getIdentityRepository().findMembership(
      userId.trim(),
      tenantId.trim()
    );
    if (membership === null || membership.status !== "ACTIVE") {
      return null;
    }

    return normalizeMemberDiscountPercentage(
      membership.rewards?.permanentDiscountPercentage ?? null
    );
  }
}

/**
 * Registration + tour context for commercial quote freeze (CQ-2B).
 * Host implements via booking + tour canonical reads.
 */

export type CommercialQuoteFreezeContext = {
  readonly memberUserId: string | null;
  readonly allowMembershipDiscount: boolean;
};

export interface CommercialQuoteFreezeContextPort {
  resolveRegistrationFreezeContext(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<CommercialQuoteFreezeContext | null>;
}

import type { TourLifecycleStatus } from "@repo/domain-contracts";

/** Tour capacity fields used by registration / waitlist policies. */
export type TourCapacityPolicySnapshot = {
  lifecycleStatus: TourLifecycleStatus;
  acceptedCount: number;
  totalCapacity: number;
};

export type RegistrationStatusPolicySnapshot = {
  status: string;
};

export type WaitlistItemPolicySnapshot = {
  status: string;
};

import type { LeaderRegistrationRow } from "@/lib/hooks/useLeaderTourRegistrations";

import type { RegistrationStatus } from "@repo/types";

export type QueueFilter = "pending" | "all";
export type ReviewStatusFilter = "all" | RegistrationStatus;

export type ReviewOverview = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type ReviewFiltersState = {
  queueFilter: QueueFilter;
  statusFilter: ReviewStatusFilter;
  participantFilter: string;
  fromDate: string;
  toDate: string;
};

export type ReviewInspectionSelection = LeaderRegistrationRow | null;


import type { MemberDashboardWalletSummary } from "@/me/wallet/member-dashboard-wallet-summary.server";

import type { MemberEngagementSummaryView } from "@/me/engagement/member-engagement-bff.server";

export type MemberDashboardEngagementProps = {
  readonly engagement: MemberEngagementSummaryView | { readonly enabled: false };
  readonly wallet: MemberDashboardWalletSummary;
  readonly openTicketsCount: number | null;
  readonly nextTourTitle: string | null;
  readonly nextTourDepartureAt: string | null;
  readonly profileComplete: boolean;
  readonly engagementHref: string;
  readonly registrationsHref: string;
  readonly walletHref: string;
};

"use client";

import type { ReviewOverview } from "@/features/leader-review/types";
import { MetricCard } from "@/components/shared/MetricCard";

export type ReviewSummaryCardsProps = {
  overview: ReviewOverview;
};

export function ReviewSummaryCards({ overview }: ReviewSummaryCardsProps) {
  return (
    <div
      style={{
        marginBottom: "1rem",
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
      }}
    >
      <MetricCard title="Total bookings" value={overview.total} />
      <MetricCard title="Pending review" value={overview.pending} />
      <MetricCard title="Approved" value={overview.approved} />
      <MetricCard title="Rejected / cancelled" value={overview.rejected} />
    </div>
  );
}


"use client";

import type { ReviewOverview } from "@/features/leader-review/types";
import { MetricCard } from "@/components/shared/MetricCard";

import { LEADER_REVIEW_COPY } from "../leader-review-copy";

const copy = LEADER_REVIEW_COPY.summary;

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
      <MetricCard title={copy.total} value={overview.total} />
      <MetricCard title={copy.pending} value={overview.pending} />
      <MetricCard title={copy.approved} value={overview.approved} />
      <MetricCard title={copy.rejectedCancelled} value={overview.rejected} />
    </div>
  );
}

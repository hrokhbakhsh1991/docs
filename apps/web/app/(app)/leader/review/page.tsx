import type { Metadata } from "next";

import { LeaderReviewClient } from "./leader-review-client";

export const metadata: Metadata = {
  title: "Leader review dashboard",
  description: "Leader-only review and reporting dashboard across tenant tour registrations.",
};

export default function LeaderReviewPage() {
  return <LeaderReviewClient />;
}

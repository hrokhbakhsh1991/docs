import type { Metadata } from "next";

import { LeaderReviewClient } from "./leader-review-client";

export const metadata: Metadata = {
  title: "Review queue",
  description: "Pending registrations across your tours for leader review.",
};

export default function LeaderReviewPage() {
  return <LeaderReviewClient />;
}

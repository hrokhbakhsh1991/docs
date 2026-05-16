import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { LoadingState } from "@tour/ui";

const LeaderReviewClient = dynamic(
  () => import("./leader-review-client").then((m) => m.LeaderReviewClient),
  {
    ssr: false,
    loading: () => <LoadingState message="Loading review queue…" />,
  },
);

export const metadata: Metadata = {
  title: "Leader review dashboard",
  description: "Leader-only review and reporting dashboard across tenant tour registrations.",
};

export default function LeaderReviewPage() {
  return <LeaderReviewClient />;
}

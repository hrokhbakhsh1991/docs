import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { LoadingState } from "@tour/ui";

import { LEADER_REVIEW_COPY } from "./leader-review-copy";

const LeaderReviewClient = dynamic(
  () => import("./leader-review-client").then((m) => m.LeaderReviewClient),
  {
    ssr: false,
    loading: () => <LoadingState message={LEADER_REVIEW_COPY.page.loadingSession} />,
  },
);

export const metadata: Metadata = {
  title: LEADER_REVIEW_COPY.metadata.title,
  description: LEADER_REVIEW_COPY.metadata.description,
};

export default function LeaderReviewPage() {
  return <LeaderReviewClient />;
}

import type { ReactNode } from "react";

import { assertLeaderReviewRouteAccess } from "@/lib/auth/require-leader-review-route";

export default function LeaderReviewLayout({ children }: { children: ReactNode }) {
  assertLeaderReviewRouteAccess();
  return children;
}

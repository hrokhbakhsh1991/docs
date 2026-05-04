import { canAccessLeaderReview } from "./routeRolePolicy";

export type LeaderReviewUserLike = {
  role?: string | null;
} | null | undefined;

/**
 * Single authority for leader/review access checks.
 * Keep this function pure (no redirects / router side effects in render paths).
 */
export function isLeaderReviewAllowed(user: LeaderReviewUserLike): boolean {
  return canAccessLeaderReview(user?.role ?? undefined, "/leader/review");
}


/**
 * Exact GitHub Actions job contexts required on `dev` (staging trunk).
 * Keep in sync with workflow YAML — enforced by verify-dev-required-check-names.mjs.
 *
 * @see docs/dev/deployment-branch-model.md
 * @see reports/GITHUB_BRANCH_PROTECTION.md
 */
import { BOOKING_POSTGRES_REQUIRED_CHECKS } from "./main-branch-required-checks.mjs";

export { BOOKING_POSTGRES_REQUIRED_CHECKS };

/** PR/staging gates — excludes trunk-only jobs (ci:integrity, full gates, scheduled E2E). */
export const DEV_BRANCH_REQUIRED_CHECKS = [
  "Phase 0 foundation gate",
  "Phase 0 integration gate",
  "Phase 1 platform-core gate",
  "Phase 4 gate (Postgres required)",
  "Phase 5 gate (Postgres required)",
  "Booking PostgreSQL capacity",
  "Booking HTTP PostgreSQL",
  "marketing-guard",
];

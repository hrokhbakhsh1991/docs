import { execSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";

import { OPERATOR_SMOKE } from "../../../../api/test/fixtures/operator-smoke-e2e-tenant";

import { fetchUnreadNotificationCount } from "./portal-member-notifications";

function adminDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim() || "";
  return raw.split("?")[0] ?? raw;
}

/**
 * Idempotent smoke setup: ensure operator smoke member has unread inbox rows.
 * Uses Postgres read_at reset (test fixture only — UI mutations remain real-e2e).
 */
export async function ensurePortalSmokeMemberHasUnreadNotifications(page: Page): Promise<void> {
  const unread = await fetchUnreadNotificationCount(page);
  if (unread > 0) {
    return;
  }

  const databaseUrl = adminDatabaseUrl();
  if (databaseUrl.length === 0) {
    throw new Error("ensurePortalSmokeMemberHasUnreadNotifications: DATABASE_URL_ADMIN required");
  }

  execSync(
    `psql "${databaseUrl}" -v ON_ERROR_STOP=1 -c "UPDATE member_notifications SET read_at = NULL WHERE tenant_id = '${OPERATOR_SMOKE.tenantId}'::uuid AND user_id = '${OPERATOR_SMOKE.memberUserId}'::uuid;"`,
    { stdio: "pipe" }
  );

  const unreadAfterReset = await fetchUnreadNotificationCount(page);
  expect(
    unreadAfterReset,
    "operator smoke member must have notification rows to reset"
  ).toBeGreaterThan(0);
}

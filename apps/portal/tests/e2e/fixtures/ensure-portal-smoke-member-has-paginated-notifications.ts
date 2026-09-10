import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { OPERATOR_SMOKE } from "../../../../api/test/fixtures/operator-smoke-e2e-tenant";

const PAGE_SIZE = 20;
const TARGET_COUNT = PAGE_SIZE + 3;

function adminDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim() || "";
  return raw.split("?")[0] ?? raw;
}

function countSmokeMemberNotifications(): number {
  const databaseUrl = adminDatabaseUrl();
  if (databaseUrl.length === 0) {
    throw new Error("ensurePortalSmokeMemberHasPaginatedNotifications: DATABASE_URL_ADMIN required");
  }

  const output = execSync(
    `psql "${databaseUrl}" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM member_notifications WHERE tenant_id = '${OPERATOR_SMOKE.tenantId}'::uuid AND user_id = '${OPERATOR_SMOKE.memberUserId}'::uuid;"`,
    { encoding: "utf8" },
  ).trim();

  const count = Number.parseInt(output, 10);
  if (!Number.isFinite(count)) {
    throw new Error(`ensurePortalSmokeMemberHasPaginatedNotifications: invalid count ${output}`);
  }
  return count;
}

/**
 * Idempotent smoke setup: ensure operator smoke member has more than one inbox page.
 */
export function ensurePortalSmokeMemberHasPaginatedNotifications(): number {
  const existing = countSmokeMemberNotifications();
  if (existing > PAGE_SIZE) {
    return existing;
  }

  const databaseUrl = adminDatabaseUrl();
  const toInsert = TARGET_COUNT - existing;
  for (let index = 0; index < toInsert; index += 1) {
    const entityId = randomUUID();
    const dedupeKey = `bqc-pagination-${OPERATOR_SMOKE.memberUserId}-${index}`;
    const title = `Pagination smoke ${index + 1}`;
    const sql = `
      INSERT INTO member_notifications (
        tenant_id,
        user_id,
        source_module,
        event_type,
        entity_type,
        entity_id,
        title,
        body,
        dedupe_key,
        read_at
      ) VALUES (
        '${OPERATOR_SMOKE.tenantId}'::uuid,
        '${OPERATOR_SMOKE.memberUserId}'::uuid,
        'booking',
        'registration.approved',
        'registration',
        '${entityId}'::uuid,
        '${title.replace(/'/g, "''")}',
        'Pagination fixture row for NOTIF-BQC-19.',
        '${dedupeKey}',
        NULL
      )
      ON CONFLICT (tenant_id, user_id, dedupe_key)
      DO UPDATE SET read_at = NULL, created_at = now();
    `;
    execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -c "${sql.replace(/\n/g, " ")}"`, {
      stdio: "pipe",
    });
  }

  const total = countSmokeMemberNotifications();
  if (total <= PAGE_SIZE) {
    throw new Error(
      `ensurePortalSmokeMemberHasPaginatedNotifications: expected >${PAGE_SIZE} rows, got ${total}`,
    );
  }
  return total;
}

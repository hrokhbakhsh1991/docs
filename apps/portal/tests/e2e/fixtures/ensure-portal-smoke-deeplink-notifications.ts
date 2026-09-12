import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { OPERATOR_SMOKE } from "../../../../api/test/fixtures/operator-smoke-e2e-tenant";

function adminDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim() || "";
  return raw.split("?")[0] ?? raw;
}

type DeeplinkNotificationKind = "wallet" | "booking" | "payment";

/**
 * Idempotent smoke setup: ensure operator smoke member has inbox rows for deep-link BQC.
 * Uses Postgres insert (test fixture only — navigation + mark-read remain real-e2e).
 */
export function ensurePortalSmokeDeeplinkNotification(kind: DeeplinkNotificationKind): void {
  const databaseUrl = adminDatabaseUrl();
  if (databaseUrl.length === 0) {
    throw new Error("ensurePortalSmokeDeeplinkNotification: DATABASE_URL_ADMIN required");
  }

  const dedupeKey = `bqc-deeplink-${kind}-${OPERATOR_SMOKE.memberUserId}`;
  const entityId = randomUUID();
  const config: Record<
    DeeplinkNotificationKind,
    {
      readonly sourceModule: string;
      readonly entityType: string;
      readonly eventType: string;
      readonly title: string;
      readonly body: string;
    }
  > = {
    wallet: {
      sourceModule: "wallet",
      entityType: "wallet_event",
      eventType: "wallet.transaction.posted",
      title: "Wallet credit",
      body: "Your wallet balance was updated.",
    },
    booking: {
      sourceModule: "booking",
      entityType: "registration",
      eventType: "registration.approved",
      title: "Registration approved",
      body: "Your tour registration was approved.",
    },
    payment: {
      sourceModule: "finance",
      entityType: "payment",
      eventType: "payment.hold.scheduled",
      title: "Payment scheduled",
      body: "A payment hold was scheduled for your registration.",
    },
  };

  const row = config[kind];
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
      '${row.sourceModule}',
      '${row.eventType}',
      '${row.entityType}',
      '${entityId}'::uuid,
      '${row.title.replace(/'/g, "''")}',
      '${row.body.replace(/'/g, "''")}',
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

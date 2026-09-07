import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { OPERATOR_SMOKE } from "../../../../api/test/fixtures/operator-smoke-e2e-tenant";

function adminDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim() || "";
  return raw.split("?")[0] ?? raw;
}

type EventMatrixModule = "booking" | "finance" | "ticketing";

type MatrixRow = {
  readonly eventType: string;
  readonly sourceModule: string;
  readonly entityType: string;
  readonly title: string;
  readonly body: string;
};

const BOOKING_MATRIX: readonly MatrixRow[] = [
  {
    eventType: "registration.approved",
    sourceModule: "booking",
    entityType: "registration",
    title: "Registration approved",
    body: "Your tour registration was approved.",
  },
  {
    eventType: "registration.waitlisted",
    sourceModule: "booking",
    entityType: "registration",
    title: "Registration waitlisted",
    body: "Your registration was added to the waitlist.",
  },
  {
    eventType: "registration.cancelled",
    sourceModule: "booking",
    entityType: "registration",
    title: "Registration cancelled",
    body: "Your registration was cancelled.",
  },
  {
    eventType: "registration.rejected",
    sourceModule: "booking",
    entityType: "registration",
    title: "Registration rejected",
    body: "Your registration was not approved.",
  },
];

const FINANCE_MATRIX: readonly MatrixRow[] = [
  {
    eventType: "payment.hold.scheduled",
    sourceModule: "finance",
    entityType: "payment",
    title: "Payment scheduled",
    body: "A payment hold was scheduled for your registration.",
  },
  {
    eventType: "payment.hold.expired",
    sourceModule: "finance",
    entityType: "payment",
    title: "Payment hold expired",
    body: "Your payment hold has expired.",
  },
];

const TICKETING_MATRIX: readonly MatrixRow[] = [
  {
    eventType: "ticket.created",
    sourceModule: "ticketing",
    entityType: "ticket",
    title: "Ticket update",
    body: "Your support ticket was created.",
  },
  {
    eventType: "ticket.message.posted",
    sourceModule: "ticketing",
    entityType: "ticket",
    title: "Ticket update",
    body: "Update on ticket TKT-MATRIX-01.",
  },
  {
    eventType: "ticket.priority.changed",
    sourceModule: "ticketing",
    entityType: "ticket",
    title: "Ticket priority changed",
    body: "Priority changed on your support ticket.",
  },
  {
    eventType: "ticket.resolved",
    sourceModule: "ticketing",
    entityType: "ticket",
    title: "Ticket update",
    body: "Your support ticket was resolved.",
  },
];

const MATRIX_BY_MODULE: Readonly<Record<EventMatrixModule, readonly MatrixRow[]>> = {
  booking: BOOKING_MATRIX,
  finance: FINANCE_MATRIX,
  ticketing: TICKETING_MATRIX,
};

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function insertMatrixRow(row: MatrixRow): void {
  const databaseUrl = adminDatabaseUrl();
  if (databaseUrl.length === 0) {
    throw new Error("ensurePortalSmokeEventMatrixNotifications: DATABASE_URL_ADMIN required");
  }

  const entityId = randomUUID();
  const dedupeKey = `bqc-event-matrix-${row.sourceModule}-${row.eventType}-${OPERATOR_SMOKE.memberUserId}`;
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
      '${escapeSql(row.title)}',
      '${escapeSql(row.body)}',
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

export function getPortalSmokeEventMatrixTitles(module: EventMatrixModule): readonly string[] {
  return MATRIX_BY_MODULE[module].map((row) => row.title);
}

export function getPortalSmokeEventMatrixBodies(module: EventMatrixModule): readonly string[] {
  return MATRIX_BY_MODULE[module].map((row) => row.body);
}

/** Locale-aware inbox matchers — ticketing bodies localize under fa-IR. */
export function getPortalSmokeEventMatrixMatchers(module: EventMatrixModule): readonly string[] {
  return MATRIX_BY_MODULE[module].map((row) => {
    const ticketMatch = /^Update on ticket\s+(.+)\.?$/i.exec(row.body);
    if (ticketMatch !== null) {
      const ticketRef = ticketMatch[1]?.trim();
      if (ticketRef !== undefined && ticketRef.length > 0) {
        return ticketRef;
      }
    }
    return row.body;
  });
}

/**
 * Idempotent smoke setup: seed one inbox row per canonical event type for a module.
 */
export function ensurePortalSmokeEventMatrixNotifications(module: EventMatrixModule): readonly string[] {
  const rows = MATRIX_BY_MODULE[module];
  for (const row of rows) {
    insertMatrixRow(row);
  }
  return rows.map((row) => row.eventType);
}

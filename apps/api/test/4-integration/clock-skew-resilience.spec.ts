/**
 * 4-integration — clock skew resilience (app vs DB vs JWT verify).
 *
 * Simulates bounded clock drift (+/- 5 min) on the Node app clock and verifies:
 * - In-process TourCreated `occurredAt` uses app `Date` authority (ISO UTC).
 * - Outbox relay `occurredAt` uses persisted outbox `created_at` (DB authority).
 * - Audit/outbox rows use Postgres `now()` defaults; tour `created_at` follows app `new Date()`.
 * - RS256 JWT `exp` rejects past expiry (401) with jose `clockTolerance: 5s`.
 * - Dev bearer tokens carry `exp` + TTL (`AUTH_DEV_BEARER_TTL_SECONDS`, 5s skew).
 *
 * UTC normalization authority:
 * | Surface              | Authority                          |
 * |----------------------|------------------------------------|
 * | In-process bus       | App `new Date().toISOString()`     |
 * | Outbox relay publish | DB `outbox_events.created_at`      |
 * | Audit append         | DB `@default(now())` on insert     |
 * | Tour persist (Prisma)| App `new Date()` passed explicitly |
 * | JWT verify           | Wall/app `Date` via jose + 5s skew |
 *
 * Run (memory + JWT — no Postgres):
 *   pnpm --filter @apps/api exec node --import tsx --test --test-concurrency=1 \
 *     test/4-integration/clock-skew-resilience.spec.ts
 *
 * Run with DB clock comparison (optional):
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     pnpm --filter @apps/api exec node --import tsx --test --test-concurrency=1 \
 *     test/4-integration/clock-skew-resilience.spec.ts
 *
 * @see packages/platform-events/src/bus.ts — default occurredAt
 * @see apps/api/src/outbox/outbox-relay.ts — relay occurredAt from row.createdAt
 * @see apps/api/src/tenant-kernel/parse-jwt-bearer.ts — clockTolerance 5s
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, beforeEach, describe, it, type TestContext } from "node:test";

import type { DomainEventEnvelope } from "@app-tour/platform-events";
import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { exportSPKI, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { PrismaClient } from "@prisma/client";

import { AUDIT_ACTION_TOUR_CREATED } from "../../src/audit/audit-logger";
import { publishTourCreatedEvent } from "../../src/canonical/publish-tour-created";
import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { disconnectPrisma } from "../../src/db/prisma";
import { processOutboxRelayForTenantOnce } from "../../src/outbox/outbox-relay";
import { UNAUTHORIZED_INVALID_BEARER_TOKEN } from "../../src/tenant-kernel/auth-errors";
import { encodeDevBearerToken, tryParseDevBearerToken } from "../../src/tenant-kernel/parse-bearer";
import { tryResolveJwtBearerAsync } from "../../src/tenant-kernel/parse-jwt-bearer";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { resolveTenantContextFromRequest } from "../../src/tenant-kernel/tenant-kernel";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_DB_MESSAGE =
  "Postgres clock comparison requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

function withConnectionLimit(url: string, limit = 32): string {
  if (/connection_limit=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

/** Bounded skew — avoids flaky multi-hour drift while still proving divergence. */
const SKEW_MS = 5 * 60 * 1000;

const BASE_INSTANT_MS = Date.UTC(2026, 5, 5, 12, 0, 0);

const ENV_SNAPSHOT = {
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
  AUTH_DEV_BEARER_TTL_SECONDS: process.env.AUTH_DEV_BEARER_TTL_SECONDS,
  NODE_ENV: process.env.NODE_ENV,
};

const VALID_TOUR_BODY = {
  data: { basics: { title: "clock-skew-resilience" }, details: { summary: "ok" } },
} as const;

let jwtPublicKeyPem = "";
let jwtPrivateKey: CryptoKey;

function enableAppClock(t: TestContext, instantMs: number): void {
  t.mock.timers.enable({ apis: ["Date"], now: instantMs });
}

function restoreAppClock(t: TestContext): void {
  t.mock.timers.reset();
}

function assertIsoUtcInstant(value: string, label: string): Date {
  assert.match(
    value,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    `${label} must be ISO-8601 UTC (…Z)`
  );
  const parsed = new Date(value);
  assert.equal(Number.isNaN(parsed.getTime()), false, `${label} must parse as valid Date`);
  assert.equal(parsed.toISOString(), value, `${label} must round-trip as UTC ISO`);
  return parsed;
}

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "clock-skew-user",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-clock-skew",
  };
}

async function signJwtExpAt(expUnixSec: number, claims: Record<string, string>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.sub ?? "clock-skew-user")
    .setIssuer("tour-ops")
    .setAudience("tour-ops-api")
    .setIssuedAt(Math.floor(BASE_INSTANT_MS / 1000))
    .setExpirationTime(expUnixSec)
    .sign(jwtPrivateKey);
}

function mockAuthRequest(authorization: string): IncomingMessage {
  return { headers: { authorization } } as IncomingMessage;
}

describe("4-integration — clock skew resilience", { concurrency: false }, () => {
  before(async () => {
    const pair = await generateKeyPair("RS256");
    jwtPrivateKey = pair.privateKey;
    jwtPublicKeyPem = await exportSPKI(pair.publicKey);
  });

  afterEach(() => {
    process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
    process.env.AUTH_DEV_BEARER_TTL_SECONDS = ENV_SNAPSHOT.AUTH_DEV_BEARER_TTL_SECONDS;
    process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
    resetDomainEventBusForTests();
  });

  describe("in-process TourCreated occurredAt (memory — app clock authority)", () => {
    it("CLK-SKEW-01: app clock +5m ahead — occurredAt matches faked UTC instant", async (t) => {
      resetDomainEventBusForTests();

      const skewedMs = BASE_INSTANT_MS + SKEW_MS;
      enableAppClock(t, skewedMs);

      const tenantId = integrationTenantId();
      const tourId = randomUUID();
      const captured: DomainEventEnvelope<{ tourId: string }>[] = [];
      subscribeDomainEvent("TourCreated", (evt) => {
        captured.push(evt);
      });

      runWithTenantContext(tenantId, () => {
        publishTourCreatedEvent({ tenantId, tourId });
      });

      restoreAppClock(t);

      assert.equal(captured.length, 1);
      const evt = captured[0]!;
      const occurredAt = assertIsoUtcInstant(evt.occurredAt, "TourCreated.occurredAt");
      assert.equal(
        occurredAt.getTime(),
        skewedMs,
        "occurredAt must reflect app clock, not wall clock"
      );
      assert.equal(evt.payload.tourId, tourId);
    });

    it("CLK-SKEW-02: app clock -5m behind — occurredAt still ISO UTC from app authority", async (t) => {
      resetDomainEventBusForTests();

      const skewedMs = BASE_INSTANT_MS - SKEW_MS;
      enableAppClock(t, skewedMs);

      const tenantId = integrationTenantId();
      const tourId = randomUUID();
      const captured: DomainEventEnvelope<{ tourId: string }>[] = [];
      subscribeDomainEvent("TourCreated", (evt) => {
        captured.push(evt);
      });

      runWithTenantContext(tenantId, () => {
        publishTourCreatedEvent({ tenantId, tourId });
      });

      restoreAppClock(t);

      assert.equal(captured.length, 1);
      const occurredAt = assertIsoUtcInstant(captured[0]!.occurredAt, "TourCreated.occurredAt");
      assert.equal(occurredAt.getTime(), skewedMs);
    });

    it("CLK-SKEW-03: sequential events — occurredAt is monotonic under advancing app clock", async (t) => {
      resetDomainEventBusForTests();

      enableAppClock(t, BASE_INSTANT_MS);

      const tenantId = integrationTenantId();
      const occurredAtValues: string[] = [];
      subscribeDomainEvent("TourCreated", (evt) => {
        occurredAtValues.push(evt.occurredAt);
      });

      runWithTenantContext(tenantId, () => {
        publishTourCreatedEvent({ tenantId, tourId: randomUUID() });
      });

      t.mock.timers.setTime(BASE_INSTANT_MS + 1_500);
      runWithTenantContext(tenantId, () => {
        publishTourCreatedEvent({ tenantId, tourId: randomUUID() });
      });

      restoreAppClock(t);

      assert.equal(occurredAtValues.length, 2);
      const first = assertIsoUtcInstant(occurredAtValues[0]!, "first occurredAt");
      const second = assertIsoUtcInstant(occurredAtValues[1]!, "second occurredAt");
      assert.ok(
        second.getTime() >= first.getTime(),
        "occurredAt must not time-travel backwards when app clock advances"
      );
    });
  });

  describe("JWT exp + clockTolerance (jose verify)", () => {
    const jwtClaims = {
      sub: "clock-skew-user",
      tenant_id: "tenant-jwt-skew",
      role: "admin",
      membership_status: "ACTIVE",
      workspace_id: "ws-jwt-skew",
    };

    beforeEach(() => {
      process.env.AUTH_JWT_PUBLIC_KEY = jwtPublicKeyPem;
      process.env.AUTH_JWT_ISSUER = "tour-ops";
      process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    });

    it("CLK-SKEW-04: expired JWT beyond 5s tolerance → UNAUTHORIZED_INVALID_BEARER_TOKEN", async (t) => {
      const expUnix = Math.floor(BASE_INSTANT_MS / 1000) + 60;
      enableAppClock(t, BASE_INSTANT_MS);
      const token = await signJwtExpAt(expUnix, jwtClaims);

      t.mock.timers.setTime(BASE_INSTANT_MS + 66_000);
      await assert.rejects(
        () => tryResolveJwtBearerAsync(`Bearer ${token}`),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, UNAUTHORIZED_INVALID_BEARER_TOKEN);
          return true;
        }
      );

      restoreAppClock(t);
    });

    it("CLK-SKEW-05: JWT expired ≤5s ago still verifies (clockTolerance)", async (t) => {
      const expUnix = Math.floor(BASE_INSTANT_MS / 1000) + 60;
      enableAppClock(t, BASE_INSTANT_MS);
      const token = await signJwtExpAt(expUnix, jwtClaims);

      t.mock.timers.setTime(BASE_INSTANT_MS + 63_000);
      const ctx = await tryResolveJwtBearerAsync(`Bearer ${token}`);
      assert.equal(ctx?.tenantId, jwtClaims.tenant_id);

      restoreAppClock(t);
    });

    it("CLK-SKEW-06: TenantKernel rejects expired JWT at ingress", async (t) => {
      const tenantId = integrationTenantId();
      const expUnix = Math.floor(BASE_INSTANT_MS / 1000) + 30;
      enableAppClock(t, BASE_INSTANT_MS);
      const token = await signJwtExpAt(expUnix, {
        ...jwtClaims,
        tenant_id: tenantId,
      });

      t.mock.timers.setTime(BASE_INSTANT_MS + 120_000);

      await assert.rejects(
        () => resolveTenantContextFromRequest(mockAuthRequest(`Bearer ${token}`)),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, UNAUTHORIZED_INVALID_BEARER_TOKEN);
          return true;
        }
      );

      restoreAppClock(t);
    });
  });

  describe("dev bearer session TTL (DEC-023)", () => {
    it("CLK-SKEW-07: dev bearer rejects after exp beyond clock tolerance", async (t) => {
      process.env.NODE_ENV = "test";
      process.env.AUTH_ALLOW_DEV_BEARER = "true";
      process.env.AUTH_DEV_BEARER_TTL_SECONDS = "60";

      enableAppClock(t, BASE_INSTANT_MS);
      const tenantId = integrationTenantId();
      const authorization = encodeDevBearerToken(authForTenant(tenantId));

      t.mock.timers.setTime(BASE_INSTANT_MS + 120_000);

      assert.throws(
        () => tryParseDevBearerToken(authorization),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, UNAUTHORIZED_INVALID_BEARER_TOKEN);
          return true;
        }
      );
      restoreAppClock(t);
    });

    it("CLK-SKEW-07b: dev bearer within TTL still verifies", async (t) => {
      process.env.NODE_ENV = "test";
      process.env.AUTH_ALLOW_DEV_BEARER = "true";
      process.env.AUTH_DEV_BEARER_TTL_SECONDS = "3600";

      enableAppClock(t, BASE_INSTANT_MS);
      const tenantId = integrationTenantId();
      const authorization = encodeDevBearerToken(authForTenant(tenantId));

      t.mock.timers.setTime(BASE_INSTANT_MS + 60_000);

      const ctx = tryParseDevBearerToken(authorization);
      restoreAppClock(t);

      assert.equal(ctx.tenantId, tenantId);
    });
  });

  describe(
    "Postgres audit/outbox + relay occurredAt (DB authority when DATABASE_URL set)",
    { skip: hasDatabase ? false : SKIP_DB_MESSAGE, concurrency: false },
    () => {
      const tenantId = integrationTenantId();
      let admin: PrismaClient;
      const priorStorage = process.env.STORAGE_DRIVER;

      before(async () => {
        process.env.STORAGE_DRIVER = "prisma";
        process.env.DATABASE_URL = withConnectionLimit(
          process.env.DATABASE_URL?.trim() ?? APP_TOUR_URL
        );
        process.env.DATABASE_URL_ADMIN = ADMIN_URL;
        await disconnectPrisma();

        admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `clk-${tenantId.slice(0, 8)}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      });

      after(async () => {
        process.env.STORAGE_DRIVER = priorStorage;
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
        );
        try {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
          await admin.tenant.delete({ where: { id: tenantId } });
        } finally {
          await admin.$executeRawUnsafe(
            `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
          );
        }
        await admin.$disconnect();
        await disconnectPrisma();
      });

      async function readDbUtcNowMs(): Promise<number> {
        const rows = await admin.$queryRaw<{ now_ms: bigint }[]>`
          SELECT (EXTRACT(EPOCH FROM (now() AT TIME ZONE 'UTC')) * 1000)::bigint AS now_ms
        `;
        return Number(rows[0]?.now_ms ?? 0n);
      }

      it("CLK-SKEW-08: tour created_at follows app clock; audit/outbox follow DB now()", async (t) => {
        const skewedMs = BASE_INSTANT_MS + SKEW_MS;
        enableAppClock(t, skewedMs);

        const dbNowBeforeMs = await readDbUtcNowMs();

        let canonical;
        try {
          canonical = await runPreTransactionValidation({
            body: VALID_TOUR_BODY,
            tenantId,
            workspaceType: "starter",
          });
          await persistNewTourAtomically({ tenantId, canonical });
        } finally {
          clearPreTransactionValidationGate();
        }

        const dbNowAfterMs = await readDbUtcNowMs();
        restoreAppClock(t);

        const tour = await admin.tour.findFirst({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
        });
        const audit = await admin.auditEvent.findFirst({
          where: { tenantId, action: AUDIT_ACTION_TOUR_CREATED },
          orderBy: { createdAt: "desc" },
        });
        const outbox = await admin.outboxEvent.findFirst({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
        });

        assert.ok(tour);
        assert.ok(audit);
        assert.ok(outbox);

        assert.equal(
          tour.createdAt.getTime(),
          skewedMs,
          "tour.created_at must use app new Date() passed at persist time"
        );

        const auditMs = audit.createdAt.getTime();
        const outboxMs = outbox.createdAt.getTime();
        const dbWindowStart = dbNowBeforeMs - 5_000;
        const dbWindowEnd = dbNowAfterMs + 5_000;

        assert.ok(
          auditMs >= dbWindowStart && auditMs <= dbWindowEnd,
          `audit.created_at must track Postgres now(), not skewed app clock (audit=${auditMs}, db=[${dbWindowStart},${dbWindowEnd}])`
        );
        assert.ok(
          outboxMs >= dbWindowStart && outboxMs <= dbWindowEnd,
          `outbox.created_at must track Postgres now(), not skewed app clock (outbox=${outboxMs})`
        );

        const skewDelta = Math.abs(auditMs - skewedMs);
        assert.ok(
          skewDelta >= SKEW_MS - 5_000,
          "audit timestamp must diverge from skewed app clock by ~bounded skew (proves separate authority)"
        );
      });

      it("CLK-SKEW-09: outbox relay occurredAt equals outbox row created_at (DB ISO UTC)", async (t) => {
        resetDomainEventBusForTests();
        const skewedMs = BASE_INSTANT_MS + SKEW_MS;
        enableAppClock(t, skewedMs);

        let tourId = "";
        try {
          const canonical = await runPreTransactionValidation({
            body: {
              data: { basics: { title: "relay-skew" }, details: { summary: "relay" } },
            },
            tenantId,
            workspaceType: "starter",
          });
          const persisted = await persistNewTourAtomically({ tenantId, canonical });
          tourId = persisted.id;
        } finally {
          clearPreTransactionValidationGate();
        }

        restoreAppClock(t);
        assert.match(
          tourId,
          /^[0-9a-f-]{36}$/i,
          "persist must return tour id before relay assertions"
        );

        await admin.outboxEvent.updateMany({
          where: { tenantId, status: "pending", aggregateId: { not: tourId } },
          data: { status: "done", processedAt: new Date() },
        });

        const outboxRow = await admin.outboxEvent.findFirst({
          where: { tenantId, aggregateId: tourId, status: "pending" },
        });
        assert.ok(outboxRow, "expected pending outbox row for relay-skew tour");
        assert.ok(
          outboxRow.domainEventId?.trim(),
          "outbox row must carry domain_event_id for relay"
        );

        const relayCaptured: DomainEventEnvelope<{ tourId: string }>[] = [];
        subscribeDomainEvent("TourCreated", (evt) => {
          relayCaptured.push(evt);
        });

        const relayResult = await processOutboxRelayForTenantOnce(tenantId, 1);
        assert.equal(
          relayResult.published,
          1,
          `relay publish failed: ${JSON.stringify(relayResult)}`
        );

        assert.equal(relayCaptured.length, 1);
        const expectedOccurredAt = outboxRow.createdAt.toISOString();
        assert.equal(
          relayCaptured[0]!.occurredAt,
          expectedOccurredAt,
          "relay must publish occurredAt from DB outbox created_at, not app clock"
        );
        assertIsoUtcInstant(relayCaptured[0]!.occurredAt, "relay TourCreated.occurredAt");
        assert.notEqual(
          relayCaptured[0]!.occurredAt,
          new Date(skewedMs).toISOString(),
          "relay occurredAt must not mirror skewed app clock"
        );

        const relayPath = join(
          dirname(fileURLToPath(import.meta.url)),
          "../../src/outbox/outbox-relay.ts"
        );
        const relaySource = readFileSync(relayPath, "utf8");
        assert.match(
          relaySource,
          /occurredAt:\s*row\.createdAt\.toISOString\(\)/,
          "outbox relay must map occurredAt from persisted row timestamp"
        );
      });
    }
  );
});

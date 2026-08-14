/**
 * INT-002d — TourPublished outbox + integration dispatch (4-integration).
 *
 * Run:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev' \
 *   DATABASE_URL_ADMIN='postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev' \
 *   STORAGE_DRIVER=prisma NODE_ENV=test \
 *     node --import tsx --test test/4-integration/tour-published-outbox.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  projectDenaliWizardFormToCanonicalIngressData,
  getDenaliWorkspacePlugin,
} from "@app-tour/workspace-denali";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";
import type { PrismaClient } from "@prisma/client";

import {
  buildTourPublishedDomainEventId,
  TOUR_PUBLISHED_OUTBOX_PAYLOAD_SCHEMA_VERSION,
} from "../../src/canonical/build-tour-published-outbox-payload";
import { persistTourUpdateAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { dispatchIntegrationDomainEvent } from "../../src/integrations/application/dispatch-integration-domain-event";
import { seedDefaultEventPoliciesForConnection } from "../../src/integrations/infrastructure/prisma-integration-policy.repository";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/workspaces/denali/test/fixtures/golden",
);

function loadGoldenForm(filename: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as Record<
    string,
    unknown
  >;
  const { _templateOverlay: _ignored, ...form } = raw;
  return form;
}

function withPublishStatus(
  form: Record<string, unknown>,
  publishStatus: "draft" | "active",
): Record<string, unknown> {
  const basicInfo = form.basicInfo as Record<string, unknown>;
  return {
    ...form,
    basicInfo: {
      ...basicInfo,
      publishStatus,
    },
  };
}

function denaliValidationBody(form: Record<string, unknown>) {
  const plugin = getDenaliWorkspacePlugin();
  return {
    schemaVersion: 1,
    roots: [...plugin.wizard.roots],
    data: projectDenaliWizardFormToCanonicalIngressData(form),
  };
}

function canonicalFromForm(form: Record<string, unknown>) {
  const body = denaliValidationBody(form);
  return createCanonicalDocument({
    schemaVersion: body.schemaVersion,
    roots: body.roots,
    data: body.data,
  });
}

describe(
  "4-integration — TourPublished outbox and dispatch",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const tourId = randomUUID();
    const connectionId = randomUUID();
    const golden = loadGoldenForm("tour-publish-ready.json");
    const expectedTitle = (golden.basicInfo as { title: string }).title;
    const catalogRefAllowlists = {
      activeThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      selectableLeaderIds: [] as readonly string[],
    };
    let admin: PrismaClient;
    const previousDeliveryEnv = process.env.INTEGRATION_DELIVERY_ENABLED;
    const previousValidationWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.INTEGRATION_DELIVERY_ENABLED = "true";
      process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
      const { PrismaClient } = await import("@prisma/client");
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });

      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `tp-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });

      const draftCanonical = canonicalFromForm(withPublishStatus(golden, "draft"));
      await admin.tour.create({
        data: {
          id: tourId,
          tenantId,
          canonical: draftCanonical as object,
          title: expectedTitle,
          schemaVersion: 1,
          rowVersion: 1,
        },
      });

      await admin.integrationConnection.create({
        data: {
          id: connectionId,
          tenantId,
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: { channelId: "@test-channel" },
          credentials: {},
        },
      });

      await seedDefaultEventPoliciesForConnection({
        tenantId,
        integrationConnectionId: connectionId,
        provider: "telegram",
        workspaceType: "denali",
      });
    });

    after(async () => {
      if (previousDeliveryEnv === undefined) {
        delete process.env.INTEGRATION_DELIVERY_ENABLED;
      } else {
        process.env.INTEGRATION_DELIVERY_ENABLED = previousDeliveryEnv;
      }
      if (previousValidationWorkers === undefined) {
        delete process.env.P5_VALIDATION_WORKERS_ENABLED;
      } else {
        process.env.P5_VALIDATION_WORKERS_ENABLED = previousValidationWorkers;
      }

      await admin.integrationDeliveryJob.deleteMany({ where: { tenantId } });
      await admin.integrationEventPolicy.deleteMany({
        where: { tenantId, integrationConnectionId: connectionId },
      });
      await admin.integrationConnection.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`,
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`,
        );
      }
      await admin.$disconnect();
    });

    it("enqueues TourPublished outbox row on denali publish transition", async () => {
      const activeForm = withPublishStatus(golden, "active");
      try {
        const canonical = await runPreTransactionValidation({
          body: denaliValidationBody(activeForm),
          tenantId,
          workspaceType: "denali",
          validationMode: "publish",
          catalogRefAllowlists,
        });
        await runWithTenantContext(
          tenantId,
          async () => {
            await persistTourUpdateAtomically({
              tenantId,
              tourId,
              canonical,
              expectedRowVersion: 1,
            });
          },
          { workspaceType: "denali", actorId: "tour-published-it" },
        );
      } finally {
        clearPreTransactionValidationGate(tenantId);
      }

      const outbox = await admin.outboxEvent.findFirst({
        where: {
          tenantId,
          aggregateId: tourId,
          eventType: "TourPublished",
        },
        orderBy: { createdAt: "desc" },
      });

      assert.ok(outbox);
      assert.equal(
        outbox.domainEventId,
        buildTourPublishedDomainEventId(tourId, 2),
      );
      const payload = outbox.payload as Record<string, unknown>;
      assert.equal(payload.schemaVersion, TOUR_PUBLISHED_OUTBOX_PAYLOAD_SCHEMA_VERSION);
      assert.equal(payload.tourId, tourId);
      assert.equal(payload.publishStatus, "active");
      const snapshot = payload.deliverySnapshot as Record<string, unknown>;
      assert.equal(snapshot.title, expectedTitle);

      const tour = await admin.tour.findUniqueOrThrow({
        where: { tenantId_id: { tenantId, id: tourId } },
      });
      assert.equal(tour.publishStatus, "published");
      assert.ok(tour.publishedAt instanceof Date);
    });

    it("dispatches TourPublished into an idempotent integration delivery job", async () => {
      const outbox = await admin.outboxEvent.findFirstOrThrow({
        where: {
          tenantId,
          aggregateId: tourId,
          eventType: "TourPublished",
        },
        orderBy: { createdAt: "desc" },
      });

      const row = {
        tenantId: outbox.tenantId,
        aggregateId: outbox.aggregateId,
        aggregateType: outbox.aggregateType,
        eventType: outbox.eventType,
        domainEventId: outbox.domainEventId,
        payload: outbox.payload,
        correlationId: outbox.correlationId,
        createdAt: outbox.createdAt,
      };

      const first = await dispatchIntegrationDomainEvent(row);
      const second = await dispatchIntegrationDomainEvent(row);
      assert.equal(first, 1);
      assert.equal(second, 0, "replay of the same domainEventId must not enqueue again");

      const jobs = await admin.integrationDeliveryJob.findMany({
        where: {
          tenantId,
          domainEventId: outbox.domainEventId,
          eventType: "TourPublished",
        },
      });
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0]?.status, "pending");
      const jobPayload = jobs[0]?.payload as Record<string, unknown>;
      assert.equal(jobPayload.title, expectedTitle);
    });
  },
);

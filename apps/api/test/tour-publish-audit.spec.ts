/**
 * P5-B-N-012 — publish audit (AUD-03)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUDIT_ACTION_TOUR_PUBLISHED,
  AUDIT_ACTION_TOUR_UNPUBLISHED,
  appendTourPublishTransitionAuditEvent,
} from "../src/audit/audit-logger.ts";
import { pseudonymizeAuditActorId } from "../src/audit/audit-pseudonym.ts";
import { runWithTenantContext } from "../src/tenant/tenant-request-context.ts";
import { integrationTenantId } from "./test-helpers.ts";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("tour-publish-audit (P5-B AUD-03)", () => {
  it("AUD-03 publish transition writes TOUR_PUBLISHED with status metadata", async () => {
    const tenantId = integrationTenantId();
    const tourId = "00000000-0000-4000-8000-000000000601";
    const actorId = "publish-audit-actor";
    let captured:
      | {
          action: string;
          entityType: string;
          entityId: string;
          metadata: unknown;
          actorId: string | null;
        }
      | undefined;

    const tx = {
      auditEvent: {
        create: async (args: {
          data: {
            action: string;
            entityType: string;
            entityId: string;
            metadata: unknown;
            actorId: string | null;
          };
        }) => {
          captured = args.data;
        },
      },
    };

    await runWithTenantContext(
      tenantId,
      () =>
        appendTourPublishTransitionAuditEvent(tx as never, {
          tourId,
          transition: "published",
          fromPublishStatus: "draft",
          toPublishStatus: "active",
          createdAt: new Date("2026-06-22T14:00:00.000Z"),
        }),
      { actorId, workspaceType: "denali" }
    );

    assert.ok(captured);
    assert.equal(captured!.action, AUDIT_ACTION_TOUR_PUBLISHED);
    assert.equal(captured!.entityType, "tour");
    assert.equal(captured!.entityId, tourId);
    assert.equal(captured!.actorId, pseudonymizeAuditActorId(actorId, tenantId));
    assert.deepEqual(captured!.metadata, {
      workspaceType: "denali",
      fromPublishStatus: "draft",
      toPublishStatus: "active",
    });
  });

  it("AUD-03b unpublish transition writes TOUR_UNPUBLISHED", async () => {
    const tenantId = integrationTenantId();
    let captured: { action: string; metadata: unknown } | undefined;

    const tx = {
      auditEvent: {
        create: async (args: { data: { action: string; metadata: unknown } }) => {
          captured = args.data;
        },
      },
    };

    await runWithTenantContext(
      tenantId,
      () =>
        appendTourPublishTransitionAuditEvent(tx as never, {
          tourId: "00000000-0000-4000-8000-000000000602",
          transition: "unpublished",
          fromPublishStatus: "active",
          toPublishStatus: "draft",
        }),
      { workspaceType: "denali" }
    );

    assert.equal(captured?.action, AUDIT_ACTION_TOUR_UNPUBLISHED);
    assert.deepEqual(captured?.metadata, {
      workspaceType: "denali",
      fromPublishStatus: "active",
      toPublishStatus: "draft",
    });
  });

  it("AUD-03c atomic update path calls appendTourPublishTransitionAuditEvent", () => {
    const atomic = readFileSync(
      join(apiRoot, "src/canonical/atomic-canonical-tour-persist.ts"),
      "utf8"
    );
    assert.match(atomic, /appendTourPublishTransitionAuditEvent/);
    assert.match(atomic, /detectTourPublishTransition/);
  });
});

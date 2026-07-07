/**
 * P5-B-N-011 — PATCH audit (AUD-02)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUDIT_ACTION_TOUR_UPDATED,
  appendTourUpdatedAuditEvent,
} from "../src/audit/audit-logger.ts";
import { pseudonymizeAuditActorId } from "../src/audit/audit-pseudonym.ts";
import { runWithTenantContext } from "../src/tenant/tenant-request-context.ts";
import { integrationTenantId } from "./test-helpers.ts";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("tour-patch-audit (P5-B AUD-02)", () => {
  it("AUD-02 appendTourUpdatedAuditEvent writes TOUR_UPDATED audit row", async () => {
    const tenantId = integrationTenantId();
    const tourId = "00000000-0000-4000-8000-000000000501";
    const actorId = "patch-audit-actor";
    let captured:
      | {
          tenantId: string;
          actorId: string | null;
          action: string;
          entityType: string;
          entityId: string;
          metadata: unknown;
        }
      | undefined;

    const tx = {
      auditEvent: {
        create: async (args: {
          data: {
            tenantId: string;
            actorId: string | null;
            action: string;
            entityType: string;
            entityId: string;
            metadata: unknown;
          };
        }) => {
          captured = args.data;
        },
      },
    };

    await runWithTenantContext(
      tenantId,
      () =>
        appendTourUpdatedAuditEvent(tx as never, {
          tourId,
          createdAt: new Date("2026-06-22T12:00:00.000Z"),
        }),
      { actorId, workspaceType: "denali" }
    );

    assert.ok(captured);
    assert.equal(captured!.tenantId, tenantId);
    assert.equal(captured!.action, AUDIT_ACTION_TOUR_UPDATED);
    assert.equal(captured!.entityType, "tour");
    assert.equal(captured!.entityId, tourId);
    assert.equal(captured!.actorId, pseudonymizeAuditActorId(actorId, tenantId));
    assert.deepEqual(captured!.metadata, { workspaceType: "denali" });
  });

  it("AUD-02b atomic PATCH path routes through appendTourUpdatedAuditEvent", () => {
    const atomic = readFileSync(
      join(apiRoot, "src/canonical/atomic-canonical-tour-persist.ts"),
      "utf8"
    );
    const service = readFileSync(join(apiRoot, "src/canonical/canonical-tour.service.ts"), "utf8");

    assert.match(atomic, /appendTourUpdatedAuditEvent/);
    assert.match(service, /persistTourUpdateAtomically/);
  });

  it("AUD-02c guard:tour-update-audit locks PATCH audit helper", () => {
    const guard = readFileSync(
      join(apiRoot, "scripts/guard-tour-update-audit.mjs"),
      "utf8"
    );
    const auditLogger = readFileSync(join(apiRoot, "src/audit/audit-logger.ts"), "utf8");

    assert.match(auditLogger, /appendTourUpdatedAuditEvent/);
    assert.match(guard, /appendTourUpdatedAuditEvent/);
  });
});

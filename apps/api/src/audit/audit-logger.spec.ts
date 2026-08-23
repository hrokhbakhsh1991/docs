import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { buildAuditMetadata, appendAuditEvent } from "./audit-logger";
import { pseudonymizeAuditActorId } from "./audit-pseudonym";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";

describe("audit logger privacy (LOG-COL-03)", () => {
  it("buildAuditMetadata allowlists workspaceType only", async () => {
    await runWithTenantContext(integrationTenantId(), async () => {
      const metadata = buildAuditMetadata({
        action: "TOUR_CREATED",
        entityType: "tour",
        entityId: "00000000-0000-4000-8000-000000000001",
        metadata: {
          workspaceType: "ignored-from-input",
          email: "user@example.com",
          title: "secret",
        },
      });
      assert.deepEqual(metadata, { workspaceType: "unknown" });
    });
  });

  it("uses active workspace type when the tenant context supplies one", async () => {
    await runWithTenantContext(
      integrationTenantId(),
      async () => {
        const metadata = buildAuditMetadata({
          action: "TOUR_CREATED",
          entityType: "tour",
          entityId: "00000000-0000-4000-8000-000000000001",
          metadata: { workspaceType: "ignored-from-input" },
        });
        assert.deepEqual(metadata, { workspaceType: "denali" });
      },
      { workspaceType: "denali" }
    );
  });

  it("does not invent starter workspace metadata", () => {
    const source = readFileSync(join(import.meta.dirname, "audit-logger.ts"), "utf8");
    assert.doesNotMatch(source, /getActiveWorkspaceType\(\)\s*\?\?\s*["']starter["']/);
    assert.match(source, /getActiveWorkspaceType\(\)\s*\?\?\s*["']unknown["']/);
  });

  it("pseudonymizeAuditActorId is stable and tenant-scoped", () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const actor = "audit-user-1";

    const hashA1 = pseudonymizeAuditActorId(actor, tenantA);
    const hashA2 = pseudonymizeAuditActorId(actor, tenantA);
    const hashB = pseudonymizeAuditActorId(actor, tenantB);

    assert.equal(hashA1, hashA2);
    assert.notEqual(hashA1, actor);
    assert.notEqual(hashA1, hashB);
    assert.match(hashA1, /^[a-f0-9]{64}$/);
  });

  it("appendAuditEvent stores pseudonymized actor_id", async () => {
    const tenantId = integrationTenantId();
    const actorId = "audit-spec-actor";
    let captured: { actorId: string | null; metadata: unknown } | undefined;

    const tx = {
      auditEvent: {
        create: async (args: { data: { actorId: string | null; metadata: unknown } }) => {
          captured = args.data;
        },
      },
    };

    await runWithTenantContext(
      tenantId,
      () =>
        appendAuditEvent(tx as never, {
          action: "TOUR_CREATED",
          entityType: "tour",
          entityId: "00000000-0000-4000-8000-000000000002",
          metadata: { pii: "dropped" },
        }),
      { actorId, workspaceType: "starter" }
    );

    assert.ok(captured);
    assert.equal(captured!.actorId, pseudonymizeAuditActorId(actorId, tenantId));
    assert.deepEqual(captured!.metadata, { workspaceType: "starter" });
  });
});

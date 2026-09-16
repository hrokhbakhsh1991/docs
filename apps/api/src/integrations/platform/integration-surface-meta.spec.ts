import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWorkspaceIntegrationSurfaceMeta } from "./integration-surface-meta";

describe("integration surface meta", () => {
  it("exposes Denali provider fields without secret values", async () => {
    const meta = await buildWorkspaceIntegrationSurfaceMeta("denali");
    const telegram = meta.providers.find((provider) => provider.id === "telegram");

    assert.ok(telegram);
    assert.deepEqual(telegram.configFields, [
      { id: "groupName", kind: "string", requiredOnCreate: false },
      { id: "channelId", kind: "string", requiredOnCreate: false },
    ]);
    assert.deepEqual(telegram.credentialFields, [
      { id: "botToken", kind: "secret", requiredOnCreate: true },
    ]);
    assert.deepEqual(telegram.defaultCapabilities, ["message.send"]);
    assert.deepEqual(telegram.defaultEventPolicies, [
      { eventType: "TourPublished", enabled: true },
      { eventType: "member.registered", enabled: true },
      { eventType: "registration.created", enabled: true },
      { eventType: "registration.approved", enabled: true },
      { eventType: "receipt.submitted", enabled: true },
      { eventType: "receipt.approved", enabled: true },
      { eventType: "receipt.rejected", enabled: true },
      { eventType: "ticket.created", enabled: true },
      { eventType: "ticket.message.posted", enabled: true },
      { eventType: "ticket.internal_note.created", enabled: true },
      { eventType: "ticket.status.changed", enabled: true },
      { eventType: "ticket.resolved", enabled: true },
      { eventType: "ticket.reopened", enabled: true },
      { eventType: "ticket.assigned", enabled: true },
      { eventType: "ticket.priority.changed", enabled: true },
      { eventType: "ticket.closed", enabled: true },
    ]);

    const catalogIds = meta.exposureCandidateFields.map((field) => field.id);
    assert.ok(catalogIds.includes("title"));
    assert.ok(catalogIds.includes("denali.destination"));
    assert.ok(meta.exposureCandidateFields.length > 1);
    assert.equal(
      (meta as Record<string, unknown>).deliveryCandidateFields,
      undefined,
      "Phase 7g: legacy delivery alias must not be emitted"
    );
  });

  it("returns no providers for workspaces without an integration surface", async () => {
    assert.deepEqual(await buildWorkspaceIntegrationSurfaceMeta("starter"), {
      workspaceType: "starter",
      providers: [],
      exposureCandidateFields: [],
    });
  });
});

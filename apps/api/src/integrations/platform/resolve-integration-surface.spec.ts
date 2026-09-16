import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultIntegrationEventTypesForProvider,
  isDefaultIntegrationEventEnabled,
  resolveIntegrationSurfaceForWorkspaceType,
} from "./resolve-integration-surface";

const DENALI_TELEGRAM_EVENT_TYPES = [
  "TourPublished",
  "member.registered",
  "registration.created",
  "registration.approved",
  "receipt.submitted",
  "receipt.approved",
  "receipt.rejected",
  "ticket.created",
  "ticket.message.posted",
  "ticket.internal_note.created",
  "ticket.status.changed",
  "ticket.resolved",
  "ticket.reopened",
  "ticket.assigned",
  "ticket.priority.changed",
  "ticket.closed",
];

describe("resolve integration surface", () => {
  it("resolves Denali telegram provider surface", async () => {
    const surface = await resolveIntegrationSurfaceForWorkspaceType("denali");
    assert.ok(surface !== null);
    assert.equal(surface.manifestVersion, 1);
    const telegram = surface.providers.find((provider) => provider.id === "telegram");
    assert.ok(telegram !== undefined);
    assert.deepEqual(telegram.defaultCapabilities, ["message.send"]);
    assert.equal(
      await isDefaultIntegrationEventEnabled({
        workspaceType: "denali",
        providerId: "telegram",
        eventType: "TourPublished",
      }),
      true
    );
    assert.deepEqual(
      await defaultIntegrationEventTypesForProvider({
        workspaceType: "denali",
        providerId: "telegram",
      }),
      DENALI_TELEGRAM_EVENT_TYPES
    );
  });

  it("returns null for workspaces without integration surface", async () => {
    assert.equal(await resolveIntegrationSurfaceForWorkspaceType("starter"), null);
    assert.equal(await resolveIntegrationSurfaceForWorkspaceType(null), null);
  });
});

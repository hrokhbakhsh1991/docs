import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listActiveIntegrationEventTypes,
  mapEffectiveCatalogToPublicEventPolicies,
  resolveEffectiveIntegrationEventCatalog,
} from "./resolve-effective-integration-event-catalog";

describe("resolveEffectiveIntegrationEventCatalog", () => {
  it("defaults denali telegram to TourPublished from surface when no persisted rows", () => {
    const catalog = resolveEffectiveIntegrationEventCatalog({
      workspaceType: "denali",
      providerId: "telegram",
      persistedPolicies: [],
    });

    assert.deepEqual(
      catalog.map((entry) => entry.eventType),
      ["TourPublished"],
    );
    assert.equal(catalog[0]?.enabled, true);
    assert.equal(catalog[0]?.declaredOnSurface, true);
    assert.equal(catalog[0]?.routingActive, true);
    assert.equal(catalog[0]?.deprecated, false);
  });

  it("marks persisted TourCreated as deprecated with supersededBy TourPublished", () => {
    const catalog = resolveEffectiveIntegrationEventCatalog({
      workspaceType: "denali",
      providerId: "telegram",
      persistedPolicies: [{ eventType: "TourCreated", enabled: true }],
    });

    const created = catalog.find((entry) => entry.eventType === "TourCreated");
    const published = catalog.find((entry) => entry.eventType === "TourPublished");

    assert.ok(created);
    assert.equal(created.deprecated, true);
    assert.equal(created.supersededBy, "TourPublished");
    assert.equal(created.routingActive, false);
    assert.ok(published);
    assert.equal(published.deprecated, false);
    assert.equal(published.routingActive, true);
  });

  it("prefers persisted enablement over surface default", () => {
    const catalog = resolveEffectiveIntegrationEventCatalog({
      workspaceType: "denali",
      providerId: "telegram",
      persistedPolicies: [{ eventType: "TourPublished", enabled: false }],
    });

    assert.equal(catalog[0]?.eventType, "TourPublished");
    assert.equal(catalog[0]?.enabled, false);
  });

  it("maps public DTO policies with deprecated metadata", () => {
    const catalog = resolveEffectiveIntegrationEventCatalog({
      workspaceType: "denali",
      providerId: "telegram",
      persistedPolicies: [{ eventType: "TourCreated", enabled: true }],
    });

    const policies = mapEffectiveCatalogToPublicEventPolicies(catalog);
    assert.deepEqual(policies.find((p) => p.eventType === "TourCreated"), {
      eventType: "TourCreated",
      enabled: true,
      deprecated: true,
      supersededBy: "TourPublished",
    });
  });

  it("lists active event types for admin UI without deprecated routes", () => {
    const catalog = resolveEffectiveIntegrationEventCatalog({
      workspaceType: "denali",
      providerId: "telegram",
      persistedPolicies: [{ eventType: "TourCreated", enabled: true }],
    });

    assert.deepEqual(listActiveIntegrationEventTypes(catalog), ["TourPublished"]);
  });
});

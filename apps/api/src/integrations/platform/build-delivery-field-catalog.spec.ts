import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDeliveryFieldCatalog,
  buildDeliverySelectableFieldCatalog,
  getDefaultDeliveryFields,
  resolveRequestedDeliveryFieldIds,
} from "./build-delivery-field-catalog";
import { buildWorkspaceIntegrationSurfaceMeta } from "./integration-surface-meta";

describe("build-delivery-field-catalog", () => {
  it("lists Denali registry fields independent of fieldPolicy deliveryCandidateFieldIds", async () => {
    const catalog = await buildDeliveryFieldCatalog("denali");
    const catalogIds = catalog.map((field) => field.id);

    assert.ok(catalog.length > 1, "catalog must include more than the legacy title-only allowlist");
    assert.ok(catalogIds.includes("title"));
    assert.ok(catalogIds.includes("denali.destination"));

    const title = catalog.find((field) => field.id === "title");
    assert.equal(title?.canonicalPath, "title");
    assert.equal(title?.kind, "text");

    const destination = catalog.find((field) => field.id === "denali.destination");
    assert.equal(destination?.canonicalPath, "destinationId");
    assert.ok(destination?.tags?.includes("destination"));
  });

  it("returns an empty catalog for unknown workspace types", async () => {
    assert.deepEqual(await buildDeliveryFieldCatalog("unknown-workspace-type"), []);
    assert.deepEqual(await buildDeliveryFieldCatalog(null), []);
  });

  it("rejects unknown field ids against the registry catalog", async () => {
    const catalogIds = new Set(
      (await buildDeliveryFieldCatalog("denali")).map((field) => field.id)
    );
    assert.equal(catalogIds.has("title"), true);
    assert.equal(catalogIds.has("not-a-real-field"), false);
  });

  it("integration surface meta exposes exposure-owned deliverable registry fields for Denali", async () => {
    const meta = await buildWorkspaceIntegrationSurfaceMeta("denali");
    const metaIds = meta.exposureCandidateFields.map((field) => field.id);
    const selectableIds = (await buildDeliverySelectableFieldCatalog("denali")).map(
      (field) => field.id
    );
    const catalog = await buildDeliveryFieldCatalog("denali");

    assert.deepEqual(metaIds, selectableIds);
    assert.ok(metaIds.includes("title"));
    assert.ok(metaIds.includes("denali.destination"));
    assert.ok(metaIds.includes("denali.datetime"));
    assert.ok(meta.exposureCandidateFields.length >= 10);
    assert.ok(catalog.length > meta.exposureCandidateFields.length);
  });

  it("getDefaultDeliveryFields returns profile-routed migration defaults", async () => {
    const defaults = await getDefaultDeliveryFields("denali");
    const selectableIds = (await buildDeliverySelectableFieldCatalog("denali")).map(
      (field) => field.id
    );
    assert.ok(defaults.includes("title"));
    assert.ok(defaults.includes("denali.destination"));
    assert.deepEqual(defaults, selectableIds);
    assert.deepEqual(await getDefaultDeliveryFields("starter"), [
      "basics.title",
      "details.summary",
    ]);
    assert.deepEqual(await getDefaultDeliveryFields("unknown-workspace"), []);
  });

  it("includes registry presentation metadata for admin UI", async () => {
    const catalog = await buildDeliverySelectableFieldCatalog("denali");
    const denaliTitle = catalog.find((field) => field.id === "title");
    assert.equal(denaliTitle?.adminLabel, "Tour Title");
    assert.equal(denaliTitle?.group, "General");

    const destination = catalog.find((field) => field.id === "denali.destination");
    assert.equal(destination?.adminLabel, "Tour Destination");
    assert.equal(destination?.group, "Location");

    const startDate = catalog.find((field) => field.id === "denali.datetime");
    assert.equal(startDate?.adminLabel, "Start Date");
    assert.equal(startDate?.group, "Schedule");
  });

  it("resolveRequestedDeliveryFieldIds prefers admin selection over defaults", async () => {
    assert.deepEqual(await resolveRequestedDeliveryFieldIds(["denali.destination"], "denali"), [
      "denali.destination",
    ]);
    assert.deepEqual(
      await resolveRequestedDeliveryFieldIds(null, "denali"),
      await getDefaultDeliveryFields("denali")
    );
  });
});

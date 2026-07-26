import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDeliveryFieldPolicyEntityState,
  resolveDeliveryFieldDefinitions,
} from "./delivery-field-definitions";
import { exposureCatalogFieldIds } from "../../exposure/exposure-field-catalog";

describe("buildDeliveryFieldPolicyEntityState", () => {
  it("falls back to lifecycle initialStatus on TourCreated when payload has no status", async () => {
    assert.deepEqual(
      buildDeliveryFieldPolicyEntityState({
        payload: { tenantId: "tenant-a", tourId: "tour-1" },
        eventType: "TourCreated",
        lifecycle: { initialStatus: "DRAFT" },
      }),
      { tour: { status: "DRAFT" } },
    );
  });

  it("prefers explicit payload status over lifecycle fallback", async () => {
    assert.deepEqual(
      buildDeliveryFieldPolicyEntityState({
        payload: { status: "OPEN" },
        eventType: "TourCreated",
        lifecycle: { initialStatus: "DRAFT" },
      }),
      { tour: { status: "OPEN" } },
    );
  });
});

describe("resolveDeliveryFieldDefinitions", () => {
  it("adapts definitions from the full exposure catalog without legacy eligibility", async () => {
    const catalogIds = await exposureCatalogFieldIds("starter");
    assert.ok(catalogIds.length > 2);

    const definitions = await resolveDeliveryFieldDefinitions({
      tenantId: "tenant-a",
      workspaceType: "starter",
      eventType: "TourCreated",
      payload: { tenantId: "tenant-a", tourId: "tour-1" },
    });

    assert.ok(definitions !== null);
    assert.ok((definitions?.length ?? 0) > 0);
    assert.ok(definitions?.some((definition) => definition.id === "basics.title"));
  });

  it("returns null for unbound workspace types", async () => {
    assert.equal(
      await resolveDeliveryFieldDefinitions({
        tenantId: "tenant-a",
        workspaceType: "unknown-workspace",
        eventType: "TourCreated",
        payload: { tenantId: "tenant-a", tourId: "tour-1" },
      }),
      null,
    );
  });
});

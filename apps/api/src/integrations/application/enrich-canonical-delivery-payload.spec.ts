import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptWorkspaceFieldPolicyManifest } from "@app-tour/platform-core";
import { starterWorkspacePlugin } from "@app-tour/workspace-sdk";

import { enrichCanonicalDeliveryPayload } from "./enrich-canonical-delivery-payload";

const STARTER_DEFINITIONS = adaptWorkspaceFieldPolicyManifest({
  workspaceType: "starter",
  manifest: starterWorkspacePlugin.fieldPolicy!,
  fieldRegistry: starterWorkspacePlugin.fieldRegistry,
}).definitions;

describe("enrichCanonicalDeliveryPayload", () => {
  it("extracts eligible field values from canonical payload paths", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: {
        basics: { title: "Alpine Day" },
        details: { summary: "A guided hike" },
      },
      eligibleFieldIds: ["basics.title", "details.summary"],
      definitions: STARTER_DEFINITIONS,
    });

    assert.deepEqual(enriched.fieldValues, {
      "basics.title": "Alpine Day",
      "details.summary": "A guided hike",
    });
  });

  it("omits missing values safely without throwing", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: { tenantId: "tenant-a", tourId: "tour-1" },
      eligibleFieldIds: ["basics.title", "details.summary"],
      definitions: STARTER_DEFINITIONS,
    });

    assert.deepEqual(enriched.fieldValues, {});
  });

  it("resolves reference ids to companion display paths (destinationId → destination.name)", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: {
        destinationId: "dest-1",
        destination: { name: "Swiss Alps" },
      },
      eligibleFieldIds: ["denali.destination"],
      definitions: [
        {
          id: "denali.destination",
          workspaceType: "denali",
          canonicalPath: "destinationId",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(enriched.fieldValues, {
      "denali.destination": "Swiss Alps",
    });
  });

  it("falls back to raw id when companion display path is absent", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: { destinationId: "dest-1" },
      eligibleFieldIds: ["denali.destination"],
      definitions: [
        {
          id: "denali.destination",
          workspaceType: "denali",
          canonicalPath: "destinationId",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(enriched.fieldValues, {
      "denali.destination": "dest-1",
    });
  });

  it("prefers catalog reference display values over raw ids", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: { destinationId: "dest-1" },
      eligibleFieldIds: ["denali.destination"],
      definitions: [
        {
          id: "denali.destination",
          workspaceType: "denali",
          canonicalPath: "destinationId",
          kind: "text",
          version: 1,
        },
      ],
      referenceDisplayValues: {
        destinationId: "Damavand",
      },
    });

    assert.deepEqual(enriched.fieldValues, {
      "denali.destination": "Damavand",
    });
  });

  it("formats date-kind fields to fa-IR delivery strings instead of raw ISO", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: { startDateTime: "2026-06-30T22:30:00.000Z" },
      eligibleFieldIds: ["denali.datetime"],
      definitions: [
        {
          id: "denali.datetime",
          workspaceType: "denali",
          canonicalPath: "startDateTime",
          kind: "date",
          version: 1,
        },
      ],
    });

    const formatted = enriched.fieldValues["denali.datetime"];
    assert.equal(typeof formatted, "string");
    assert.notEqual(formatted, "2026-06-30T22:30:00.000Z");
    assert.match(formatted!, /۱۴۰۵|1405/);
  });

  it("renders locationData objects using label, falling back to address", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: {
        labelled: { label: "Camp 1", address: "Trailhead" },
        addressOnly: { address: "Northern gate" },
      },
      eligibleFieldIds: ["labelled", "addressOnly"],
      definitions: [
        { id: "labelled", workspaceType: "denali", canonicalPath: "labelled", kind: "text", version: 1 },
        { id: "addressOnly", workspaceType: "denali", canonicalPath: "addressOnly", kind: "text", version: 1 },
      ],
    });

    assert.deepEqual(enriched.fieldValues, {
      labelled: "Camp 1",
      addressOnly: "Northern gate",
    });
  });

  it("aggregates Denali location zones into a single comma-joined value", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: {
        startPoint: { label: "Tehran" },
        summitPoint: { label: "Damavand summit" },
        campPoint: { address: "Bargah-e Sevom" },
        endPoint: {},
      },
      eligibleFieldIds: ["denali.location-zones"],
      definitions: [
        {
          id: "denali.location-zones",
          workspaceType: "denali",
          canonicalPath: "startPoint",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(enriched.fieldValues, {
      "denali.location-zones": "Tehran، Damavand summit، Bargah-e Sevom",
    });
  });

  it("falls back to tripDetails.overview zones after form-profile ghost strip", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: {
        startPoint: { label: "Asklim trailhead" },
        tripDetails: {
          overview: {
            campPoint: { label: "کمپ آبشار اسکلیم", latitude: 36.1, longitude: 51.2 },
            summitPoint: { address: "نقطه اوج مسیر" },
            endPoint: { label: "پایان مسیر" },
          },
        },
      },
      eligibleFieldIds: ["denali.location-zones"],
      definitions: [
        {
          id: "denali.location-zones",
          workspaceType: "denali",
          canonicalPath: "startPoint",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(enriched.fieldValues, {
      "denali.location-zones": "Asklim trailhead، نقطه اوج مسیر، کمپ آبشار اسکلیم، پایان مسیر",
    });
  });

  it("omits the location-zones field when no zone is populated", () => {
    const enriched = enrichCanonicalDeliveryPayload({
      payload: { startPoint: {}, endPoint: { label: "   " } },
      eligibleFieldIds: ["denali.location-zones"],
      definitions: [
        {
          id: "denali.location-zones",
          workspaceType: "denali",
          canonicalPath: "startPoint",
          kind: "text",
          version: 1,
        },
      ],
    });

    assert.deepEqual(enriched.fieldValues, {});
  });
});

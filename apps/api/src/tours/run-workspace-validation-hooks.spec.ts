import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import {
  createNoopWorkspaceValidationHooks,
  createStarterWorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { runWorkspaceValidationHooks } from "./run-workspace-validation-hooks.js";

function starterPlugin(): WorkspacePlugin {
  return createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
}

function pluginWithHooks(
  hooks: ReturnType<typeof createNoopWorkspaceValidationHooks>,
  extraFields: WorkspacePlugin["fieldRegistry"]["fields"] = []
): WorkspacePlugin {
  const base = starterPlugin();
  return {
    ...base,
    fieldRegistry: {
      version: 1,
      fields: [...base.fieldRegistry.fields, ...extraFields],
    },
    validation: hooks,
  };
}

describe("runWorkspaceValidationHooks", () => {
  it("keeps the API validation hook boundary workspace-generic", () => {
    const source = readFileSync(new URL("./run-workspace-validation-hooks.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.equal(source.includes("Denali-specific rules live"), false);
  });

  it("returns null for starter noop hooks (no capacity/tripDetails fields)", () => {
    const plugin = starterPlugin();
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "Tour" }, details: { summary: "ok" } },
    });
    assert.equal(runWorkspaceValidationHooks(plugin, document), null);
  });

  it("invokes checkCapacity when registry exposes a capacity number field", () => {
    let seen = -1;
    const plugin = pluginWithHooks(
      {
        checkCapacity: (capacity) => {
          seen = capacity;
          return capacity > 10 ? { code: "CAPACITY_EXCEEDED", message: "too many seats" } : null;
        },
        checkTripDetails: () => null,
      },
      [
        {
          id: "basics.capacity",
          canonicalPath: "basics.capacity",
          stepId: "basics",
          kind: "number",
          required: false,
          tags: ["capacity"],
        },
      ]
    );
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "Tour", capacity: 99 }, details: { summary: "ok" } },
    });
    const violation = runWorkspaceValidationHooks(plugin, document);
    assert.equal(seen, 99);
    assert.equal(violation?.code, "CAPACITY_EXCEEDED");
  });

  it("invokes checkTripDetails for composite tripDetails registry fields", () => {
    let seenTrip: unknown;
    const plugin = pluginWithHooks(
      {
        checkCapacity: () => null,
        checkTripDetails: (tripDetails) => {
          seenTrip = tripDetails;
          return { code: "TRIP_INVALID", message: "bad trip" };
        },
      },
      [
        {
          id: "details.tripDetails",
          canonicalPath: "details.tripDetails",
          stepId: "details",
          kind: "composite",
          required: false,
        },
      ]
    );
    const tripPayload = { mode: "hike" };
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "Tour" },
        details: { summary: "ok", tripDetails: tripPayload },
      },
    });
    const violation = runWorkspaceValidationHooks(plugin, document);
    assert.deepEqual(seenTrip, tripPayload);
    assert.equal(violation?.code, "TRIP_INVALID");
  });

  it("invokes checkTripDetails for top-level tripDetails root without registry field (urban strip)", () => {
    let seenTrip: unknown;
    const plugin = pluginWithHooks({
      checkCapacity: () => null,
      checkTripDetails: (tripDetails) => {
        seenTrip = tripDetails;
        return { code: "URBAN_FORBIDDEN_ITINERARY", message: "inactive" };
      },
    });
    const tripPayload = { inactive: true };
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["tour", "tripDetails"],
      data: {
        tour: {
          title: "Urban",
          city: "X",
          venueName: "Y",
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          capacity: 1,
          status: "draft",
        },
        tripDetails: tripPayload,
      },
    });
    const violation = runWorkspaceValidationHooks(plugin, document);
    assert.deepEqual(seenTrip, tripPayload);
    assert.equal(violation?.code, "URBAN_FORBIDDEN_ITINERARY");
  });
});

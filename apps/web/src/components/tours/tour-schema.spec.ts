import assert from "node:assert/strict";
import test from "node:test";

import { createTourSchemaForProfile } from "./tour-schema";

function activeGeoForm(denaliTourKind: string) {
  return {
    title: "Test Tour",
    description: "",
    totalCapacity: 10,
    price: 0,
    status: "active" as const,
    destinationId: null,
    locationSection: {
      regionId: "",
      mainDestinationId: "",
    },
    tripDetails: {
      overview: { denaliTourKind },
      logistics: { gatheringPoints: [] },
    },
  };
}

function geoIssuePaths(result: ReturnType<ReturnType<typeof createTourSchemaForProfile>["safeParse"]>) {
  if (result.success) {
    return [];
  }
  return result.error.issues
    .map((issue) => issue.path.join("."))
    .filter(
      (path) =>
        path.includes("gatheringPoints") ||
        path.includes("overview.startPoint"),
    );
}

test("createTourSchemaForProfile: active outdoor tour requires publish geo zones", () => {
  const schema = createTourSchemaForProfile("denali_pilot");
  const result = schema.safeParse(activeGeoForm("mountain_day"));
  assert.equal(result.success, false);
  const geoPaths = geoIssuePaths(result);
  assert.ok(geoPaths.some((path) => path.includes("gatheringPoints")));
  assert.ok(geoPaths.some((path) => path.includes("overview.startPoint")));
});

test("createTourSchemaForProfile: active event tour skips publish geo zones", () => {
  const schema = createTourSchemaForProfile("denali_pilot");
  for (const denaliTourKind of ["event_reading", "event_cinema"] as const) {
    const result = schema.safeParse(activeGeoForm(denaliTourKind));
    assert.equal(geoIssuePaths(result).length, 0, denaliTourKind);
  }
});

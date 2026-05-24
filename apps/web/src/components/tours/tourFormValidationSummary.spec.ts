import assert from "node:assert/strict";
import test from "node:test";

import {
  collectTourFormValidationIssues,
  labelTourFormErrorPath,
} from "./tourFormValidationSummary";

const ctx = {
  tNew: (key: string) => `new:${key}`,
  tDenali: (key: string) => `denali:${key}`,
  tForm: (key: string, values?: Record<string, string | number>) => {
    if (key === "gatheringPointIndex" && values?.index != null) {
      return `station-${values.index}`;
    }
    return `form:${key}`;
  },
};

test("collectTourFormValidationIssues flattens nested tripDetails errors with labels", () => {
  const issues = collectTourFormValidationIssues(
    {
      title: { message: "Title too short", type: "min" },
      tripDetails: {
        logistics: {
          gatheringPoints: { message: "At least one station required", type: "custom" },
        },
        overview: {
          startPoint: {
            addressText: { message: "Address required", type: "custom" },
          },
        },
      },
    } as never,
    ctx,
  );

  assert.equal(issues.length, 3);
  assert.equal(issues[0]!.label, "new:fieldTitle");
  assert.equal(issues[1]!.label, "form:gatheringPoints");
  assert.equal(issues[1]!.message, "At least one station required");
  assert.equal(issues[2]!.label, "denali:basic.locationZones.startPoint");
});

test("labelTourFormErrorPath maps gathering point index paths", () => {
  assert.equal(
    labelTourFormErrorPath("tripDetails.logistics.gatheringPoints.0", ctx),
    "station-1",
  );
});

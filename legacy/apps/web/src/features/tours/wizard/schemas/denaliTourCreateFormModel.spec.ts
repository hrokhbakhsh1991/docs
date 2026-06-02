import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "./denaliCore.schema";
import { mergeDenaliFormDefaults } from "./denaliTourCreateFormModel";

test("mergeDenaliFormDefaults deep-merges tripDetails.overview and metrics", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const templateBaseline = {
    ...defaults,
    tripDetails: {
      ...defaults.tripDetails,
      overview: {
        ...defaults.tripDetails.overview,
        peakHeight: 5610,
        customServiceLabels: ["guide"],
      },
      metrics: {
        ...defaults.tripDetails.metrics,
        elevationGain: 1200,
      },
    },
  };

  const merged = mergeDenaliFormDefaults(templateBaseline, {
    tripDetails: {
      overview: {
        peakHeight: 4000,
      },
      metrics: {
        elevationGain: 800,
      },
    },
  });

  assert.equal(merged.tripDetails.overview?.peakHeight, 4000);
  assert.deepEqual(merged.tripDetails.overview?.customServiceLabels, ["guide"]);
  assert.equal(merged.tripDetails.metrics?.elevationGain, 800);
});

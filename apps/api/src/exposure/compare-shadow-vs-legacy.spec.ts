import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExposureDecision } from "@app-tour/platform-core";

import { compareShadowVsLegacy } from "./compare-shadow-vs-legacy";

function decision(state: ExposureDecision["state"]): ExposureDecision {
  return {
    state,
    reasonChain: [],
    appliedPolicies: [],
  };
}

describe("compareShadowVsLegacy", () => {
  it("reports FIELD_MISSING when shadow exposes a field legacy did not select", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: [],
      legacyCandidateFieldIds: [],
      shadowDecisionMap: new Map([["title", decision("visible")]]),
    });

    assert.equal(report.matches, false);
    assert.equal(report.fieldReports[0]?.mismatch, "FIELD_MISSING");
  });

  it("reports FIELD_EXTRA when legacy eligible but shadow is hidden", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecisionMap: new Map([["title", decision("hidden")]]),
    });

    assert.equal(report.fieldReports[0]?.mismatch, "FIELD_EXTRA");
  });

  it("reports STATE_MISMATCH when legacy eligible but shadow is redacted", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecisionMap: new Map([["title", decision("redacted")]]),
    });

    assert.equal(report.fieldReports[0]?.mismatch, "STATE_MISMATCH");
  });

  it("reports no mismatch when legacy eligible and shadow is visible", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecisionMap: new Map([["title", decision("visible")]]),
    });

    assert.equal(report.matches, true);
    assert.equal(report.fieldReports[0]?.mismatch, null);
  });

  it("reports STATE_MISMATCH when legacy eligible but shadow is summary_only", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecisionMap: new Map([["title", decision("summary_only")]]),
    });

    assert.equal(report.fieldReports[0]?.mismatch, "STATE_MISMATCH");
  });

  it("reports FIELD_EXTRA when legacy eligible but shadow is blocked", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecisionMap: new Map([["title", decision("blocked")]]),
    });

    assert.equal(report.fieldReports[0]?.mismatch, "FIELD_EXTRA");
  });

  it("sorts field reports deterministically regardless of map insertion order", () => {
    const first = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["zeta"],
      legacyCandidateFieldIds: ["alpha", "zeta"],
      shadowDecisionMap: new Map([
        ["zeta", decision("visible")],
        ["alpha", decision("hidden")],
        ["middle", decision("visible")],
      ]),
    });
    const second = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["zeta"],
      legacyCandidateFieldIds: ["alpha", "zeta"],
      shadowDecisionMap: new Map([
        ["middle", decision("visible")],
        ["alpha", decision("hidden")],
        ["zeta", decision("visible")],
      ]),
    });

    assert.deepEqual(first, second);
    assert.deepEqual(
      first.fieldReports.map((fieldReport) => fieldReport.fieldId),
      ["alpha", "middle", "zeta"],
    );
  });

  it("aggregates mismatch count for summary logging", () => {
    const report = compareShadowVsLegacy({
      legacyEligibleFieldIds: ["hiddenField"],
      legacyCandidateFieldIds: ["hiddenField"],
      shadowDecisionMap: new Map([
        ["missingField", decision("visible")],
        ["hiddenField", decision("hidden")],
        ["matchingField", decision("hidden")],
      ]),
    });

    assert.equal(report.matches, false);
    assert.equal(report.mismatchCount, 2);
    assert.deepEqual(
      report.fieldReports.map((fieldReport) => fieldReport.fieldId),
      ["hiddenField", "matchingField", "missingField"],
    );
  });
});

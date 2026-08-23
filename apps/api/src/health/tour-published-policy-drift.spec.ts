import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { listTourPublishedPolicyDriftCheckTargets } from "../integrations/platform/workspace-integration-capabilities.generated.ts";
import {
  isTourPublishedRolloutGateFatalEnabled,
  shouldWarnTourPublishedPolicyDrift,
} from "./tour-published-policy-drift";

const HERE = import.meta.dirname;
const HEALTH_SRC = join(HERE, "tour-published-policy-drift.ts");

describe("tour-published-policy-drift", () => {
  it("detects missing TourPublished policy on enabled denali telegram connections", () => {
    assert.equal(
      shouldWarnTourPublishedPolicyDrift({
        workspaceType: "denali",
        provider: "telegram",
        enabled: true,
        status: "enabled",
        persistedPolicies: [{ eventType: "TourCreated", enabled: true }],
      }),
      true
    );
    assert.equal(
      shouldWarnTourPublishedPolicyDrift({
        workspaceType: "denali",
        provider: "telegram",
        enabled: true,
        status: "enabled",
        persistedPolicies: [{ eventType: "TourPublished", enabled: true }],
      }),
      false
    );
  });

  it("ignores non-denali workspaces and disabled connections", () => {
    assert.equal(
      shouldWarnTourPublishedPolicyDrift({
        workspaceType: "starter",
        provider: "telegram",
        enabled: true,
        status: "enabled",
        persistedPolicies: [],
      }),
      false
    );
    assert.equal(
      shouldWarnTourPublishedPolicyDrift({
        workspaceType: "denali",
        provider: "telegram",
        enabled: false,
        status: "disabled",
        persistedPolicies: [],
      }),
      false
    );
  });

  it("uses generated drift-check targets instead of a Denali-only SQL literal", () => {
    const targets = listTourPublishedPolicyDriftCheckTargets();
    assert.deepEqual(targets, [{ workspaceType: "denali", providerId: "telegram" }]);

    const source = readFileSync(HEALTH_SRC, "utf8");
    assert.match(source, /listTourPublishedPolicyDriftCheckTargets/);
    assert.match(source, /WITH drift_targets/);
    assert.doesNotMatch(source, /workspace_type\s*=\s*['"]denali['"]/);
    assert.doesNotMatch(source, /provider\s*=\s*['"]telegram['"]/);
  });

  it("enables fatal rollout gate only with explicit env", () => {
    const previous = process.env.TOUR_PUBLISHED_ROLLOUT_GATE_FATAL;
    delete process.env.TOUR_PUBLISHED_ROLLOUT_GATE_FATAL;
    assert.equal(isTourPublishedRolloutGateFatalEnabled(), false);
    process.env.TOUR_PUBLISHED_ROLLOUT_GATE_FATAL = "true";
    assert.equal(isTourPublishedRolloutGateFatalEnabled(), true);
    if (previous === undefined) {
      delete process.env.TOUR_PUBLISHED_ROLLOUT_GATE_FATAL;
    } else {
      process.env.TOUR_PUBLISHED_ROLLOUT_GATE_FATAL = previous;
    }
  });
});

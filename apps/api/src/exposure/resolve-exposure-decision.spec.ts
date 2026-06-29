import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExposureIntent } from "./exposure-intent";
import { NATIVE_EXPOSURE_INTENT_SOURCE } from "./exposure-intent";
import { REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED } from "./exposure-profile";
import {
  EXPOSURE_RESOLVER_VERSION,
  resolveEngineSelectedFieldIds,
  resolveExposureDecision,
} from "./resolve-exposure-decision";

describe("resolveExposureDecision", () => {
  const profile = {
    id: "denali.telegram.TourCreated",
    workspaceType: "denali",
    entityType: "tour",
    surface: "telegram",
    audience: "external_channel",
    trigger: "TourCreated",
    defaultFieldIds: ["title"],
    source: REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
    version: "v1",
  } as const;

  it("records profile defaults when no native intent exists", () => {
    const resolved = resolveExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      eventType: "TourCreated",
      exposureSurface: "telegram",
      payload: { title: "Alpine Day" },
      profile,
      exposureIntent: null,
      resolveDeliveryFieldDefinitions: () => [],
    });

    assert.equal(resolved.decision.profileId, profile.id);
    assert.equal(resolved.decision.profileVersion, "v1");
    assert.equal(resolved.decision.resolverVersion, EXPOSURE_RESOLVER_VERSION);
    assert.equal(resolved.decision.selectionSource, "exposure_profile_defaults");
    assert.deepEqual(resolved.decision.candidateFieldIds, ["title"]);
    assert.deepEqual(resolved.decision.eligibleFieldIds, []);
  });

  it("records native intent metadata when an exposure intent is present", () => {
    const exposureIntent: ExposureIntent = {
      id: "intent-1",
      profileId: profile.id,
      workspaceType: "denali",
      scope: { connectionId: "conn-1" },
      mode: "override_fields",
      selectedFieldIds: ["native.title"],
      templateOverrideId: "Native {{field:native.title}}",
      source: NATIVE_EXPOSURE_INTENT_SOURCE,
      sourceId: "intent-1",
      version: "2026-01-01T00:00:00.000Z",
    };

    const resolved = resolveExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      eventType: "TourCreated",
      exposureSurface: "telegram",
      payload: { title: "Alpine Day" },
      profile,
      exposureIntent,
      resolveDeliveryFieldDefinitions: () => [],
    });

    assert.equal(resolved.decision.intentId, "intent-1");
    assert.equal(resolved.decision.intentVersion, "2026-01-01T00:00:00.000Z");
    assert.equal(resolved.decision.selectionSource, "native_exposure_intent");
    assert.equal(resolved.messageTemplate, "Native {{field:native.title}}");
  });

  it("uses engine catalog and mirrors engine-selected ids when engine decisions are provided", () => {
    const resolved = resolveExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      eventType: "TourCreated",
      exposureSurface: "telegram",
      payload: { title: "Alpine Day" },
      profile: { ...profile, defaultFieldIds: ["title", "summary", "secret", "title"] },
      exposureIntent: null,
      engineDecisions: new Map([
        ["title", { state: "visible", reasonChain: [], appliedPolicies: [] }],
        ["summary", { state: "summary_only", reasonChain: [], appliedPolicies: [] }],
        ["secret", { state: "blocked", reasonChain: [], appliedPolicies: [] }],
      ]),
      resolveDeliveryFieldDefinitions: () => [],
    });

    assert.deepEqual(resolved.decision.candidateFieldIds, ["secret", "summary", "title"]);
    assert.deepEqual(resolved.decision.engineSelectedFieldIds, ["title"]);
    assert.deepEqual(resolved.decision.eligibleFieldIds, ["title"]);
  });

  it("uses full engine catalog keys for candidates without requiring an explicit cutover flag", () => {
    const resolved = resolveExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      eventType: "TourCreated",
      exposureSurface: "telegram",
      payload: { title: "Alpine Day" },
      profile: { ...profile, defaultFieldIds: ["title"] },
      exposureIntent: null,
      engineDecisions: new Map([
        ["title", { state: "visible", reasonChain: [], appliedPolicies: [] }],
        ["meetingPoint", { state: "hidden", reasonChain: [], appliedPolicies: [] }],
        ["extra.field", { state: "blocked", reasonChain: [], appliedPolicies: [] }],
      ]),
      resolveDeliveryFieldDefinitions: () => [],
    });

    assert.deepEqual(resolved.decision.candidateFieldIds, [
      "extra.field",
      "meetingPoint",
      "title",
    ]);
    assert.deepEqual(resolved.decision.engineSelectedFieldIds, ["title"]);
  });

  it("mirrors engine-selected ids into eligibleFieldIds when engine catalog authority is active", () => {
    const resolved = resolveExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      eventType: "TourCreated",
      exposureSurface: "telegram",
      payload: { title: "Alpine Day" },
      profile: { ...profile, defaultFieldIds: ["title", "summary"] },
      exposureIntent: null,
      engineDecisions: new Map([
        ["title", { state: "visible", reasonChain: [], appliedPolicies: [] }],
        ["summary", { state: "hidden", reasonChain: [], appliedPolicies: [] }],
      ]),
      resolveDeliveryFieldDefinitions: () => [],
    });

    assert.deepEqual(resolved.decision.eligibleFieldIds, ["title"]);
    assert.deepEqual(resolved.decision.engineSelectedFieldIds, ["title"]);
  });
});

describe("resolveEngineSelectedFieldIds", () => {
  it("includes only visible engine decisions in candidate order", () => {
    const selected = resolveEngineSelectedFieldIds({
      candidateFieldIds: ["blocked", "visible", "redacted", "summary", "visible", ""],
      decisions: new Map([
        ["visible", { state: "visible", reasonChain: [], appliedPolicies: [] }],
        ["redacted", { state: "redacted", reasonChain: [], appliedPolicies: [] }],
        ["summary", { state: "summary_only", reasonChain: [], appliedPolicies: [] }],
        ["blocked", { state: "blocked", reasonChain: [], appliedPolicies: [] }],
      ]),
    });

    assert.deepEqual(selected, ["visible"]);
  });
});

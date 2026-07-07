import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveFieldExposureDecision } from "../../../src/exposure/field-exposure-decision-engine.js";
import { normalizeIntegrationEventType } from "../../../src/exposure/normalize-exposure-trigger.js";
import type { FieldDefinition, FieldPolicyRule } from "../../../src/field-policy/types.js";

describe("normalizeIntegrationEventType", () => {
  it("maps known integration events", () => {
    assert.deepEqual(normalizeIntegrationEventType("TourCreated"), {
      kind: "event",
      name: "tour_created",
    });
    assert.deepEqual(normalizeIntegrationEventType("TourPublished"), {
      kind: "event",
      name: "tour_published",
    });
  });

  it("snake_cases unknown integration events", () => {
    assert.deepEqual(normalizeIntegrationEventType("PaymentCompleted"), {
      kind: "event",
      name: "payment_completed",
    });
  });
});

describe("resolveFieldExposureDecision", () => {
  const definitions: readonly FieldDefinition[] = [
    {
      id: "title",
      workspaceType: "denali",
      canonicalPath: "title",
      kind: "text",
      version: 1,
    },
    {
      id: "meetingPoint",
      workspaceType: "denali",
      canonicalPath: "logistics.meetingPoint",
      kind: "text",
      version: 1,
    },
  ];
  const rules: readonly FieldPolicyRule[] = [
    {
      id: "title-visible",
      workspaceType: "denali",
      fieldId: "title",
      surface: "delivery",
      state: "visible",
      condition: { kind: "always" },
      priority: 1,
      enabled: true,
    },
    {
      id: "meeting-hidden",
      workspaceType: "denali",
      fieldId: "meetingPoint",
      surface: "delivery",
      state: "hidden",
      condition: { kind: "always" },
      priority: 1,
      enabled: true,
    },
  ];

  it("returns a visible skeleton decision with staged reason markers", () => {
    const decision = resolveFieldExposureDecision({
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "DRAFT" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
    });

    assert.equal(decision.state, "visible");
    assert.ok(decision.reasonChain.includes("registry_check:pending"));
    assert.ok(decision.reasonChain.includes("field_policy_check:pending"));
    assert.ok(decision.reasonChain.includes("exposure_policy_check:pending"));
    assert.deepEqual(decision.appliedPolicies, []);
  });

  it("hides fields that are missing from the registry snapshot", () => {
    const decision = resolveFieldExposureDecision({
      workspaceType: "denali",
      fieldId: "unknown",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: false },
    });

    assert.equal(decision.state, "hidden");
    assert.ok(decision.reasonChain.includes("registry_check:missing"));
  });

  it("maps FieldPolicy visible states to visible exposure decisions", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true, tags: ["deliverable"] },
      fieldPolicy: { surface: "delivery", definitions, rules },
    });

    assert.equal(decision.state, "visible");
    assert.ok(decision.reasonChain.includes("field_policy_check:visible:delivery"));
    assert.deepEqual(decision.appliedPolicies, ["field_policy:title-visible"]);
  });

  it("enforces FieldPolicy hidden as a hard lower bound", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "meetingPoint",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true, tags: ["deliverable"] },
      fieldPolicy: { surface: "delivery", definitions, rules },
    });

    assert.equal(decision.state, "hidden");
    assert.ok(decision.reasonChain.includes("field_policy_check:hidden:delivery"));
    assert.deepEqual(decision.appliedPolicies, ["field_policy:meeting-hidden"]);
  });

  it("blocks exposure when intent is disabled", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposureIntent: { mode: "disabled" },
    });

    assert.equal(decision.state, "blocked");
    assert.ok(decision.reasonChain.includes("exposure_intent_override:disabled"));
    assert.ok(decision.appliedPolicies.includes("exposure_intent:disabled"));
  });

  it("hides fields outside override_fields selectedFieldIds", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true, tags: ["deliverable"] },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposureIntent: { mode: "override_fields", selectedFieldIds: ["meetingPoint"] },
    });

    assert.equal(decision.state, "hidden");
    assert.ok(decision.reasonChain.includes("exposure_intent_override:not_selected"));
    assert.deepEqual(decision.appliedPolicies, [
      "field_policy:title-visible",
      "exposure_intent:override_not_selected",
    ]);
  });

  it("keeps selected override_fields visible after FieldPolicy allows exposure", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true, tags: ["deliverable"] },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposureIntent: { mode: "override_fields", selectedFieldIds: ["title"] },
    });

    assert.equal(decision.state, "visible");
    assert.ok(decision.reasonChain.includes("exposure_intent_override:selected"));
  });

  it("hides fields outside the exposure policy allowedFieldIds snapshot", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposurePolicy: {
        allowedFieldIds: ["meetingPoint"],
        profileId: "profile-1",
      },
    });

    assert.equal(decision.state, "hidden");
    assert.ok(decision.reasonChain.includes("exposure_policy_check:not_allowed"));
    assert.deepEqual(decision.appliedPolicies, [
      "field_policy:title-visible",
      "exposure_profile:profile-1",
    ]);
  });

  it("allows fields inside the exposure policy allowedFieldIds snapshot", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposurePolicy: {
        allowedFieldIds: ["title"],
        profileId: "profile-1",
      },
    });

    assert.equal(decision.state, "visible");
    assert.ok(decision.reasonChain.includes("exposure_policy_check:allowed"));
    assert.deepEqual(decision.appliedPolicies, [
      "field_policy:title-visible",
      "exposure_profile:profile-1",
    ]);
  });

  it("applies inherit_profile exposure policy before intent narrowing", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposurePolicy: {
        allowedFieldIds: ["meetingPoint"],
        profileId: "profile-1",
      },
      exposureIntent: { mode: "inherit_profile" },
    });

    assert.equal(decision.state, "hidden");
    assert.ok(decision.reasonChain.includes("exposure_policy_check:not_allowed"));
  });

  it("does not change inherit_profile decisions beyond FieldPolicy when policy allows the field", () => {
    const decision = resolveFieldExposureDecision({
      tenantId: "tenant-a",
      workspaceType: "denali",
      fieldId: "title",
      entityState: { tour: { status: "published" } },
      surface: "telegram",
      audience: "external_channel",
      trigger: { kind: "event", name: "tour_created" },
      registryField: { exists: true },
      fieldPolicy: { surface: "delivery", definitions, rules },
      exposureIntent: { mode: "inherit_profile" },
    });

    assert.equal(decision.state, "visible");
    assert.ok(decision.reasonChain.includes("exposure_intent_override:inherit_profile"));
    assert.doesNotMatch(decision.reasonChain.join(","), /override_not_selected/);
  });
});

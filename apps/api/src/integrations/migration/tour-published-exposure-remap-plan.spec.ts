import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTourPublishedRemapUpsert,
  mergeTourPublishedRemapUpsert,
  planTourPublishedExposureRemap,
  planTourPublishedExposureRemapBatch,
  rewriteTourPublishedTemplateOverride,
  TOUR_CREATED_SEEDED_TEMPLATE,
  TOUR_PUBLISHED_SEEDED_TEMPLATE,
} from "./tour-published-exposure-remap-plan";

function candidate(
  overrides: Partial<Parameters<typeof planTourPublishedExposureRemap>[0]["source"]> = {},
) {
  return {
    id: "intent-source",
    tenantId: "tenant-a",
    workspaceType: "denali",
    profileId: "denali.telegram.TourCreated",
    entityType: "tour",
    surface: "telegram",
    audience: "external_channel",
    trigger: "TourCreated",
    scope: { connectionId: "conn-1", eventType: "TourCreated" },
    mode: "override_fields" as const,
    selectedFieldIds: ["title"],
    templateOverrideId: TOUR_CREATED_SEEDED_TEMPLATE,
    ...overrides,
  };
}

describe("tour-published-exposure-remap-plan", () => {
  it("builds TourPublished upsert with rewritten template and scope", () => {
    const upsert = buildTourPublishedRemapUpsert(candidate());
    assert.equal(upsert.profileId, "denali.telegram.TourPublished");
    assert.equal(upsert.trigger, "TourPublished");
    assert.deepEqual(upsert.scope, {
      connectionId: "conn-1",
      eventType: "TourPublished",
    });
    assert.equal(upsert.templateOverrideId, TOUR_PUBLISHED_SEEDED_TEMPLATE);
  });

  it("plans merge when target intent already exists", () => {
    const plan = planTourPublishedExposureRemap({
      source: candidate({ selectedFieldIds: ["title", "denali.destination"] }),
      existingTarget: candidate({
        id: "intent-target",
        trigger: "TourPublished",
        profileId: "denali.telegram.TourPublished",
        scope: { connectionId: "conn-1", eventType: "TourPublished" },
        selectedFieldIds: ["title"],
      }),
    });
    assert.equal(plan.action, "merge");
    assert.equal(plan.mergeTargetIntentId, "intent-target");
    assert.deepEqual(plan.targetUpsert?.selectedFieldIds, ["title", "denali.destination"]);
  });

  it("merges field ids uniquely preserving order", () => {
    const merged = mergeTourPublishedRemapUpsert(
      candidate({
        selectedFieldIds: ["title"],
        templateOverrideId: null,
      }),
      candidate({
        selectedFieldIds: ["denali.destination", "title"],
        templateOverrideId: "Custom {{field:title}}",
      }),
    );
    assert.deepEqual(merged.selectedFieldIds, ["title", "denali.destination"]);
    assert.equal(merged.templateOverrideId, "Custom {{field:title}}");
  });

  it("batch plans remap then merge for duplicate target keys", () => {
    const plans = planTourPublishedExposureRemapBatch(
      [
        candidate({ id: "source-1", selectedFieldIds: ["title"] }),
        candidate({ id: "source-2", selectedFieldIds: ["denali.destination"] }),
      ],
      [],
    );
    assert.equal(plans[0]?.action, "remap");
    assert.equal(plans[1]?.action, "merge");
  });

  it("rewrites only the seeded TourCreated template", () => {
    assert.equal(
      rewriteTourPublishedTemplateOverride(TOUR_CREATED_SEEDED_TEMPLATE),
      TOUR_PUBLISHED_SEEDED_TEMPLATE,
    );
    assert.equal(rewriteTourPublishedTemplateOverride("Keep me"), "Keep me");
  });
});

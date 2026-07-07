import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFieldExposureEngineDecisionInput,
  buildFieldExposureEngineDecisionMap,
  buildFieldExposureEngineInputSnapshot,
  mapExposureIntentForEngine,
  mapExposurePolicyForEngine,
} from "./build-field-exposure-engine-input";
import { NATIVE_EXPOSURE_INTENT_SOURCE } from "./exposure-intent";

describe("buildFieldExposureEngineInputSnapshot", () => {
  it("builds registry and delivery FieldPolicy snapshots from the starter plugin", () => {
    const snapshot = buildFieldExposureEngineInputSnapshot({
      workspaceType: "starter",
      eventType: "TourCreated",
      payload: { status: "published", title: "Alpine Day" },
    });

    assert.ok(snapshot.registryCatalog.length > 0);
    assert.equal(snapshot.trigger.kind, "event");
    if (snapshot.trigger.kind === "event") {
      assert.equal(snapshot.trigger.name, "tour_created");
    }
    assert.equal(snapshot.adaptedFieldPolicy?.surface, "delivery");
  });

  it("normalizes a caller-supplied effective trigger instead of always using eventType", () => {
    const snapshot = buildFieldExposureEngineInputSnapshot({
      workspaceType: "starter",
      eventType: "TourCreated",
      trigger: "BookingConfirmed",
      payload: { status: "published", title: "Alpine Day" },
    });

    assert.equal(snapshot.trigger.kind, "event");
    if (snapshot.trigger.kind === "event") {
      assert.equal(snapshot.trigger.name, "booking_confirmed");
    }
  });
});

describe("buildFieldExposureEngineDecisionInput", () => {
  it("passes caller-supplied audience into the engine input", () => {
    const snapshot = buildFieldExposureEngineInputSnapshot({
      workspaceType: "starter",
      eventType: "TourCreated",
      payload: { status: "published", title: "Alpine Day" },
    });

    const input = buildFieldExposureEngineDecisionInput({
      tenantId: "tenant-a",
      workspaceType: "starter",
      surface: "telegram",
      audience: "registered_user",
      fieldId: "basics.title",
      snapshot,
    });

    assert.equal(input.audience, "registered_user");
  });
});

describe("mapExposureIntentForEngine", () => {
  it("maps native override intents with selected field ids", () => {
    const mapped = mapExposureIntentForEngine({
      workspaceType: "denali",
      scope: { connectionId: "conn-1" },
      mode: "override_fields",
      selectedFieldIds: ["title", "datetime"],
      source: NATIVE_EXPOSURE_INTENT_SOURCE,
      sourceId: "intent-1",
      version: "1",
    });

    assert.deepEqual(mapped, {
      mode: "override_fields",
      selectedFieldIds: ["title", "datetime"],
    });
  });

  it("returns undefined for absent intents", () => {
    assert.equal(mapExposureIntentForEngine(null), undefined);
    assert.equal(mapExposureIntentForEngine(undefined), undefined);
  });
});

describe("mapExposurePolicyForEngine", () => {
  it("maps profile defaultFieldIds for inherit_profile intents", () => {
    const mapped = mapExposurePolicyForEngine({
      profile: { id: "profile-1", defaultFieldIds: ["basics.title", "details.summary"] },
      exposureIntent: {
        workspaceType: "starter",
        scope: { connectionId: "conn-1" },
        mode: "inherit_profile",
        source: NATIVE_EXPOSURE_INTENT_SOURCE,
        sourceId: "intent-1",
        version: "1",
      },
    });

    assert.deepEqual(mapped, {
      allowedFieldIds: ["basics.title", "details.summary"],
      profileId: "profile-1",
    });
  });

  it("maps override_fields selectedFieldIds and omits policy when disabled", () => {
    assert.deepEqual(
      mapExposurePolicyForEngine({
        profile: { id: "profile-1", defaultFieldIds: ["basics.title"] },
        exposureIntent: {
          workspaceType: "starter",
          scope: { connectionId: "conn-1" },
          mode: "override_fields",
          selectedFieldIds: ["details.summary"],
          source: NATIVE_EXPOSURE_INTENT_SOURCE,
          sourceId: "intent-1",
          version: "1",
        },
      }),
      {
        allowedFieldIds: ["details.summary"],
        profileId: "profile-1",
      },
    );

    assert.equal(
      mapExposurePolicyForEngine({
        profile: { id: "profile-1", defaultFieldIds: ["basics.title"] },
        exposureIntent: {
          workspaceType: "starter",
          scope: { connectionId: "conn-1" },
          mode: "disabled",
          source: NATIVE_EXPOSURE_INTENT_SOURCE,
          sourceId: "intent-1",
          version: "1",
        },
      }),
      undefined,
    );
  });
});

describe("buildFieldExposureEngineDecisionMap", () => {
  it("applies override_fields intent constraints in engine decisions", () => {
    const decisions = buildFieldExposureEngineDecisionMap({
      tenantId: "tenant-a",
      workspaceType: "starter",
      eventType: "TourCreated",
      surface: "telegram",
      payload: { status: "published", title: "Alpine Day" },
      exposureIntent: {
        workspaceType: "starter",
        scope: { connectionId: "conn-1" },
        mode: "override_fields",
        selectedFieldIds: ["basics.title"],
        source: NATIVE_EXPOSURE_INTENT_SOURCE,
        sourceId: "intent-1",
        version: "1",
      },
    });

    assert.equal(decisions.get("basics.title")?.state, "visible");
    assert.equal(decisions.get("details.summary")?.state, "hidden");
  });

  it("applies profile defaultFieldIds for inherit_profile engine decisions", () => {
    const decisions = buildFieldExposureEngineDecisionMap({
      tenantId: "tenant-a",
      workspaceType: "starter",
      eventType: "TourCreated",
      surface: "telegram",
      payload: { status: "published", title: "Alpine Day" },
      exposureIntent: {
        workspaceType: "starter",
        scope: { connectionId: "conn-1" },
        mode: "inherit_profile",
        source: NATIVE_EXPOSURE_INTENT_SOURCE,
        sourceId: "intent-1",
        version: "1",
      },
      exposureProfile: {
        id: "profile-1",
        defaultFieldIds: ["basics.title"],
      },
    });

    assert.equal(decisions.get("basics.title")?.state, "visible");
    assert.equal(decisions.get("details.summary")?.state, "hidden");
  });

  it("normalizes effective trigger when building decision maps", () => {
    const decisions = buildFieldExposureEngineDecisionMap({
      tenantId: "tenant-a",
      workspaceType: "starter",
      eventType: "TourCreated",
      surface: "telegram",
      audience: "external_channel",
      trigger: "BookingConfirmed",
      payload: { status: "published", title: "Alpine Day" },
    });

    const titleDecision = decisions.get("basics.title");
    assert.ok(titleDecision?.reasonChain.some((reason) => reason.includes("booking_confirmed")));
  });
});

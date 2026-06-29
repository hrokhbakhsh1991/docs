import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatIntegrationDeliveryMessage } from "../integrations/platform/format-integration-delivery-message";

import {
  LEGACY_DELIVERY_SHADOW_EXPOSURE_RESOLVER,
  resolveShadowExposureFromDelivery,
} from "./shadow-exposure-resolver";

function authoritativeFields(input: {
  readonly candidateFieldIds: readonly string[];
  readonly eligibleFieldIds: readonly string[];
  readonly fieldValues: Readonly<Record<string, string>>;
  readonly messageTemplate?: string | null;
}) {
  return {
    candidateFieldIds: input.candidateFieldIds,
    eligibleFieldIds: input.eligibleFieldIds,
    fieldValues: input.fieldValues,
    messageTemplate: input.messageTemplate ?? null,
  };
}

describe("resolveShadowExposureFromDelivery", () => {
  it("returns null when current delivery policy is absent", () => {
    assert.equal(
      resolveShadowExposureFromDelivery({
        context: {
          workspaceType: "denali",
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourCreated",
        },
        eventType: "TourCreated",
        basePayload: {},
        deliveryPolicy: null,
        enriched: null,
        exposureIntent: null,
        templateOverrideId: null,
        authoritativeDeliveryFields: authoritativeFields({
          candidateFieldIds: [],
          eligibleFieldIds: [],
          fieldValues: {},
        }),
      }),
      null,
    );
  });

  it("mirrors current delivery policy and enrichment into exposure-shaped metadata", () => {
    const shadow = resolveShadowExposureFromDelivery({
      context: {
        workspaceType: "denali",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        scope: { connectionId: "conn-1" },
      },
      eventType: "TourCreated",
      basePayload: { title: "Alpine Day", aggregateId: "tour-1" },
      deliveryPolicy: {
        candidateFieldIds: ["title", "denali.destination"],
        eligibleFieldIds: ["title"],
        definitions: [],
      },
      enriched: { fieldValues: { title: "Alpine Day" } },
      exposureIntent: null,
      templateOverrideId: "New {{field:title}}",
      authoritativeDeliveryFields: authoritativeFields({
        candidateFieldIds: ["title", "denali.destination"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "New {{field:title}}",
      }),
    });

    assert.equal(shadow?.resolver, LEGACY_DELIVERY_SHADOW_EXPOSURE_RESOLVER);
    assert.deepEqual(shadow?.context, {
      workspaceType: "denali",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
      scope: { connectionId: "conn-1" },
    });
    assert.equal(shadow?.sourceIntent, null);
    assert.deepEqual(shadow?.candidateFieldIds, ["title", "denali.destination"]);
    assert.deepEqual(shadow?.exposedFieldIds, ["title"]);
    assert.deepEqual(shadow?.fieldValues, { title: "Alpine Day" });
    assert.equal(shadow?.templateOverrideId, "New {{field:title}}");
    assert.equal(shadow?.renderedMessage, "New Alpine Day");
    assert.equal(shadow?.deliveryParity.matches, true);
    assert.equal(shadow?.renderedParity.matches, true);
    assert.equal(shadow?.parity.matches, true);
  });

  it("records source intent on shadow metadata when present", () => {
    const shadow = resolveShadowExposureFromDelivery({
      context: {
        workspaceType: "denali",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        scope: { connectionId: "conn-1" },
      },
      eventType: "TourCreated",
      basePayload: { title: "Alpine Day" },
      deliveryPolicy: {
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        definitions: [],
      },
      enriched: { fieldValues: { title: "Alpine Day" } },
      exposureIntent: {
        profileId: "denali.telegram.TourCreated",
        workspaceType: "denali",
        entityType: "tour",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        scope: { connectionId: "conn-1" },
        mode: "override_fields",
        selectedFieldIds: ["title"],
        templateOverrideId: "New {{field:title}}",
        source: "native_exposure_intent",
        sourceId: "native-1",
        version: "2026-01-01T00:00:00.000Z",
      },
      templateOverrideId: "New {{field:title}}",
      authoritativeDeliveryFields: authoritativeFields({
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "New {{field:title}}",
      }),
    });

    assert.equal(shadow?.sourceIntent?.sourceId, "native-1");
    assert.deepEqual(shadow?.exposedFieldIds, ["title"]);
    assert.equal(shadow?.parity.matches, true);
  });

  it("rendered message matches worker formatter on mirrored delivery payload", () => {
    const basePayload = { title: "Alpine Day", aggregateId: "tour-1" };
    const shadow = resolveShadowExposureFromDelivery({
      context: {
        workspaceType: "starter",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
      },
      eventType: "TourCreated",
      basePayload,
      deliveryPolicy: {
        candidateFieldIds: ["basics.title"],
        eligibleFieldIds: ["basics.title"],
        definitions: [],
      },
      enriched: { fieldValues: { "basics.title": "Alpine Day" } },
      exposureIntent: null,
      templateOverrideId: null,
      authoritativeDeliveryFields: authoritativeFields({
        candidateFieldIds: ["basics.title"],
        eligibleFieldIds: ["basics.title"],
        fieldValues: { "basics.title": "Alpine Day" },
      }),
    });

    const workerRendered = formatIntegrationDeliveryMessage({
      workspaceType: "starter",
      eventType: "TourCreated",
      payload: {
        ...basePayload,
        integrationDeliveryCandidateFieldIds: ["basics.title"],
        integrationDeliveryFieldIds: ["basics.title"],
        integrationDeliveryFieldValues: { "basics.title": "Alpine Day" },
      },
    });

    assert.equal(shadow?.renderedMessage, workerRendered);
    assert.equal(shadow?.renderedParity.matches, true);
    assert.equal(shadow?.parity.matches, true);
  });
});

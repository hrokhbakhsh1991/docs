import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatIntegrationDeliveryMessage } from "../integrations/platform/format-integration-delivery-message";

import {
  buildIntegrationDeliveryRenderPayload,
  resolveShadowRenderedDeliveryParity,
} from "./shadow-rendered-delivery-parity";

describe("shadow rendered delivery parity", () => {
  it("builds the same payload shape the worker formatter consumes", () => {
    const payload = buildIntegrationDeliveryRenderPayload({
      basePayload: { title: "Alpine Day", aggregateId: "tour-1" },
      candidateFieldIds: ["title", "denali.destination"],
      eligibleFieldIds: ["title"],
      fieldValues: { title: "Alpine Day" },
      messageTemplate: "New {{field:title}}",
    });

    assert.deepEqual(payload.integrationDeliveryCandidateFieldIds, ["title", "denali.destination"]);
    assert.deepEqual(payload.integrationDeliveryFieldIds, ["title"]);
    assert.deepEqual(payload.integrationDeliveryFieldValues, { title: "Alpine Day" });
    assert.equal(payload.integrationDeliveryMessageTemplate, "New {{field:title}}");
  });

  it("records rendered message parity against authoritative delivery fields", () => {
    const input = {
      workspaceType: "denali",
      eventType: "TourCreated",
      basePayload: { title: "Alpine Day", aggregateId: "tour-1" },
      shadowFields: {
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "New {{field:title}}",
      },
      authoritativeFields: {
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "New {{field:title}}",
      },
    } as const;

    const { renderedMessage, renderedParity } = resolveShadowRenderedDeliveryParity(input);
    const workerRendered = formatIntegrationDeliveryMessage({
      workspaceType: input.workspaceType,
      eventType: input.eventType,
      payload: buildIntegrationDeliveryRenderPayload({
        basePayload: input.basePayload,
        candidateFieldIds: input.authoritativeFields.candidateFieldIds,
        eligibleFieldIds: input.authoritativeFields.eligibleFieldIds,
        fieldValues: input.authoritativeFields.fieldValues,
        messageTemplate: input.authoritativeFields.messageTemplate,
      }),
    });

    assert.equal(renderedMessage, "New Alpine Day");
    assert.equal(renderedMessage, workerRendered);
    assert.equal(renderedParity.matches, true);
    assert.deepEqual(renderedParity.mismatches, []);
  });

  it("detects rendered template divergence between shadow and authoritative fields", () => {
    const { renderedParity } = resolveShadowRenderedDeliveryParity({
      workspaceType: "denali",
      eventType: "TourCreated",
      basePayload: { title: "Alpine Day" },
      shadowFields: {
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "Shadow {{field:title}}",
      },
      authoritativeFields: {
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "Authoritative {{field:title}}",
      },
    });

    assert.equal(renderedParity.matches, false);
    assert.deepEqual(renderedParity.mismatches, ["rendered_message"]);
  });
});

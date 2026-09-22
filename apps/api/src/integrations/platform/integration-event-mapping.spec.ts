import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { integrationMappingsForEvent } from "./integration-event-mapping";

describe("integration event mappings", () => {
  it("maps TourPublished from Denali integration surface", async () => {
    assert.deepEqual(await integrationMappingsForEvent("TourPublished", "denali"), [
      {
        eventType: "TourPublished",
        capability: "message.send",
        providers: ["telegram"],
        topicKey: "registration",
      },
    ]);
    assert.deepEqual(await integrationMappingsForEvent("TourCreated", "denali"), []);
  });

  it("routes operational events to their forum topics", async () => {
    assert.deepEqual(await integrationMappingsForEvent("member.registered", "denali"), [
      {
        eventType: "member.registered",
        capability: "message.send",
        providers: ["telegram"],
        topicKey: "registration",
      },
    ]);
    assert.deepEqual(await integrationMappingsForEvent("registration.created", "denali"), [
      {
        eventType: "registration.created",
        capability: "message.send",
        providers: ["telegram"],
        topicKey: "registration",
      },
    ]);
    assert.deepEqual(await integrationMappingsForEvent("registration.approved", "denali"), [
      {
        eventType: "registration.approved",
        capability: "message.send",
        providers: ["telegram"],
        topicKey: "registration",
      },
    ]);
    assert.deepEqual(await integrationMappingsForEvent("receipt.submitted", "denali"), [
      {
        eventType: "receipt.submitted",
        capability: "message.send",
        providers: ["telegram"],
        topicKey: "receipts",
      },
    ]);
    for (const eventType of ["receipt.approved", "receipt.rejected"] as const) {
      assert.deepEqual(await integrationMappingsForEvent(eventType, "denali"), [
        {
          eventType,
          capability: "message.send",
          providers: ["telegram"],
          topicKey: "receipts",
        },
      ]);
    }
    assert.deepEqual(await integrationMappingsForEvent("ticket.created", "denali"), [
      {
        eventType: "ticket.created",
        capability: "message.send",
        providers: ["telegram"],
        topicKey: "tickets",
      },
    ]);
  });

  it("returns no mappings for workspaces without integration surface", async () => {
    assert.deepEqual(await integrationMappingsForEvent("TourCreated", "starter"), []);
    assert.deepEqual(await integrationMappingsForEvent("TourCreated", null), []);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyFieldPolicyPlaceholders,
  formatIntegrationDeliveryMessage,
} from "./format-integration-delivery-message";

describe("format integration delivery message", () => {
  it("uses Denali TourCreated template from workspace surface", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: { title: "Alpine Day", aggregateId: "tour-1" },
      }),
      "Tour created: Alpine Day"
    );
  });

  it("renders automatic field lines in integrationDeliveryFieldIds order when no custom template", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: {
          title: "Alpine Day",
          aggregateId: "tour-1",
          integrationDeliveryFieldIds: ["destinationId", "title", "startDateTime"],
          integrationDeliveryFieldValues: {
            destinationId: "Kerman",
            title: "Alpine Day",
            startDateTime: "2026-06-28",
          },
        },
      }),
      [
        "Tour created: Alpine Day",
        "Destination: Kerman",
        "Title: Alpine Day",
        "Start Date Time: 2026-06-28",
      ].join("\n"),
    );
  });

  it("prefixes automatic field lines with intent-scoped decorations", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: {
          title: "Alpine Day",
          aggregateId: "tour-1",
          integrationDeliveryFieldIds: ["meetingPoint", "participants.gearItems"],
          integrationDeliveryFieldValues: {
            meetingPoint: "Jamshidiyeh Park",
            "participants.gearItems": "Breakfast, water, baton",
          },
          integrationDeliveryFieldDecorations: {
            meetingPoint: { prefix: "✅ 📍" },
            "participants.gearItems": { prefix: "✅ 🎒" },
          },
        },
      }),
      [
        "Tour created: Alpine Day",
        "✅ 📍 Meeting Point: Jamshidiyeh Park",
        "✅ 🎒 Gear Items: Breakfast, water, baton",
      ].join("\n"),
    );
  });

  it("leaves custom template output unchanged when decorations are present", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: {
          title: "Alpine Day",
          aggregateId: "tour-1",
          integrationDeliveryMessageTemplate: "New tour {{field:title}} ({{eventType}})",
          integrationDeliveryFieldIds: ["title"],
          integrationDeliveryFieldValues: { title: "Alpine Day" },
          integrationDeliveryFieldDecorations: {
            title: { prefix: "✅" },
          },
        },
      }),
      "New tour Alpine Day (TourCreated)",
    );
  });

  it("prefers an admin message-template override from the payload", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: {
          title: "Alpine Day",
          aggregateId: "tour-1",
          integrationDeliveryMessageTemplate: "New tour {{field:title}} ({{eventType}})",
          integrationDeliveryFieldIds: ["title"],
          integrationDeliveryFieldValues: { title: "Alpine Day" },
        },
      }),
      "New tour Alpine Day (TourCreated)"
    );
  });

  it("falls back when workspace has no template", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "starter",
        eventType: "TourCreated",
        payload: { aggregateId: "tour-2" },
      }),
      "TourCreated: tour-2"
    );
  });

  it("leaves templates without field placeholders unchanged", () => {
    assert.equal(
      applyFieldPolicyPlaceholders("Tour created: {{title}}", {
        integrationDeliveryFieldIds: ["basics.title"],
        integrationDeliveryFieldValues: { "basics.title": "Alpine Day" },
      }),
      "Tour created: {{title}}"
    );
  });

  it("fills {{field:<id>}} only for delivery-eligible field ids", () => {
    assert.equal(
      applyFieldPolicyPlaceholders(
        "Title: {{field:basics.title}} | Summary: {{field:details.summary}}",
        {
          integrationDeliveryFieldIds: ["basics.title", "details.summary"],
          integrationDeliveryFieldValues: {
            "basics.title": "Alpine Day",
            "details.summary": "A guided hike",
          },
        }
      ),
      "Title: Alpine Day | Summary: A guided hike"
    );
  });

  it("redacts non-eligible or value-missing field placeholders to empty string", () => {
    assert.equal(
      applyFieldPolicyPlaceholders(
        "Title: {{field:basics.title}} | Featured: {{field:basics.featured}}",
        {
          integrationDeliveryFieldIds: ["basics.title"],
          integrationDeliveryFieldValues: {
            "basics.title": "Alpine Day",
            "basics.featured": "true",
          },
        }
      ),
      "Title: Alpine Day | Featured: "
    );
  });

  it("redacts all field placeholders when no eligibility metadata is present", () => {
    assert.equal(
      applyFieldPolicyPlaceholders("Title: {{field:basics.title}}", {}),
      "Title: "
    );
  });

  it("ignores fieldExposureShadow metadata when formatting delivery message", () => {
    assert.equal(
      formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourCreated",
        payload: {
          title: "Alpine Day",
          aggregateId: "tour-1",
          integrationDeliveryFieldIds: ["title"],
          integrationDeliveryFieldValues: { title: "Alpine Day" },
          fieldExposureShadow: {
            renderedMessage: "SHADOW_ONLY_TEXT",
            exposedFieldIds: ["wrong-field"],
          },
        },
      }),
      "Tour created: Alpine Day\nTitle: Alpine Day",
    );
  });
});

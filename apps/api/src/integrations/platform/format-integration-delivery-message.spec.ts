import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyFieldPolicyPlaceholders,
  formatIntegrationDeliveryMessage,
} from "./format-integration-delivery-message";

describe("format integration delivery message", () => {
  it("uses Denali TourPublished template from workspace surface", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourPublished",
        payload: { title: "Alpine Day", aggregateId: "tour-1" },
      }),
      "Tour published: Alpine Day"
    );
  });

  it("renders operational registration and receipt payload fields", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "member.registered",
        payload: {
          displayName: "Ali Test",
          mobile: "+989121234567",
          registeredAt: "2026-09-14T10:00:00.000Z",
        },
      }),
      "عضو جدید دنالی\nنام: Ali Test\nشماره تماس: +989121234567\nتاریخ ثبت‌نام: 2026-09-14T10:00:00.000Z"
    );
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "registration.created",
        payload: {
          guestLabel: "Ali Test",
          tourTitle: "Damavand",
          departureAt: "2026-09-20",
          partySize: 2,
          approvalStatus: "awaiting_approval",
        },
      }),
      "ثبت‌نام جدید: Ali Test\nتور: Damavand\nتاریخ حرکت: 2026-09-20\nتعداد نفرات: 2\nوضعیت تأیید: awaiting_approval"
    );
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "receipt.submitted",
        payload: {
          registrationId: "reg-1",
          paymentId: "pay-1",
          amount: "2500000",
          currency: "IRR",
          submittedAt: "2026-09-14T10:00:00.000Z",
        },
      }),
      "فیش جدید برای بررسی\nشناسه ثبت‌نام: reg-1\nشناسه پرداخت: pay-1\nمبلغ قابل پرداخت: 2500000 IRR\nتاریخ ارسال: 2026-09-14T10:00:00.000Z"
    );
  });

  it("renders automatic field lines in integrationDeliveryFieldIds order when no custom template", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourPublished",
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
        "Tour published: Alpine Day",
        "Destination: Kerman",
        "Title: Alpine Day",
        "Start Date Time: 2026-06-28",
      ].join("\n")
    );
  });

  it("prefixes automatic field lines with intent-scoped decorations", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourPublished",
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
        "Tour published: Alpine Day",
        "✅ 📍 Meeting Point: Jamshidiyeh Park",
        "✅ 🎒 Gear Items: Breakfast, water, baton",
      ].join("\n")
    );
  });

  it("leaves custom template output unchanged when decorations are present", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourPublished",
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
      "New tour Alpine Day (TourPublished)"
    );
  });

  it("prefers an admin message-template override from the payload", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourPublished",
        payload: {
          title: "Alpine Day",
          aggregateId: "tour-1",
          integrationDeliveryMessageTemplate: "New tour {{field:title}} ({{eventType}})",
          integrationDeliveryFieldIds: ["title"],
          integrationDeliveryFieldValues: { title: "Alpine Day" },
        },
      }),
      "New tour Alpine Day (TourPublished)"
    );
  });

  it("falls back when workspace has no template", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "starter",
        eventType: "TourCreated",
        payload: { aggregateId: "tour-2" },
      }),
      "TourCreated: tour-2"
    );
  });

  it("leaves templates without field placeholders unchanged", async () => {
    assert.equal(
      await applyFieldPolicyPlaceholders("Tour created: {{title}}", {
        integrationDeliveryFieldIds: ["basics.title"],
        integrationDeliveryFieldValues: { "basics.title": "Alpine Day" },
      }),
      "Tour created: {{title}}"
    );
  });

  it("fills {{field:<id>}} only for delivery-eligible field ids", async () => {
    assert.equal(
      await applyFieldPolicyPlaceholders(
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

  it("redacts non-eligible or value-missing field placeholders to empty string", async () => {
    assert.equal(
      await applyFieldPolicyPlaceholders(
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

  it("redacts all field placeholders when no eligibility metadata is present", async () => {
    assert.equal(
      await applyFieldPolicyPlaceholders("Title: {{field:basics.title}}", {}),
      "Title: "
    );
  });

  it("ignores fieldExposureShadow metadata when formatting delivery message", async () => {
    assert.equal(
      await formatIntegrationDeliveryMessage({
        workspaceType: "denali",
        eventType: "TourPublished",
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
      "Tour published: Alpine Day\nTitle: Alpine Day"
    );
  });
});

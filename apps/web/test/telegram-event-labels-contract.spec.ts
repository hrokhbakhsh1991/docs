import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { telegramEventLabelKey } from "@/exposure/telegram-event-label-key";

type SettingsMessages = {
  integrations?: {
    deliveryPolicy?: {
      eventNames?: {
        [key: string]: string | Record<string, string> | undefined;
      };
    };
  };
  exposure?: {
    simulation?: {
      eventLabels?: Record<string, string | undefined>;
    };
  };
};

function readEventLabel(
  eventNames: NonNullable<
    NonNullable<SettingsMessages["integrations"]>["deliveryPolicy"]
  >["eventNames"],
  eventType: string
): unknown {
  return eventType.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    return (value as Record<string, unknown>)[segment];
  }, eventNames);
}

describe("BUG-STG-ADMIN-TELEGRAM-EVENT-LABELS", () => {
  it("defines Persian labels for every Telegram event shown in Admin", () => {
    const messages = JSON.parse(
      readFileSync(new URL("../messages/fa/settings.json", import.meta.url), "utf8")
    ) as SettingsMessages;
    const eventNames = messages.integrations?.deliveryPolicy?.eventNames ?? {};

    for (const eventType of [
      "Member registered",
      "Receipt submitted",
      "Registration created",
      "Registration waitlisted",
      "Ticket assigned",
      "Ticket closed",
      "Ticket created",
      "Ticket internal note created",
      "Ticket message posted",
      "Ticket priority changed",
      "Ticket reopened",
      "Ticket resolved",
      "Ticket status changed",
      "TourCreated",
      "TourPublished",
      "RegistrationApproved",
      "RegistrationWaitlisted",
      "ReceiptApproved",
      "ReceiptRejected",
    ]) {
      const label = readEventLabel(eventNames, eventType);
      assert.equal(typeof label, "string");
      assert.notEqual(label, eventType);
      assert.match(label, /[\u0600-\u06ff]/);
    }

    for (const eventType of [
      "registration.approved",
      "registration.waitlisted",
      "receipt.approved",
      "receipt.rejected",
    ]) {
      const label = readEventLabel(eventNames, eventType);
      assert.equal(typeof label, "string");
      assert.notEqual(label, eventType);
      assert.match(label, /[\u0600-\u06ff]/);
    }
  });

  it("maps the runtime dotted event types to locale keys", () => {
    assert.deepEqual(
      [
        "member.registered",
        "registration.created",
        "registration.waitlisted",
        "registration.approved",
        "receipt.submitted",
        "receipt.approved",
        "receipt.rejected",
        "ticket.created",
        "ticket.message.posted",
        "ticket.internal_note.created",
        "ticket.status.changed",
        "ticket.resolved",
        "ticket.reopened",
        "ticket.assigned",
        "ticket.priority.changed",
        "ticket.closed",
      ].map(telegramEventLabelKey),
      [
        "memberRegistered",
        "registrationCreated",
        "registrationWaitlisted",
        "registrationApproved",
        "receiptSubmitted",
        "receiptApproved",
        "receiptRejected",
        "ticketCreated",
        "ticketMessagePosted",
        "ticketInternalNoteCreated",
        "ticketStatusChanged",
        "ticketResolved",
        "ticketReopened",
        "ticketAssigned",
        "ticketPriorityChanged",
        "ticketClosed",
      ]
    );
  });

  it("keeps simulation labels localized for every routable lifecycle event", () => {
    const messages = JSON.parse(
      readFileSync(new URL("../messages/fa/settings.json", import.meta.url), "utf8")
    ) as SettingsMessages;
    const labels = messages.exposure?.simulation?.eventLabels ?? {};
    for (const eventType of [
      "TourCreated",
      "TourPublished",
      "member.registered",
      "registration.created",
      "registration.approved",
      "registration.waitlisted",
      "receipt.submitted",
      "receipt.approved",
      "receipt.rejected",
    ]) {
      const key = telegramEventLabelKey(eventType);
      assert.ok(key, `missing mapping for ${eventType}`);
      const label = labels[key!];
      assert.equal(typeof label, "string");
      assert.match(label!, /[\u0600-\u06ff]/);
    }
  });
});

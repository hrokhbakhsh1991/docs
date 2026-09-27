import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

type SettingsMessages = {
  integrations?: {
    deliveryPolicy?: {
      eventNames?: {
        [key: string]: string | Record<string, string> | undefined;
      };
    };
  };
};

function readEventLabel(
  eventNames: NonNullable<NonNullable<SettingsMessages["integrations"]>["deliveryPolicy"]>["eventNames"],
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
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTelegramFieldTemplateLine,
  hydrateTelegramTemplateState,
  renderTelegramDeliveryPreview,
  syncTelegramTemplateOnFieldToggle,
} from "../src/exposure/telegram-delivery-template-sync";

const destinationField = {
  id: "denali.destination",
  canonicalPath: "destinationId",
  adminLabel: "مقصد",
} as const;

const titleField = {
  id: "denali.title",
  canonicalPath: "title",
  adminLabel: "عنوان",
} as const;

describe("telegram delivery template sync", () => {
  it("builds a field line with admin label and placeholder", () => {
    assert.equal(
      buildTelegramFieldTemplateLine(destinationField),
      "مقصد: {{field:denali.destination}}",
    );
  });

  it("appends and removes field lines when checklist ticks change", () => {
    const first = syncTelegramTemplateOnFieldToggle({
      template: "",
      field: destinationField,
      checked: true,
    });
    assert.equal(first, "مقصد: {{field:denali.destination}}");

    const second = syncTelegramTemplateOnFieldToggle({
      template: first,
      field: titleField,
      checked: true,
    });
    assert.equal(
      second,
      "مقصد: {{field:denali.destination}}\nعنوان: {{field:denali.title}}",
    );

    const third = syncTelegramTemplateOnFieldToggle({
      template: second,
      field: destinationField,
      checked: false,
    });
    assert.equal(third, "عنوان: {{field:denali.title}}");
  });

  it("still syncs lines after the operator edited other template text", () => {
    const synced = syncTelegramTemplateOnFieldToggle({
      template: "پیام سفارشی",
      field: destinationField,
      checked: true,
    });
    assert.equal(synced, "پیام سفارشی\nمقصد: {{field:denali.destination}}");
  });

  it("migrates legacy field decorations into inline template lines on hydrate", () => {
    const hydrated = hydrateTelegramTemplateState({
      template: "",
      legacyFieldDecorations: {
        "denali.destination": { prefix: "✅ 📍" },
      },
      fields: [destinationField, titleField],
      selectedFieldIds: ["denali.destination", "denali.title"],
    });

    assert.equal(
      hydrated,
      "✅ 📍 مقصد: {{field:denali.destination}}\nعنوان: {{field:denali.title}}",
    );
  });

  it("keeps persisted custom templates on hydrate", () => {
    const hydrated = hydrateTelegramTemplateState({
      template: "انتشار: {{field:denali.title}}",
      fields: [titleField],
      selectedFieldIds: ["denali.title"],
    });

    assert.equal(hydrated, "انتشار: {{field:denali.title}}");
  });

  it("seeds canvas lines from customize override selection when template is empty", () => {
    const hydrated = hydrateTelegramTemplateState({
      template: "",
      fields: [destinationField, titleField],
      selectedFieldIds: ["denali.destination", "denali.title"],
      customizeFields: true,
    });

    assert.equal(
      hydrated,
      "مقصد: {{field:denali.destination}}\nعنوان: {{field:denali.title}}",
    );
  });

  it("renders preview for custom templates and automatic fallback", () => {
    const labels = {
      empty: "خالی",
      defaultPrefix: "اتفاق",
      sampleValue: "نمونه",
      aggregateId: "tour_1",
      redacted: "—",
    };

    assert.equal(
      renderTelegramDeliveryPreview({
        eventLabel: "انتشار تور",
        fields: [destinationField],
        selectedFieldIds: ["denali.destination"],
        template: "مقصد: {{field:denali.destination}}",
        labels,
      }),
      "مقصد: کرمان",
    );

    assert.match(
      renderTelegramDeliveryPreview({
        eventLabel: "انتشار تور",
        fields: [destinationField, titleField],
        selectedFieldIds: ["denali.destination", "denali.title"],
        template: "",
        labels,
      }),
      /اتفاق: انتشار تور\nمقصد: کرمان/,
    );
  });
});

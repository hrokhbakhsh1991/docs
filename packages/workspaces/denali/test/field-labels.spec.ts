import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveDenaliEnumOptionLabel,
  resolveDenaliFieldLabel,
} from "../src/ui/adapters/field-labels";

function createTranslator(messages: Record<string, string>) {
  const translate = ((key: string) => messages[key] ?? key) as ((
    key: string
  ) => string) & { has: (key: string) => boolean };
  translate.has = (key: string) => key in messages;
  return translate;
}

describe("field-labels.spec.ts — enum + has", () => {
  it("DEN-LBL-01 resolveDenaliFieldLabel uses has without English fallback", () => {
    const t = createTranslator({ "fields.title": "نام تور" });
    assert.equal(resolveDenaliFieldLabel(t, "title"), "نام تور");
    assert.equal(resolveDenaliFieldLabel(t, "missing.path"), "Path");
  });

  it("DEN-LBL-02 resolveDenaliEnumOptionLabel maps transport and payment modes", () => {
    const t = createTranslator({
      "transportModes.bus": "اتوبوس",
      "paymentModes.offline_receipt": "رسید آفلاین",
    });
    assert.equal(resolveDenaliEnumOptionLabel(t, "transport.mode", "bus"), "اتوبوس");
    assert.equal(
      resolveDenaliEnumOptionLabel(t, "pricing.paymentMode", "offline_receipt"),
      "رسید آفلاین"
    );
  });
});

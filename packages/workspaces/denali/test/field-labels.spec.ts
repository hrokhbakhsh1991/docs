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

  it("DEN-LBL-03 resolveDenaliEnumOptionLabel maps tour catalog paths (Wave F.c)", () => {
    const t = createTranslator({
      "tourKinds.nature": "طبیعت",
      "composites.tourKind.durations.multi_day": "چندروزه",
      "composites.tourKind.categories.adventure": "ماجراجویی",
    });
    assert.equal(resolveDenaliEnumOptionLabel(t, "tour.kind", "nature"), "طبیعت");
    assert.equal(resolveDenaliEnumOptionLabel(t, "tour.duration", "multi_day"), "چندروزه");
    assert.equal(
      resolveDenaliEnumOptionLabel(t, "tour.categoryGroup", "adventure"),
      "ماجراجویی"
    );
  });

  it("DEN-LBL-04 skips unresolved denali.* keys and continues enum fallback chain", () => {
    const t = createTranslator({
      "enumOptions.tour.kind.mountain_day": "denali.denali.enumOptions.tour.kind.mountain_day",
      "tourKinds.mountain_day": "کوهنوردی — تک‌روزه",
    });
    assert.equal(
      resolveDenaliEnumOptionLabel(t, "tour.kind", "mountain_day"),
      "کوهنوردی — تک‌روزه"
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDatetimeLocalLabel } from "../src/ui/adapters/datetime-format.ts";
import { isoToDatetimeLocalInput } from "../src/ui/logic/denali-datetime-utils.ts";

/**
 * INV-DENALI-REVIEW-01 — production wiring for review schedule labels
 * (same path as DenaliReviewStep labels.formatDatetime).
 */
function formatCanonicalDatetimeForReview(iso: string, locale: "en" | "fa"): string {
  return formatDatetimeLocalLabel(isoToDatetimeLocalInput(iso), locale);
}

describe("denali-review-datetime-display", () => {
  it("DN-REVIEW-DT-01 formats Zulu ISO as local wall-clock label (not raw Z)", () => {
    const iso = "2026-08-07T04:30:00.000Z";
    const local = isoToDatetimeLocalInput(iso);
    assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.notEqual(local, iso);

    const en = formatCanonicalDatetimeForReview(iso, "en");
    assert.notEqual(en.trim().length, 0);
    assert.doesNotMatch(en, /\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    assert.doesNotMatch(en, /T04:30:00/);

    const fa = formatCanonicalDatetimeForReview(iso, "fa");
    assert.notEqual(fa.trim().length, 0);
    assert.doesNotMatch(fa, /\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it("DN-REVIEW-DT-02 passes through empty", () => {
    assert.equal(formatCanonicalDatetimeForReview("", "en"), "");
  });
});

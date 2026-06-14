/**
 * Tour error i18n resolver — stable codes vs pre-localized messages
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStableTourErrorCode,
  resolveTourErrorMessage,
} from "../src/i18n/resolve-tour-error-message";

describe("resolve-tour-error-message.spec.ts", () => {
  it("isStableTourErrorCode accepts TOUR_* keys only", () => {
    assert.equal(isStableTourErrorCode("TOUR_NOT_FOUND"), true);
    assert.equal(isStableTourErrorCode("TOUR_EDIT_HTTP_401"), true);
    assert.equal(isStableTourErrorCode("tours.edit.errors.TOUR_foo"), false);
    assert.equal(isStableTourErrorCode("ساخت تور ناموفق بود"), false);
  });

  it("resolveTourErrorMessage passes through pre-localized text", () => {
    const t = (key: string) => `translated:${key}`;
    assert.equal(
      resolveTourErrorMessage(t, "قبل از ایجاد تور، فیلدهای مشخص‌شده را اصلاح کنید."),
      "قبل از ایجاد تور، فیلدهای مشخص‌شده را اصلاح کنید."
    );
  });

  it("resolveTourErrorMessage translates stable codes", () => {
    const t = (key: string) => (key === "TOUR_NOT_FOUND" ? "تور پیدا نشد." : key);
    assert.equal(resolveTourErrorMessage(t, "TOUR_NOT_FOUND"), "تور پیدا نشد.");
  });
});

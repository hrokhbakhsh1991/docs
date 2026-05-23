import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/api-client";

import { formatWizardApiErrorMessage } from "./format-wizard-api-error";

test("formatWizardApiErrorMessage maps TOUR_NOT_PUBLISHABLE to Persian registry text", () => {
  const msg = formatWizardApiErrorMessage(
    new ApiError("TOUR_NOT_PUBLISHABLE", "Tour title is required before publishing"),
    "fallback",
  );
  assert.match(msg, /اطلاعات تور ناقص/);
  assert.match(msg, /فیلدهای اجباری/);
});

test("formatWizardApiErrorMessage maps VALIDATION_PROFILE_EDIT_REQUIRED_FIELD to Persian", () => {
  const msg = formatWizardApiErrorMessage(
    new ApiError(
      "VALIDATION_PROFILE_EDIT_REQUIRED_FIELD",
      "Missing Edit-required tripDetails fields",
    ),
    "fallback",
  );
  assert.match(msg, /فعالیت‌ها و برنامه‌ریزی روزهای تور/);
});

test("formatWizardApiErrorMessage maps VALIDATION_PROFILE_REQUIRED_FIELD to Persian", () => {
  const msg = formatWizardApiErrorMessage(
    new ApiError(
      "VALIDATION_PROFILE_REQUIRED_FIELD",
      "Missing required profile fields for submit",
    ),
    "fallback",
  );
  assert.match(msg, /اطلاعات ساختاری تور/);
  assert.match(msg, /فرم پیش‌نویس را کامل کنید/);
});

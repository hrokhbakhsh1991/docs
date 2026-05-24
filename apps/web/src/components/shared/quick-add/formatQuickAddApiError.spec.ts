import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/api-client";

import { formatQuickAddApiError } from "./formatQuickAddApiError";

test("formatQuickAddApiError prefers nested API error message", () => {
  const err = new ApiError("VALIDATION_FAILED", "Invalid", 400, {
    error: { message: "نام مقصد تکراری است" },
  });
  assert.equal(formatQuickAddApiError(err), "نام مقصد تکراری است");
});

test("formatQuickAddApiError falls back for unknown errors", () => {
  assert.equal(formatQuickAddApiError(null, "خطای سفارشی"), "خطای سفارشی");
});

import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, extractRequestIdFromResponse } from "./api-client";

test("extractRequestIdFromResponse prefers top-level requestId", () => {
  const id = extractRequestIdFromResponse({
    success: false,
    requestId: "top-level-id",
    error: { details: { requestId: "details-id" } },
  });
  assert.equal(id, "top-level-id");
});

test("extractRequestIdFromResponse falls back to error.details.requestId", () => {
  const id = extractRequestIdFromResponse({
    error: { details: { requestId: "details-id" } },
  });
  assert.equal(id, "details-id");
});

test("extractRequestIdFromResponse reads x-request-id header", () => {
  const id = extractRequestIdFromResponse({}, { "x-request-id": "header-id" });
  assert.equal(id, "header-id");
});

test("ApiError stores requestId from envelope", () => {
  const err = new ApiError(
    "VALIDATION_FAILED",
    "Request validation failed",
    400,
    { requestId: "req-abc" },
    "req-abc",
  );
  assert.equal(err.requestId, "req-abc");
});

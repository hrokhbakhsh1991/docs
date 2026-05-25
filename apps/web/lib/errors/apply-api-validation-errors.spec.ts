import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/api-client";

import {
  applyApiValidationErrorsToForm,
  extractApiValidationErrors,
  handleDenaliWizardValidationApiError,
  mapApiValidationPathToDenaliFormPath,
} from "./apply-api-validation-errors";

test("extractApiValidationErrors reads error.details.validationErrors", () => {
  const err = new ApiError("VALIDATION_FAILED", "Request validation failed", 400, {
    error: {
      details: {
        validationErrors: [
          { path: "title", code: "minLength", message: "Title is too short." },
          { path: "tripDetails.logistics.gatheringPoints", code: "isArray", message: "Required." },
        ],
      },
    },
  });

  const rows = extractApiValidationErrors(err);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.path, "title");
  assert.equal(rows[1]?.path, "tripDetails.logistics.gatheringPoints");
});

test("mapApiValidationPathToDenaliFormPath maps API roots and passes tripDetails through", () => {
  assert.equal(mapApiValidationPathToDenaliFormPath("title"), "basicInfo.title");
  assert.equal(mapApiValidationPathToDenaliFormPath("total_capacity"), "basicInfo.capacityMax");
  assert.equal(
    mapApiValidationPathToDenaliFormPath("tripDetails.logistics.gatheringPoints"),
    "tripDetails.logistics.gatheringPoints",
  );
  assert.equal(mapApiValidationPathToDenaliFormPath("overview.title"), "basicInfo.title");
});

test("applyApiValidationErrorsToForm calls setError with server type", () => {
  const calls: Array<{ path: string; message: string }> = [];
  const setError = ((path: string, opts: { message: string }) => {
    calls.push({ path, message: opts.message });
  }) as Parameters<typeof applyApiValidationErrorsToForm>[0];

  const applied = applyApiValidationErrorsToForm(setError, [
    { path: "title", code: "minLength", message: "Too short" },
    { path: "not_a_real_field", code: "x", message: "Skip me" },
  ]);

  assert.equal(applied, 1);
  assert.deepEqual(calls, [{ path: "basicInfo.title", message: "Too short" }]);
});

test("handleDenaliWizardValidationApiError returns false for non-validation errors", () => {
  const err = new ApiError("FORBIDDEN", "Denied", 403);
  assert.equal(
    handleDenaliWizardValidationApiError(err, (() => {}) as Parameters<typeof handleDenaliWizardValidationApiError>[1]),
    false,
  );
});

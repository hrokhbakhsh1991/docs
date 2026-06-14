import assert from "node:assert/strict";
import test from "node:test";

import { mapTourPatchErrorCode } from "../src/tours/tour-edit-error-logic";

test("mapTourPatchErrorCode maps auth codes to stable edit keys", () => {
  assert.equal(
    mapTourPatchErrorCode("AUTH_TOKEN_REVOKED", 401),
    "TOUR_EDIT_AUTH_TOKEN_REVOKED"
  );
  assert.equal(
    mapTourPatchErrorCode("AUTH_UNAUTHENTICATED", 401),
    "TOUR_EDIT_AUTH_UNAUTHENTICATED"
  );
});

test("mapTourPatchErrorCode passes through TOUR_* codes", () => {
  assert.equal(
    mapTourPatchErrorCode("TOUR_NOT_FOUND", 404),
    "TOUR_NOT_FOUND"
  );
});

test("mapTourPatchErrorCode falls back to HTTP status key", () => {
  assert.equal(mapTourPatchErrorCode("", 409), "TOUR_EDIT_HTTP_409");
  assert.equal(mapTourPatchErrorCode("UNKNOWN", 500), "TOUR_EDIT_HTTP_500");
});

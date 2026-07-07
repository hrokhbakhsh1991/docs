import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertOperatorAvatarKeyScope,
  buildOperatorAvatarObjectKey,
  isOperatorAvatarContentType,
  isOperatorAvatarStorageKey,
} from "../src/operator/identity/operator-avatar";

const TENANT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("operator-avatar.spec.ts", () => {
  it("buildOperatorAvatarObjectKey is tenant and user scoped", () => {
    const key = buildOperatorAvatarObjectKey(TENANT_ID, USER_ID);
    assert.equal(key, `${TENANT_ID}/operators/${USER_ID}/avatar`);
    assert.equal(isOperatorAvatarStorageKey(key), true);
    assert.throws(() =>
      assertOperatorAvatarKeyScope(key, "00000000-0000-4000-8000-000000000099", USER_ID)
    );
  });

  it("isOperatorAvatarContentType allows raster only", () => {
    assert.equal(isOperatorAvatarContentType("image/png"), true);
    assert.equal(isOperatorAvatarContentType("image/svg+xml"), false);
  });

  it("rejects non-avatar storage keys", () => {
    assert.equal(isOperatorAvatarStorageKey(`${TENANT_ID}/branding/logo`), false);
    assert.equal(
      isOperatorAvatarStorageKey(`${TENANT_ID}/tours/t1/photos/p1`),
      false
    );
  });
});

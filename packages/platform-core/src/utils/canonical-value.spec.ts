import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformCoreError } from "../errors/platform-core.error";
import { assertCanonicalValueMatchesKind } from "./canonical-value";

describe("assertCanonicalValueMatchesKind", () => {
  it("throws CANONICAL_TYPE_MISMATCH when text field receives a number", () => {
    assert.throws(
      () => assertCanonicalValueMatchesKind(123, "text", "basics.title"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });

  it("throws REQUIRED_FIELD_EMPTY for empty text", () => {
    assert.throws(
      () => assertCanonicalValueMatchesKind("  ", "text", "basics.title"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "REQUIRED_FIELD_EMPTY");
        return true;
      },
    );
  });

  it("rejects enum values when enumOptions matrix is absent", () => {
    assert.throws(
      () => assertCanonicalValueMatchesKind("draft", "enum", "basics.status"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        assert.match((error as PlatformCoreError).message, /enumOptions/);
        return true;
      },
    );
  });

  it("rejects enum tokens not in enumOptions", () => {
    assert.throws(
      () =>
        assertCanonicalValueMatchesKind("@@INVALID@@", "enum", "basics.status", {
          enumOptions: ["draft", "open"],
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });

  it("rejects loose enum tokens even when they match token shape", () => {
    assert.throws(
      () =>
        assertCanonicalValueMatchesKind("not-in-matrix", "enum", "basics.status", {
          enumOptions: ["draft", "open"],
        }),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });
});

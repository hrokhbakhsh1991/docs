import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { assertCanonicalValueMatchesKind } from "../../../src/utils/canonical-value.js";

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

  it("rejects composite values with unstable Proxy prototype", () => {
    let flip = false;
    const proxy = new Proxy(
      { nested: "ok" },
      {
        getPrototypeOf(): object | null {
          flip = !flip;
          return flip ? Object.prototype : null;
        },
      },
    );
    assert.throws(
      () => assertCanonicalValueMatchesKind(proxy, "composite", "widget.body"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });

  it("rejects composite values with hidden non-enumerable keys", () => {
    const poisoned: Record<string, unknown> = { nested: "ok" };
    Object.defineProperty(poisoned, "secret", {
      value: "tunnel",
      enumerable: false,
    });
    assert.throws(
      () => assertCanonicalValueMatchesKind(poisoned, "composite", "widget.body"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });

  it("accepts localized Persian digit strings for number fields", () => {
    assert.doesNotThrow(() =>
      assertCanonicalValueMatchesKind("۱۲", "number", "capacityMax")
    );
    assert.doesNotThrow(() =>
      assertCanonicalValueMatchesKind("5610", "number", "tripDetails.overview.peakHeight")
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformCoreError } from "../errors/platform-core.error";
import { getCanonicalValue, isEmptyCanonicalValue } from "./canonical-path";

describe("getCanonicalValue", () => {
  it("throws UNKNOWN_CANONICAL_PATH for forbidden path segments", () => {
    const data = { basics: { title: "ok" } };
    assert.throws(
      () => getCanonicalValue(data, "basics.__proto__.title"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "UNKNOWN_CANONICAL_PATH");
        return true;
      },
    );
    assert.equal(getCanonicalValue(data, "basics.title"), "ok");
  });

  it("throws CANONICAL_TYPE_MISMATCH when intermediate segment is a primitive", () => {
    const data = { basics: "not-an-object" };
    assert.throws(
      () => getCanonicalValue(data, "basics.title"),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });
});

describe("isEmptyCanonicalValue", () => {
  it("treats number 0 as non-empty for number kind", () => {
    assert.equal(isEmptyCanonicalValue(0, "number"), false);
  });

  it("treats false as non-empty for boolean kind", () => {
    assert.equal(isEmptyCanonicalValue(false, "boolean"), false);
  });

  it("treats empty string as empty for text kind", () => {
    assert.equal(isEmptyCanonicalValue("  ", "text"), true);
  });

  it("treats non-empty composite object as non-empty", () => {
    assert.equal(isEmptyCanonicalValue({ a: 1 }, "composite"), false);
  });

  it("does not treat wrong primitive as empty for text kind", () => {
    assert.equal(isEmptyCanonicalValue(42, "text"), false);
  });
});

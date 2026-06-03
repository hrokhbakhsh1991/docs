import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IngressSanitizationError } from "../../src/errors/ingress-sanitization-error.js";
import { parseCanonicalDocumentFromStorage } from "../../src/ingress/parse-canonical-document.js";
import { parseWorkspacePluginFromStorage } from "../../src/ingress/parse-workspace-plugin.js";
import { createFreshStarterPlugin, harnessCanonicalDocument } from "../lib/immutable-harness.js";

describe("invariant: storage-immutability", () => {
  it("deep-freezes canonical document data on ingress", () => {
    const raw = harnessCanonicalDocument();
    const parsed = parseCanonicalDocumentFromStorage(raw);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.data), true);
    assert.equal(Object.isFrozen(parsed.data.basics), true);
    assert.throws(() => {
      Object.defineProperty(parsed.data.basics as object, "title", { value: "tampered" });
    });
  });

  it("deep-freezes workspace plugin on ingress", () => {
    const parsed = parseWorkspacePluginFromStorage(createFreshStarterPlugin());
    assert.equal(Object.isFrozen(parsed.fieldRegistry), true);
    assert.throws(() => {
      (parsed.fieldRegistry.fields as unknown[]).push({});
    });
  });

  it("rejects accessor properties at ingress", () => {
    const raw = {
      schemaVersion: 1,
      roots: ["basics"],
      data: { basics: {} },
    };
    Object.defineProperty((raw.data.basics as Record<string, unknown>), "title", {
      get() {
        return "poison";
      },
      enumerable: true,
      configurable: true,
    });
    assert.throws(
      () => parseCanonicalDocumentFromStorage(raw),
      (error: unknown) => {
        assert.ok(error instanceof IngressSanitizationError);
        assert.equal(error.code, "ACCESSOR_PROPERTY");
        return true;
      },
    );
  });
});

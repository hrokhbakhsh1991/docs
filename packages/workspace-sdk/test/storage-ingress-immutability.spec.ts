import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseCanonicalDocumentFromStorage,
  parseWorkspacePluginFromStorage,
} from "../src/index";
import { createFreshStarterPlugin, pluginPayloadForStorageIngress } from "./lib/immutable-harness.js";

describe("storage ingress immutability", () => {
  it("parseCanonicalDocumentFromStorage deep-freezes nested document data", () => {
    const raw = {
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        basics: { title: "stored" },
      },
    };
    const parsed = parseCanonicalDocumentFromStorage(raw);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.data), true);
    assert.equal(Object.isFrozen(parsed.data.basics), true);
    assert.notEqual(parsed.data, raw.data);
    assert.throws(() => {
      Object.defineProperty(parsed.data.basics as object, "title", { value: "tampered" });
    });
  });

  it("parseWorkspacePluginFromStorage deep-freezes plugin roots", () => {
    const parsed = parseWorkspacePluginFromStorage(
      pluginPayloadForStorageIngress(createFreshStarterPlugin())
    );
    assert.throws(() => {
      (parsed.fieldRegistry.fields as unknown[]).push({});
    });
    assert.equal(Object.isFrozen(parsed.fieldRegistry), true);
  });

  it("parseCanonicalDocumentFromStorage rejects accessor properties", () => {
    const raw = {
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        basics: {},
      },
    };
    Object.defineProperty(
      (raw.data.basics as Record<string, unknown>),
      "title",
      {
        get() {
          return "poison";
        },
        enumerable: true,
        configurable: true,
      },
    );
    assert.throws(() => parseCanonicalDocumentFromStorage(raw));
  });
});

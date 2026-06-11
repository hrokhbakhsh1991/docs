import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanonicalPathSegments,
  assertWorkspacePlugin,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  isWorkspaceSdkValidationError,
} from "../src/index";
import { createFreshStarterPlugin } from "./lib/immutable-harness.js";

/** Cyrillic small letter i (U+0456) — visually similar to Latin i. */
const HOMOGLYPH_I = "\u0456";
const LATIN_TITLE_KEY = "title";
const HOMOGLYPH_TITLE_KEY = `t${HOMOGLYPH_I}tle`;

describe("adversarial canonical ingress", () => {
  it("rejects homoglyph segments in registry canonical paths", () => {
    assert.throws(
      () => assertCanonicalPathSegments(`basics.${HOMOGLYPH_TITLE_KEY}`),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects plugin fields whose canonicalPath contains unicode homoglyphs", () => {
    const badPlugin = {
      ...createFreshStarterPlugin(),

      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "basics.homoglyph",
            canonicalPath: `basics.${HOMOGLYPH_TITLE_KEY}`,
            stepId: "basics",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(badPlugin),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });

  it("does not treat NFC and NFD path segments as equivalent at ingress", () => {
    const nfc = "caf\u00e9";
    const nfd = "caf\u0301e";
    assert.notEqual(nfc, nfd);
    assert.throws(
      () => assertCanonicalPathSegments(`basics.${nfd}`),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects BigInt nested inside multi-layer composite trees at ingress", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["widget"],
          data: {
            widget: {
              body: {
                nested: {
                  depth: BigInt(42),
                },
              },
            },
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_FORBIDDEN_BIGINT");
        return true;
      },
    );
  });

  it("accepts registered ASCII paths when homoglyph sibling keys exist at rest", () => {
    const doc = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        basics: {
          [LATIN_TITLE_KEY]: "ok",
          [HOMOGLYPH_TITLE_KEY]: "poison-sibling",
        },
      },
    });
    assert.equal((doc.data.basics as Record<string, unknown>)[LATIN_TITLE_KEY], "ok");
    assert.equal(
      (doc.data.basics as Record<string, unknown>)[HOMOGLYPH_TITLE_KEY],
      "poison-sibling",
    );
  });
});

describe("adversarial canonical ingress — array policy", () => {
  it("accepts JSON arrays nested inside composite trees", () => {
    const doc = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["participants"],
      data: {
        participants: {
          gearItems: [
            { equipmentId: "eq-1", name: "Poles", isRequired: true },
          ],
        },
      },
    });
    const participants = doc.data.participants as Record<string, unknown>;
    assert.ok(Array.isArray(participants.gearItems));
    assert.equal((participants.gearItems as unknown[]).length, 1);
  });

  it("rejects sparse arrays at document ingress", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: {
            basics: [, "gap"],
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects array-like plain objects with numeric length at ingress", () => {
    assert.throws(
      () =>
        createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: {
            basics: {
              "0": "x",
              length: 9999,
            },
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });
});

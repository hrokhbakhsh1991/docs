import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanonicalPathSegments,
  CanonicalDocumentValidationError,
} from "../../src/canonical/canonical-document.js";
import { assertWorkspacePlugin } from "../../src/plugin/workspace-plugin-validation.js";
import { isWorkspaceSdkValidationError } from "../../src/errors/workspace-validation-errors.js";
import { createFreshStarterPlugin } from "../lib/immutable-harness.js";

const HOMOGLYPH_I = "\u0456";

describe("invariant: canonical-ingress", () => {
  it("rejects homoglyph path segments at ingress", () => {
    assert.throws(
      () => assertCanonicalPathSegments(`basics.t${HOMOGLYPH_I}tle`),
      (error: unknown) => {
        assert.ok(error instanceof CanonicalDocumentValidationError);
        assert.equal(error.code, "CANONICAL_INVALID_DATA");
        return true;
      },
    );
  });

  it("rejects plugin registry paths with homoglyphs", () => {
    const plugin = createFreshStarterPlugin();
    const bad = {
      ...plugin,
      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "basics.homoglyph",
            canonicalPath: `basics.t${HOMOGLYPH_I}tle`,
            stepId: "basics",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };
    assert.throws(
      () => assertWorkspacePlugin(bad),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "INVALID_FIELD_REGISTRY");
        return true;
      },
    );
  });
});

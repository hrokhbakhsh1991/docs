import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateFieldPolicyManifest,
  type WorkspaceFieldPolicyManifest,
} from "../src/registry/field-policy-manifest.js";
import { starterWorkspacePlugin } from "../src/reference/starter-workspace.plugin.js";

describe("field policy manifest contract", () => {
  it("accepts provider-agnostic starter reference manifest", () => {
    assert.ok(starterWorkspacePlugin.fieldPolicy);
    const knownFieldIds = new Set(starterWorkspacePlugin.fieldRegistry.fields.map((field) => field.id));
    validateFieldPolicyManifest(starterWorkspacePlugin.fieldPolicy, knownFieldIds);
  });

  it("rejects forbidden provider terms in manifest payload", () => {
    const manifest: WorkspaceFieldPolicyManifest = {
      manifestVersion: 1,
      definitions: [
        {
          id: "basics.title",
          canonicalPath: "basics.title",
          kind: "text",
        },
      ],
      rules: [
        {
          id: "telegram-rule",
          fieldId: "basics.title",
          surface: "delivery",
          state: "visible",
          priority: 1,
          enabled: true,
        },
      ],
    };

    assert.throws(
      () => validateFieldPolicyManifest(manifest, new Set(["basics.title"])),
      /FIELD_POLICY_MANIFEST_FORBIDDEN_TERM/,
    );
  });

  it("rejects unknown field ids", () => {
    const manifest: WorkspaceFieldPolicyManifest = {
      manifestVersion: 1,
      definitions: [],
      rules: [
        {
          id: "missing-field",
          fieldId: "unknown.field",
          surface: "delivery",
          state: "visible",
          priority: 1,
          enabled: true,
        },
      ],
    };

    assert.throws(
      () => validateFieldPolicyManifest(manifest, new Set()),
      /FIELD_POLICY_MANIFEST_UNKNOWN_FIELD/,
    );
  });
});

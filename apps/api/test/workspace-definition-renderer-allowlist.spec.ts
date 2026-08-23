import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { assertWorkspaceDefinitionRendererAllowlist } from "../src/platform/assert-workspace-definition-renderer-allowlist.ts";
import { PlatformRendererNotAllowed } from "../src/platform/platform.errors.ts";

function payloadFor(field: { id: string; canonicalPath: string; kind: string }) {
  return {
    fieldRegistry: { fields: [field] },
  } as WorkspaceDefinitionPayload;
}

describe("workspace definition renderer allowlist", () => {
  it("accepts primitive and registered platform renderers", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceDefinitionRendererAllowlist(
        payloadFor({
          id: "basics.title",
          canonicalPath: "basics.title",
          kind: "text",
        })
      )
    );
    assert.doesNotThrow(() =>
      assertWorkspaceDefinitionRendererAllowlist(
        payloadFor({
          id: "platform.photos",
          canonicalPath: "photos",
          kind: "composite",
        })
      )
    );
  });

  for (const rendererId of ["denali.unknown", "alpine.unknown", "foo.unknown"]) {
    it(`rejects unknown renderer ${rendererId}`, () => {
      assert.throws(
        () =>
          assertWorkspaceDefinitionRendererAllowlist(
            payloadFor({
              id: rendererId,
              canonicalPath: "details.value",
              kind: "composite",
            })
          ),
        (error: unknown) => {
          assert.ok(error instanceof PlatformRendererNotAllowed);
          assert.equal(error.rendererId, rendererId);
          assert.equal(error.message, `PLATFORM_RENDERER_NOT_ALLOWED:${rendererId}`);
          return true;
        }
      );
    });
  }

  it("contains no product-specific renderer acceptance branches", () => {
    const source = readFileSync(
      new URL("../src/platform/assert-workspace-definition-renderer-allowlist.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /denali|urban|workspace\./i);
    assert.doesNotMatch(source, /startsWith\(/);
  });
});

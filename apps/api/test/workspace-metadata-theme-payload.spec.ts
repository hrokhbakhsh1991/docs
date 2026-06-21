import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import {
  stripWorkspacePluginToDefinitionPayload,
  validateWorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";

import { adaptMetadataPayloadToWorkspacePlugin } from "../src/workspace-metadata/metadata-plugin-adapter.ts";

describe("workspace definition theme payload (P3-B-N-013)", () => {
  it("accepts semantic theme tokens on payload", () => {
    const payload = {
      ...stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin()),
      theme: {
        tokens: {
          "--ws-primary": "var(--color-primary)",
        },
      },
    };
    const result = validateWorkspaceDefinitionPayload(payload);
    assert.equal(result.ok, true);
  });

  it("rejects raw hex key at theme top level", () => {
    const payload = {
      ...stripWorkspacePluginToDefinitionPayload(getStarterWorkspacePlugin()),
      theme: {
        "#ff0000": "red",
      },
    };
    const result = validateWorkspaceDefinitionPayload(payload);
    assert.equal(result.ok, false);
  });

  it("adapter merges theme tokens into overlay cssVariables", () => {
    const overlay = getStarterWorkspacePlugin();
    const payload = {
      ...stripWorkspacePluginToDefinitionPayload(overlay),
      theme: {
        tokens: {
          "--ws-accent": "#0044aa",
        },
      },
    };
    const adapted = adaptMetadataPayloadToWorkspacePlugin(payload, overlay);
    assert.equal(adapted.theme?.cssVariables["--ws-accent"], "#0044aa");
    assert.match(Object.keys(adapted.theme?.cssVariables ?? {}).join(","), /--ws-/);
  });
});

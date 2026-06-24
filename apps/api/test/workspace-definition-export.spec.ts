import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import {
  stripWorkspacePluginToDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
import { computeWorkspaceDefinitionPayloadChecksum } from "@app-tour/workspace-sdk/metadata/checksum";

import {
  buildWorkspaceDefinitionExport,
  parseWorkspaceDefinitionExportFile,
} from "../src/workspace-metadata/build-workspace-definition-export.ts";

describe("buildWorkspaceDefinitionExport", () => {
  it("builds valid export envelope for starter plugin", () => {
    const plugin = getStarterWorkspacePlugin();
    const exported = buildWorkspaceDefinitionExport({
      plugin,
      meta: {
        definitionId: "starter-shell",
        displayName: "Starter Shell",
        workspaceType: "starter",
      },
    });
    assert.equal(exported.version, 1);
    assert.equal(exported.payload.id, plugin.id);
    assert.equal(exported.checksum, computeWorkspaceDefinitionPayloadChecksum(exported.payload));
    const roundTrip = parseWorkspaceDefinitionExportFile(exported);
    assert.deepEqual(roundTrip.payload, exported.payload);
  });

  it("rejects checksum mismatch on parse", () => {
    const plugin = getStarterWorkspacePlugin();
    const exported = buildWorkspaceDefinitionExport({
      plugin,
      meta: {
        definitionId: "starter-shell",
        displayName: "Starter Shell",
        workspaceType: "starter",
      },
    });
    const tampered = {
      ...exported,
      checksum: "0".repeat(64),
    };
    assert.throws(() => parseWorkspaceDefinitionExportFile(tampered), /CHECKSUM_MISMATCH/);
  });

  it("strip + export matches payload-only shape", () => {
    const plugin = getStarterWorkspacePlugin();
    const payload = stripWorkspacePluginToDefinitionPayload(plugin);
    const exported = buildWorkspaceDefinitionExport({
      plugin,
      meta: {
        definitionId: "starter-shell",
        displayName: "Starter Shell",
        workspaceType: "starter",
      },
    });
    assert.deepEqual(exported.payload, payload);
    assert.equal("validation" in exported.payload, false);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";
import { computeWorkspaceDefinitionPayloadChecksum } from "@app-tour/workspace-sdk/metadata/checksum";

import {
  buildWorkspaceDefinitionExport,
  parseWorkspaceDefinitionExportFile,
} from "../src/workspace-metadata/build-workspace-definition-export.ts";
import { parseWorkspaceDefinitionExportArgs } from "../scripts/export-workspace-definition.ts";

describe("buildWorkspaceDefinitionExport", () => {
  it("keeps product export presets out of the generic workspace metadata builder", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/workspace-metadata/build-workspace-definition-export.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /DEFAULT_WORKSPACE_DEFINITION_EXPORTS/);
    assert.doesNotMatch(source, /denali-tour-ops|starter-shell|urban-minimal/);
  });

  it("requires explicit workspace in export script args", () => {
    assert.throws(
      () => parseWorkspaceDefinitionExportArgs(["node", "export-workspace-definition.ts"]),
      /WORKSPACE_DEFINITION_EXPORT_WORKSPACE_REQUIRED/
    );

    const parsed = parseWorkspaceDefinitionExportArgs([
      "node",
      "export-workspace-definition.ts",
      "--workspace",
      "starter",
    ]);
    assert.equal(parsed.workspace, "starter");
    assert.match(parsed.out, /starter-v1\.json$/);
  });

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

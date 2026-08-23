import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import {
  buildWorkspaceDefinitionExport,
  parseWorkspaceDefinitionExportFile,
  type WorkspaceDefinitionExportFile,
  type WorkspaceDefinitionExportMeta,
} from "../../src/workspace-metadata/build-workspace-definition-export.ts";
import { resolveWorkspacePluginForType } from "../../src/workspace/resolve-workspace-plugin.ts";

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DENALI_WORKSPACE_DEFINITION_EXPORT_META: WorkspaceDefinitionExportMeta = {
  definitionId: "denali-tour-ops",
  displayName: "Denali Tour Ops",
  workspaceType: "denali",
};

export function loadDenaliSeedExport(): WorkspaceDefinitionExportFile {
  const raw = JSON.parse(
    readFileSync(join(API_ROOT, "scripts/seed/definitions/denali-v1.json"), "utf8")
  ) as unknown;
  return parseWorkspaceDefinitionExportFile(raw);
}

export async function buildLiveDenaliExport(): Promise<WorkspaceDefinitionExportFile> {
  const plugin = await resolveWorkspacePluginForType("denali");
  return buildWorkspaceDefinitionExport({
    plugin,
    meta: DENALI_WORKSPACE_DEFINITION_EXPORT_META,
  });
}

export function stripDataSurfaces(plugin: WorkspacePlugin): {
  readonly fieldRegistry: WorkspacePlugin["fieldRegistry"];
  readonly ruleSet: WorkspacePlugin["ruleSet"];
  readonly wizard: WorkspacePlugin["wizard"];
} {
  return {
    fieldRegistry: plugin.fieldRegistry,
    ruleSet: plugin.ruleSet,
    wizard: plugin.wizard,
  };
}

export function stripDataSurfacesFromPayload(
  payload: ReturnType<typeof stripWorkspacePluginToDefinitionPayload>
) {
  return {
    fieldRegistry: payload.fieldRegistry,
    ruleSet: payload.ruleSet,
    wizard: payload.wizard,
  };
}

export function listFieldIds(pluginOrPayload: {
  fieldRegistry: WorkspacePlugin["fieldRegistry"];
}): readonly string[] {
  return pluginOrPayload.fieldRegistry.fields.map((field) => field.id);
}

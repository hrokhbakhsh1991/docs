import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import {
  buildWorkspaceDefinitionExport,
  DEFAULT_WORKSPACE_DEFINITION_EXPORTS,
  parseWorkspaceDefinitionExportFile,
  type WorkspaceDefinitionExportFile,
} from "../../src/workspace-metadata/build-workspace-definition-export.ts";
import { resolveWorkspacePluginForType } from "../../src/workspace/resolve-workspace-plugin.ts";

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function loadDenaliSeedExport(): WorkspaceDefinitionExportFile {
  const raw = JSON.parse(
    readFileSync(join(API_ROOT, "scripts/seed/definitions/denali-v1.json"), "utf8")
  ) as unknown;
  return parseWorkspaceDefinitionExportFile(raw);
}

export function buildLiveDenaliExport(): WorkspaceDefinitionExportFile {
  const plugin = resolveWorkspacePluginForType("denali");
  return buildWorkspaceDefinitionExport({
    plugin,
    meta: DEFAULT_WORKSPACE_DEFINITION_EXPORTS.denali,
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

export function stripDataSurfacesFromPayload(payload: ReturnType<typeof stripWorkspacePluginToDefinitionPayload>) {
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

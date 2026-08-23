import {
  assertWorkspaceDefinitionPayload,
  stripWorkspacePluginToDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
import { computeWorkspaceDefinitionPayloadChecksum } from "@app-tour/workspace-sdk/metadata/checksum";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

export type WorkspaceDefinitionExportMeta = {
  readonly definitionId: string;
  readonly displayName: string;
  readonly workspaceType: string;
};

export type WorkspaceDefinitionExportFile = WorkspaceDefinitionExportMeta & {
  readonly version: number;
  readonly payload: WorkspaceDefinitionPayload;
  readonly checksum: string;
};

export function buildWorkspaceDefinitionExport(input: {
  plugin: WorkspacePlugin;
  meta: WorkspaceDefinitionExportMeta;
  version?: number;
}): WorkspaceDefinitionExportFile {
  const payload = stripWorkspacePluginToDefinitionPayload(input.plugin);
  assertWorkspaceDefinitionPayload(payload);
  const checksum = computeWorkspaceDefinitionPayloadChecksum(payload);
  return {
    ...input.meta,
    version: input.version ?? 1,
    payload,
    checksum,
  };
}

export function parseWorkspaceDefinitionExportFile(raw: unknown): WorkspaceDefinitionExportFile {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_INVALID");
  }
  const record = raw as Record<string, unknown>;
  const definitionId = record.definitionId;
  const displayName = record.displayName;
  const workspaceType = record.workspaceType;
  const version = record.version;
  const payload = record.payload;
  const checksum = record.checksum;
  if (typeof definitionId !== "string" || definitionId.length === 0) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_INVALID:definitionId");
  }
  if (typeof displayName !== "string" || displayName.length === 0) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_INVALID:displayName");
  }
  if (typeof workspaceType !== "string" || workspaceType.length === 0) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_INVALID:workspaceType");
  }
  if (typeof version !== "number" || !Number.isFinite(version)) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_INVALID:version");
  }
  if (typeof checksum !== "string" || checksum.length === 0) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_INVALID:checksum");
  }
  if (typeof assertWorkspaceDefinitionPayload === "function") {
    assertWorkspaceDefinitionPayload(payload);
  }
  const typedPayload = payload as WorkspaceDefinitionPayload;
  const expected = computeWorkspaceDefinitionPayloadChecksum(typedPayload);
  if (checksum !== expected) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_CHECKSUM_MISMATCH");
  }
  return {
    definitionId,
    displayName,
    workspaceType,
    version,
    payload: typedPayload,
    checksum,
  };
}

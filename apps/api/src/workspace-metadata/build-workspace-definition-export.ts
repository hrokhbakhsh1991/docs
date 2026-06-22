import {
  assertWorkspaceDefinitionPayload,
  computeWorkspaceDefinitionPayloadChecksum,
  stripWorkspacePluginToDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";
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

export const DEFAULT_WORKSPACE_DEFINITION_EXPORTS: Readonly<
  Record<string, WorkspaceDefinitionExportMeta>
> = {
  denali: {
    definitionId: "denali-tour-ops",
    displayName: "Denali Tour Ops",
    workspaceType: "denali",
  },
  starter: {
    definitionId: "starter-shell",
    displayName: "Starter Shell",
    workspaceType: "starter",
  },
  urban: {
    definitionId: "urban-minimal",
    displayName: "Urban Minimal",
    workspaceType: "urban",
  },
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
  const expected = computeWorkspaceDefinitionPayloadChecksum(payload);
  if (checksum !== expected) {
    throw new Error("WORKSPACE_DEFINITION_EXPORT_CHECKSUM_MISMATCH");
  }
  return {
    definitionId,
    displayName,
    workspaceType,
    version,
    payload,
    checksum,
  };
}

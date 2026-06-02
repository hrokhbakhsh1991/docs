import type { DraftFieldConflict, DraftMergeResult, DraftSnapshot } from "@repo/shared-contracts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isDenaliWizardDraftData(data: unknown): data is Record<string, unknown> & {
  form: unknown;
  currentStepIndex: number;
} {
  if (!isPlainObject(data)) {
    return false;
  }
  return data.form != null && typeof data.currentStepIndex === "number";
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mergeDenaliWizardData(
  clientData: Record<string, unknown>,
  serverData: Record<string, unknown>,
  conflicts: DraftFieldConflict[]
): Record<string, unknown> {
  const clientStep = clientData.currentStepIndex;
  const serverStep = serverData.currentStepIndex;
  const clientRail = readOptionalNumber(clientData.railLayoutVersion) ?? 1;
  const serverRail = readOptionalNumber(serverData.railLayoutVersion) ?? 1;
  const clientRegistry = readOptionalNumber(clientData.registryLayoutVersion) ?? 1;
  const serverRegistry = readOptionalNumber(serverData.registryLayoutVersion) ?? 1;

  const mergedRail = Math.max(clientRail, serverRail);
  const mergedRegistry = Math.max(clientRegistry, serverRegistry);

  if (clientStep !== serverStep) {
    conflicts.push({
      path: "data.currentStepIndex",
      clientValue: clientStep,
      serverValue: serverStep,
      resolvedValue: clientStep,
      resolution: "client",
    });
  }
  if (clientRail !== serverRail) {
    conflicts.push({
      path: "data.railLayoutVersion",
      clientValue: clientRail,
      serverValue: serverRail,
      resolvedValue: mergedRail,
      resolution: "merged",
    });
  }
  if (clientRegistry !== serverRegistry) {
    conflicts.push({
      path: "data.registryLayoutVersion",
      clientValue: clientRegistry,
      serverValue: serverRegistry,
      resolvedValue: mergedRegistry,
      resolution: "merged",
    });
  }

  const clientForm = isPlainObject(clientData.form) ? clientData.form : {};
  const serverForm = isPlainObject(serverData.form) ? serverData.form : {};
  const mergedForm = { ...serverForm, ...clientForm };

  for (const key of new Set([...Object.keys(serverForm), ...Object.keys(clientForm)])) {
    const clientValue = clientForm[key];
    const serverValue = serverForm[key];
    if (!Object.is(clientValue, serverValue) && key in clientForm && key in serverForm) {
      conflicts.push({
        path: `data.form.${key}`,
        clientValue,
        serverValue,
        resolvedValue: mergedForm[key],
        resolution: "client",
      });
    }
  }

  return {
    ...serverData,
    ...clientData,
    currentStepIndex: clientStep,
    railLayoutVersion: mergedRail,
    registryLayoutVersion: mergedRegistry,
    form: mergedForm,
  };
}

function isLeaf(value: unknown): boolean {
  return value == null || typeof value !== "object";
}

function mergeGenericData(
  clientData: unknown,
  serverData: unknown,
  clientWins: boolean,
  pathPrefix: string,
  conflicts: DraftFieldConflict[]
): unknown {
  if (Object.is(clientData, serverData)) {
    return clientData;
  }

  if (isLeaf(clientData) || isLeaf(serverData)) {
    const resolvedValue = clientWins ? clientData : serverData;
    if (!Object.is(clientData, serverData)) {
      conflicts.push({
        path: pathPrefix || "data",
        clientValue: clientData,
        serverValue: serverData,
        resolvedValue,
        resolution: clientWins ? "client" : "server",
      });
    }
    return resolvedValue;
  }

  if (Array.isArray(clientData) || Array.isArray(serverData)) {
    const resolvedValue = clientWins ? clientData : serverData;
    if (!Object.is(clientData, serverData)) {
      conflicts.push({
        path: pathPrefix || "data",
        clientValue: clientData,
        serverValue: serverData,
        resolvedValue,
        resolution: clientWins ? "client" : "server",
      });
    }
    return resolvedValue;
  }

  const clientRecord = isPlainObject(clientData) ? clientData : {};
  const serverRecord = isPlainObject(serverData) ? serverData : {};
  const keys = new Set([...Object.keys(clientRecord), ...Object.keys(serverRecord)]);
  const merged: Record<string, unknown> = {};

  for (const key of keys) {
    const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const hasClient = Object.prototype.hasOwnProperty.call(clientRecord, key);
    const hasServer = Object.prototype.hasOwnProperty.call(serverRecord, key);

    if (hasClient && !hasServer) {
      merged[key] = clientRecord[key];
      continue;
    }
    if (hasServer && !hasClient) {
      merged[key] = serverRecord[key];
      continue;
    }

    merged[key] = mergeGenericData(
      clientRecord[key],
      serverRecord[key],
      clientWins,
      nextPath,
      conflicts
    );
  }

  return merged;
}

export function deterministicDraftMerge(
  clientDraft: DraftSnapshot,
  serverDraft: DraftSnapshot
): DraftMergeResult {
  const conflicts: DraftFieldConflict[] = [];
  const clientWins = clientDraft.lastModified >= serverDraft.lastModified;

  let mergedData: unknown;
  if (isDenaliWizardDraftData(clientDraft.data) && isDenaliWizardDraftData(serverDraft.data)) {
    mergedData = mergeDenaliWizardData(
      clientDraft.data as Record<string, unknown>,
      serverDraft.data as Record<string, unknown>,
      conflicts
    );
  } else {
    mergedData = mergeGenericData(clientDraft.data, serverDraft.data, clientWins, "data", conflicts);
  }

  const merged: DraftSnapshot = {
    data: mergedData as Record<string, unknown>,
    version: serverDraft.version,
    schemaVersion: Math.max(clientDraft.schemaVersion, serverDraft.schemaVersion),
    lastModified: Math.max(clientDraft.lastModified, serverDraft.lastModified, Date.now()),
  };

  return {
    merged,
    conflicts,
    hadConflicts: conflicts.length > 0,
  };
}

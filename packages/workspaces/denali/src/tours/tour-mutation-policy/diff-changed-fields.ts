import { DENALI_TOUR_MUTATION_FIELD_BINDINGS } from "./field-matrix";
import { canonicalValuesEqual, readCanonicalValueAtDataPath } from "./read-canonical-value";

export function listDenaliTourMutationChangedFields(input: {
  readonly beforeData: Record<string, unknown>;
  readonly afterData: Record<string, unknown>;
}): readonly string[] {
  const changed: string[] = [];
  for (const binding of DENALI_TOUR_MUTATION_FIELD_BINDINGS) {
    const before = readFirstPresentValue(input.beforeData, binding.dataPaths);
    const after = readFirstPresentValue(input.afterData, binding.dataPaths);
    if (!canonicalValuesEqual(before, after)) {
      changed.push(binding.canonicalPath);
    }
  }
  return Object.freeze(changed);
}

function readFirstPresentValue(
  data: Record<string, unknown>,
  paths: readonly string[]
): unknown {
  for (const path of paths) {
    const value = readCanonicalValueAtDataPath(data, path);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export function readDenaliCapacityMax(data: Record<string, unknown>): number | undefined {
  const raw =
    readCanonicalValueAtDataPath(data, "basicInfo.capacityMax") ??
    readCanonicalValueAtDataPath(data, "capacityMax");
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

export function readDenaliTransportAllocationsLocked(
  data: Record<string, unknown>
): boolean {
  const transport = readCanonicalValueAtDataPath(data, "transport");
  if (transport === null || typeof transport !== "object" || Array.isArray(transport)) {
    return false;
  }
  const allocations = (transport as Record<string, unknown>).allocations;
  return Array.isArray(allocations) && allocations.length > 0;
}

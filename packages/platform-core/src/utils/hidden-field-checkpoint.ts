import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk";

export type HiddenFieldCheckpoint = {
  readonly documentData: unknown;
  readonly kind: WorkspaceFieldKind;
  readonly tag: unknown;
};

/**
 * Lightweight kind gate for hidden fields — no PlatformCoreError allocation.
 */
export function passesHiddenFieldKindGate(
  value: unknown,
  kind: WorkspaceFieldKind,
  enumOptions?: readonly string[],
): boolean {
  switch (kind) {
    case "text":
      return typeof value === "string" && value.length > 0 && value.trim().length > 0;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string" && value.length >= 10;
    case "enum":
      if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
        return false;
      }
      return enumOptions != null && enumOptions.length > 0 && enumOptions.includes(value);
    case "composite":
      return (
        value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value as object).length > 0
      );
    default:
      return false;
  }
}

export function matchesHiddenFieldCheckpoint(
  checkpoint: HiddenFieldCheckpoint,
  documentData: unknown,
  kind: WorkspaceFieldKind,
  value: unknown,
): boolean {
  return (
    checkpoint.documentData === documentData &&
    checkpoint.kind === kind &&
    Object.is(checkpoint.tag, value)
  );
}

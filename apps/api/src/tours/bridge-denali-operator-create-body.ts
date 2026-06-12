import type { CreateTourBody } from "./create-tour.schema";
import { OPERATOR_SMOKE_TENANT_ID } from "../settings/seed-operator-smoke-catalog";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readTrimmedString(source: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (!isRecord(current)) {
      return "";
    }
    current = current[part];
  }
  return typeof current === "string" ? current.trim() : "";
}

/** Starter ingress uses nested `basics` / `details` — full Denali payloads use plugin roots or flat paths. */
export function isStarterShapedDenaliCreateBody(body: CreateTourBody): boolean {
  if (body.roots !== undefined && body.roots.length > 0) {
    const denaliRoots = body.roots.some(
      (root) =>
        root.startsWith("denali_") ||
        root === "program" ||
        root === "transport" ||
        root === "participants" ||
        root === "tripDetails"
    );
    if (denaliRoots) {
      return false;
    }
  }

  const data = body.data;
  if (!isRecord(data)) {
    return false;
  }

  return "basics" in data || "details" in data;
}

function hasOperatorMinimalCreateShape(data: Record<string, unknown>): boolean {
  const title = readTrimmedString(data, "basics.title");
  const summary = readTrimmedString(data, "details.summary");
  return title.length > 0 && summary.length > 0;
}

/**
 * Operator smoke POST /tours (SMK-P9-02) still sends starter ingress until Phase 11.7.
 * Validate with starter plugin; enrich persisted canonical for Denali list projection.
 */
export function shouldUseStarterValidationForDenaliCreate(
  workspaceType: string,
  tenantId: string,
  body: CreateTourBody
): boolean {
  const data = body.data;
  return (
    workspaceType === "denali" &&
    tenantId.trim() === OPERATOR_SMOKE_TENANT_ID &&
    isStarterShapedDenaliCreateBody(body) &&
    isRecord(data) &&
    hasOperatorMinimalCreateShape(data)
  );
}

export function pickStarterCreateDataForValidation(data: Record<string, unknown>): {
  readonly createData: Record<string, unknown>;
  readonly category?: string;
} {
  const category =
    typeof data.category === "string" && data.category.trim().length > 0
      ? data.category.trim()
      : undefined;
  return {
    createData: {
      basics: data.basics,
      details: data.details,
    },
    category,
  };
}

export function enrichStarterDocumentForDenaliOperatorList(
  document: import("@app-tour/workspace-sdk").CanonicalDocument,
  extras?: { readonly category?: string }
): import("@app-tour/workspace-sdk").CanonicalDocument {
  const data = structuredClone(document.data) as Record<string, unknown>;
  const title = readTrimmedString(data, "basics.title");
  if (title.length > 0) {
    data.title = title;
  }
  const summary = readTrimmedString(data, "details.summary");
  if (summary.length > 0) {
    const existingProgram = isRecord(data.program) ? data.program : {};
    data.program = { ...existingProgram, shortDescription: summary };
  }
  if (extras?.category !== undefined && extras.category.length > 0) {
    data.category = extras.category;
  }
  const roots = Object.keys(data).sort();
  return { ...document, roots, data };
}

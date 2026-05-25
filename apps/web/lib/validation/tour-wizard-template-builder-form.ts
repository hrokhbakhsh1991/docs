import type { UseFormSetError } from "react-hook-form";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { DenaliWorkspaceTemplatePayload, UniversalValidationIssue } from "@/lib/validation/universal-validator";

export type TourWizardTemplateBuilderFormValues = {
  fieldRulesOverlay: Record<string, { visibility: string; required: string }>;
  canonicalDataJson: string;
};

function readOverlayPatch(
  overlay: Readonly<Record<string, unknown>>,
  path: string,
): { visibility: string; required: string } {
  const raw = overlay[path];
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { visibility: "", required: "" };
  }
  const row = raw as Record<string, unknown>;
  return {
    visibility: typeof row.visibility === "string" ? row.visibility : "",
    required: typeof row.required === "string" ? row.required : "",
  };
}

export function buildTourWizardTemplateBuilderDefaults(
  template: TenantWizardTemplate | null,
  fieldPaths: readonly string[],
): TourWizardTemplateBuilderFormValues {
  const overlay = template?.fieldRulesOverlay ?? {};
  const fieldRulesOverlay: Record<string, { visibility: string; required: string }> = {};
  for (const path of fieldPaths) {
    fieldRulesOverlay[path] = readOverlayPatch(overlay, path);
  }

  const canonical = template?.canonicalData ?? {};
  const canonicalDataJson =
    Object.keys(canonical).length > 0 ? JSON.stringify(canonical, null, 2) : "";

  return { fieldRulesOverlay, canonicalDataJson };
}

export function buildTourWizardTemplatePayloadFromForm(
  values: TourWizardTemplateBuilderFormValues,
): DenaliWorkspaceTemplatePayload {
  const fieldRulesOverlay: Record<string, unknown> = {};

  for (const [path, row] of Object.entries(values.fieldRulesOverlay)) {
    const entry: Record<string, string> = {};
    const visibility = row.visibility?.trim() ?? "";
    const required = row.required?.trim() ?? "";
    if (visibility) {
      entry.visibility = visibility;
    }
    if (required) {
      entry.required = required;
    }
    if (Object.keys(entry).length > 0) {
      fieldRulesOverlay[path] = entry;
    }
  }

  const trimmed = values.canonicalDataJson.trim();
  let canonicalData: unknown = {};
  if (trimmed) {
    canonicalData = JSON.parse(trimmed) as unknown;
  }

  return { fieldRulesOverlay, canonicalData };
}

export function applyUniversalValidationIssuesToForm(
  setError: UseFormSetError<TourWizardTemplateBuilderFormValues>,
  issues: readonly UniversalValidationIssue[],
): void {
  for (const issue of issues) {
    const path = issue.path.trim();
    if (!path) {
      continue;
    }
    if (path === "canonicalData" || path.startsWith("canonicalData.")) {
      setError("canonicalDataJson", { type: "manual", message: issue.message });
      continue;
    }
    if (path.startsWith("fieldRulesOverlay.")) {
      const suffix = path.slice("fieldRulesOverlay.".length);
      const dot = suffix.indexOf(".");
      if (dot === -1) {
        setError(`fieldRulesOverlay.${suffix}.visibility`, { type: "manual", message: issue.message });
      } else {
        const fieldPath = suffix.slice(0, dot);
        const prop = suffix.slice(dot + 1);
        if (prop === "visibility" || prop === "required") {
          setError(`fieldRulesOverlay.${fieldPath}.${prop}`, {
            type: "manual",
            message: issue.message,
          });
        }
      }
    }
  }
}

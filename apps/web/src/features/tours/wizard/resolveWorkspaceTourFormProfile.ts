import {
  DEFAULT_TOUR_FORM_PROFILE,
  isTourFormProfile,
  normalizeTourFormProfileInput,
  type TourFormProfile,
} from "@repo/types";

import type {
  TenantWizardTemplate,
  TenantWizardTemplateEnvelope,
} from "@/features/tours/wizard/template/tenant-wizard-template.types";

export type WorkspaceTourFormProfileSource =
  | "template.baseProfile"
  | "template.base_profile"
  | "envelope.baseProfile"
  | "template.formProfile"
  | "canonicalData.formProfile"
  | "workspaceSettings.profile"
  | "missing";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readProfileString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Walk JSON and list dot-paths where a string leaf equals `needle` (e.g. `urban_event`).
 * Use in devtools to find which template key carries the workspace profile.
 */
export function findTourFormProfileValuePaths(
  source: unknown,
  needle = "urban_event",
): string[] {
  const paths: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (node === needle) {
      paths.push(path || "<root>");
    }
    if (node == null || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, path ? `${path}.${key}` : key);
    }
  };
  walk(source, "");
  return paths;
}

type ProfileCandidate = { readonly value: string; readonly source: WorkspaceTourFormProfileSource };

function collectProfileCandidates(
  source: TenantWizardTemplateEnvelope | TenantWizardTemplate | null | undefined,
): ProfileCandidate[] {
  if (source == null) {
    return [];
  }

  const envelope = "template" in source ? asRecord(source) : null;
  const template =
    envelope != null
      ? asRecord(envelope.template)
      : asRecord(source);

  const canonicalData = template != null ? asRecord(template.canonicalData) : null;
  const workspaceSettings =
    template != null
      ? asRecord(template.workspaceSettings)
      : envelope != null
        ? asRecord(envelope.workspaceSettings)
        : null;

  const candidates: Array<ProfileCandidate | null> = [
    template?.baseProfile != null
      ? { value: String(template.baseProfile), source: "template.baseProfile" }
      : null,
    readProfileString(template?.base_profile) != null
      ? { value: readProfileString(template?.base_profile)!, source: "template.base_profile" }
      : null,
    envelope?.baseProfile != null
      ? { value: String(envelope.baseProfile), source: "envelope.baseProfile" }
      : null,
    readProfileString(template?.formProfile) != null
      ? { value: readProfileString(template?.formProfile)!, source: "template.formProfile" }
      : null,
    readProfileString(canonicalData?.formProfile) != null
      ? { value: readProfileString(canonicalData?.formProfile)!, source: "canonicalData.formProfile" }
      : null,
    readProfileString(workspaceSettings?.profile) != null
      ? { value: readProfileString(workspaceSettings?.profile)!, source: "workspaceSettings.profile" }
      : null,
  ];

  return candidates.filter((row): row is ProfileCandidate => row != null);
}

/** Dev-only: which template JSON paths were considered before normalization. */
export function debugWorkspaceTourFormProfileResolution(
  source: TenantWizardTemplateEnvelope | TenantWizardTemplate | null | undefined,
): {
  candidates: readonly ProfileCandidate[];
  chosen: TourFormProfile;
  source: WorkspaceTourFormProfileSource;
  urbanEventPaths: string[];
} {
  const candidates = collectProfileCandidates(source);
  const urbanEventPaths = findTourFormProfileValuePaths(source, "urban_event");
  for (const candidate of candidates) {
    if (isTourFormProfile(candidate.value)) {
      return {
        candidates,
        chosen: candidate.value,
        source: candidate.source,
        urbanEventPaths,
      };
    }
  }
  return {
    candidates,
    chosen: DEFAULT_TOUR_FORM_PROFILE,
    source: "missing",
    urbanEventPaths,
  };
}

/**
 * Web mirror of API {@link resolveWorkspaceTourFormProfile} (map-phase §1).
 * Primary authority: `workspace_tour_wizard_templates.base_profile` (`baseProfile` on the template row).
 * Fallbacks cover snake_case API payloads and legacy/nested profile keys in template JSON.
 */
export function resolveWorkspaceTourFormProfileFromTemplate(
  source: TenantWizardTemplateEnvelope | TenantWizardTemplate | null | undefined,
): TourFormProfile {
  const debug = debugWorkspaceTourFormProfileResolution(source);
  return debug.chosen;
}

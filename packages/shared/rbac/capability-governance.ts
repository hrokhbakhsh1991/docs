import { WORKSPACE_CAPABILITY_VALUES, type RegisteredWorkspaceCapability } from "./capability-registry";

export type CapabilityRiskLevel = "low" | "medium" | "high";

export type CapabilityGovernanceRecord = {
  readonly key: RegisteredWorkspaceCapability;
  readonly description: string;
  readonly owner: string;
  readonly module: string;
  readonly riskLevel: CapabilityRiskLevel;
};

/** Documented capability registry — CI validates completeness via `check-capability-governance.mjs`. */
export const CAPABILITY_GOVERNANCE_REGISTRY: readonly CapabilityGovernanceRecord[] = [
  {
    key: "tour.create",
    description: "Create draft tours",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "medium",
  },
  {
    key: "tour.read",
    description: "Read tours in tenant scope",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "low",
  },
  {
    key: "tour.update.core",
    description: "Patch core tour fields and lifecycle",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "medium",
  },
  {
    key: "tour.update",
    description: "Legacy aggregate tour update capability",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "medium",
  },
  {
    key: "tour.update.tripDetails",
    description: "Patch trip details / form architect fields",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "high",
  },
  {
    key: "tour.publish",
    description: "Transition draft tours to OPEN",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "high",
  },
  {
    key: "tour.regional.manage",
    description: "Regional scope operator for tours",
    owner: "tour-ops",
    module: "tours",
    riskLevel: "high",
  },
  {
    key: "settings.read",
    description: "Read workspace settings",
    owner: "platform",
    module: "settings",
    riskLevel: "low",
  },
  {
    key: "settings.themes.manage",
    description: "Manage workspace themes",
    owner: "platform",
    module: "settings",
    riskLevel: "medium",
  },
  {
    key: "module.finance",
    description: "Finance module gate",
    owner: "finance",
    module: "finance",
    riskLevel: "high",
  },
  {
    key: "module.form_builder",
    description: "Form builder module gate",
    owner: "platform",
    module: "form_builder",
    riskLevel: "medium",
  },
  {
    key: "marketing.segment.read",
    description: "Marketing segment read via label alias",
    owner: "crm",
    module: "marketing",
    riskLevel: "low",
  },
] as const;

const governedKeys = new Set(CAPABILITY_GOVERNANCE_REGISTRY.map((r) => r.key));

export function assertCapabilityGovernanceComplete(): void {
  const missing = WORKSPACE_CAPABILITY_VALUES.filter((cap) => !governedKeys.has(cap));
  if (missing.length > 0) {
    throw new Error(
      `Undocumented capabilities (add to CAPABILITY_GOVERNANCE_REGISTRY): ${missing.join(", ")}`,
    );
  }
  const unknown = CAPABILITY_GOVERNANCE_REGISTRY.filter(
    (r) => !(WORKSPACE_CAPABILITY_VALUES as readonly string[]).includes(r.key),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown governed capabilities: ${unknown.map((r) => r.key).join(", ")}`);
  }
  const dupes = CAPABILITY_GOVERNANCE_REGISTRY.map((r) => r.key).filter(
    (k, i, arr) => arr.indexOf(k) !== i,
  );
  if (dupes.length > 0) {
    throw new Error(`Duplicate capability governance keys: ${[...new Set(dupes)].join(", ")}`);
  }
  const missingOwner = CAPABILITY_GOVERNANCE_REGISTRY.filter((r) => !r.owner?.trim());
  if (missingOwner.length > 0) {
    throw new Error(`Capabilities missing owner: ${missingOwner.map((r) => r.key).join(", ")}`);
  }
}

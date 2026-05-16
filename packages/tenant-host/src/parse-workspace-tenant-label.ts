import { TENANT_SUBDOMAIN_REGEX } from "./constants";

export type WorkspaceTenantLabelOutcome =
  | { kind: "no_root_config" }
  | { kind: "apex" }
  | { kind: "outside_workspace" }
  | { kind: "reserved"; label: string }
  | { kind: "invalid_label"; label: string }
  | { kind: "label"; label: string };

export function normalizeRootDomain(rootDomain: string): string {
  return rootDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

/**
 * Maps `{label}.{root}` → workspace label when label matches {@link TENANT_SUBDOMAIN_REGEX}
 * and is not reserved.
 */
export function parseWorkspaceTenantLabelFromHost(
  normalizedHost: string,
  rootDomain: string,
  reservedLabels: Set<string>,
): WorkspaceTenantLabelOutcome {
  const root = normalizeRootDomain(rootDomain);
  if (!root) {
    return { kind: "no_root_config" };
  }

  const h = normalizedHost.trim().toLowerCase();
  if (h === root) {
    return { kind: "apex" };
  }

  const suffix = `.${root}`;
  if (!h.endsWith(suffix)) {
    return { kind: "outside_workspace" };
  }

  const label = h.slice(0, -suffix.length);
  if (!label || label.includes(".")) {
    return { kind: "outside_workspace" };
  }

  if (reservedLabels.has(label)) {
    return { kind: "reserved", label };
  }

  if (!TENANT_SUBDOMAIN_REGEX.test(label)) {
    return { kind: "invalid_label", label };
  }

  return { kind: "label", label };
}

export function resolveWorkspaceSlugFromNormalizedHost(
  normalizedHost: string,
  rootDomain: string,
  reservedLabels: Set<string>,
): string | null {
  const outcome = parseWorkspaceTenantLabelFromHost(normalizedHost, rootDomain, reservedLabels);
  return outcome.kind === "label" ? outcome.label : null;
}

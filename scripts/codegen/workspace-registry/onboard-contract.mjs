/**
 * Gap Closure E.4a — shared workspace onboard-contract evaluation (create→generate admission).
 * @see docs/dev/saas-platform-remediation.mdoc
 * @see scripts/guards/guard-workspace-onboard-contract.mjs
 */

/**
 * @param {readonly { readonly id: string }} manifests product workspace manifests
 * @param {string} generatedRegistrySource apps/api workspace-plugin-registry.generated.ts (or generateApiRegistry output)
 * @returns {{ ok: true; manifestIds: string[] } | { ok: false; violations: string[]; manifestIds: string[] }}
 */
export function evaluateWorkspaceOnboardContract(manifests, generatedRegistrySource) {
  const manifestIds = manifests.map((manifest) => manifest.id).sort((a, b) => a.localeCompare(b));

  /** @type {Set<string>} */
  const registeredIds = new Set();
  for (const match of generatedRegistrySource.matchAll(/case "([^"]+)":/g)) {
    registeredIds.add(match[1]);
  }
  if (registeredIds.size === 0) {
    for (const match of generatedRegistrySource.matchAll(/get([A-Za-z0-9]+)WorkspacePlugin/g)) {
      const pascal = match[1];
      const kebab = pascal
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
      registeredIds.add(kebab);
    }
  }

  /** @type {string[]} */
  const violations = [];
  for (const manifest of manifests) {
    if (!registeredIds.has(manifest.id)) {
      violations.push(
        `${manifest.id}: manifest present but missing from workspace-plugin-registry generated source`
      );
    }
  }
  for (const registeredId of registeredIds) {
    if (!manifestIds.includes(registeredId)) {
      violations.push(`${registeredId}: in generated registry but no matching product manifest`);
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations, manifestIds };
  }
  return { ok: true, manifestIds };
}

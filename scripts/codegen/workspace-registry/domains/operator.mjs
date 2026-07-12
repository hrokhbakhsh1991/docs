import { BANNER } from "../constants.mjs";

export function generateWorkspaceOperatorCapabilities(manifests) {
  /** @type {Record<string, { usersDirectory: boolean; reconciliationTriage: boolean; fieldExposureSurfaces: boolean }>} */
  const capabilities = {};
  for (const manifest of manifests) {
    const operatorCapabilities = manifest.operatorCapabilities;
    if (operatorCapabilities === undefined) {
      continue;
    }
    capabilities[manifest.id] = Object.freeze({
      usersDirectory: operatorCapabilities.usersDirectory === true,
      reconciliationTriage: operatorCapabilities.reconciliationTriage === true,
      fieldExposureSurfaces: operatorCapabilities.fieldExposureSurfaces === true,
    });
  }

  const entries = Object.entries(capabilities)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([pluginId, value]) =>
        `  ${JSON.stringify(pluginId)}: Object.freeze({ usersDirectory: ${value.usersDirectory}, reconciliationTriage: ${value.reconciliationTriage}, fieldExposureSurfaces: ${value.fieldExposureSurfaces} }),`
    )
    .join("\n");

  return `${BANNER}
/** Operator API capabilities — derived from workspace.manifest.json operatorCapabilities. */
export const WORKSPACE_OPERATOR_CAPABILITIES: Readonly<
  Record<
    string,
    Readonly<{
      readonly usersDirectory: boolean;
      readonly reconciliationTriage: boolean;
      readonly fieldExposureSurfaces: boolean;
    }>
  >
> = Object.freeze({
${entries}
});
`;
}

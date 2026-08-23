import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/**
 * @param {unknown} exposureHost
 * @param {string} workspaceId
 */
function assertSurfaceExposureResolverHostBinding(exposureHost, workspaceId) {
  const hostModule = exposureHost.surfaceExposureResolverHostModule;
  const builderExport = exposureHost.surfaceExposureResolverBuilderExport;
  const hasHostModule = typeof hostModule === "string" && hostModule.length > 0;
  const hasBuilderExport = typeof builderExport === "string" && builderExport.length > 0;
  if (hasHostModule !== hasBuilderExport) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: exposureHost.surfaceExposureResolverHostModule and surfaceExposureResolverBuilderExport must both be set or both omitted`
    );
  }
  if (!hasHostModule) {
    return null;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hostModule)) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: exposureHost.surfaceExposureResolverHostModule must be a kebab-case basename`
    );
  }
  return {
    hostModule,
    builderExport,
  };
}

/** Manifest `exposureHost` → API re-exports for exposure scheduler + surface resolver (WAC-001). */
export function generateExposureHostBindings(manifests) {
  /** @type {Map<string, Set<string>>} */
  const importsBySpecifier = new Map();
  /** @type {Set<string>} */
  const hostResolverReexports = new Set();

  for (const m of manifests) {
    const exposureHost = m.exposureHost;
    if (exposureHost === undefined) {
      continue;
    }
    if (typeof exposureHost.module !== "string") {
      throw new Error(`workspace.manifest.json ${m.id}: exposureHost.module is required`);
    }
    const spec = importSpecifier(m.package, exposureHost.module);
    if (!importsBySpecifier.has(spec)) {
      importsBySpecifier.set(spec, new Set());
    }
    const exports = importsBySpecifier.get(spec);
    const optionalExports = [
      exposureHost.surfaceDefaultFieldIdsExport,
      exposureHost.mapSurfaceToFieldPolicyExport,
      exposureHost.reminderOffsetsExport,
      exposureHost.exposureCoordinateTypeExport
        ? `type ${exposureHost.exposureCoordinateTypeExport}`
        : undefined,
    ];
    for (const name of optionalExports) {
      if (typeof name === "string" && name.length > 0) {
        exports.add(name);
      }
    }

    const resolverBinding = assertSurfaceExposureResolverHostBinding(exposureHost, m.id);
    if (resolverBinding !== null) {
      hostResolverReexports.add(
        `export { ${resolverBinding.builderExport} } from "./${resolverBinding.hostModule}";`
      );
    }
  }

  if (importsBySpecifier.size === 0 && hostResolverReexports.size === 0) {
    return `${BANNER}
/** No manifest exposureHost bindings. */
export {};
`;
  }

  const reexportLines = [...importsBySpecifier.entries()].map(([spec, exports]) => {
    return `export { ${[...exports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "${spec}";`;
  });
  const hostResolverLines = [...hostResolverReexports].sort((a, b) => a.localeCompare(b));

  return `${BANNER}
${reexportLines.join("\n")}
${hostResolverLines.length > 0 ? `\n${hostResolverLines.join("\n")}\n` : ""}`;
}

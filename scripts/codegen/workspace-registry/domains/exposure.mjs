import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/** Manifest `exposureHost` → API re-exports for exposure scheduler + surface resolver (WAC-001). */
export function generateExposureHostBindings(manifests) {
  /** @type {Map<string, Set<string>>} */
  const importsBySpecifier = new Map();

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
  }

  if (importsBySpecifier.size === 0) {
    return `${BANNER}
/** No manifest exposureHost bindings. */
export {};
`;
  }

  const reexportLines = [...importsBySpecifier.entries()].map(([spec, exports]) => {
    return `export { ${[...exports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "${spec}";`;
  });

  return `${BANNER}
${reexportLines.join("\n")}
`;
}

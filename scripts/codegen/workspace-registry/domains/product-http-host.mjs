import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/**
 * Manifest `productHttpHost` → API re-exports for product HTTP host configure + route deps types.
 * Hand-written configure adapters import from the generated façade so `/host/*` stays
 * isolation-legal (only *.generated.ts may import workspace host paths).
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateProductHttpHostBindings(manifests) {
  /** @type {Map<string, Set<string>>} */
  const importsBySpecifier = new Map();

  for (const m of manifests) {
    const productHttpHost = m.productHttpHost;
    if (productHttpHost === undefined) {
      continue;
    }
    if (typeof productHttpHost.module !== "string" || productHttpHost.module.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: productHttpHost.module is required`);
    }
    if (
      typeof productHttpHost.configureExport !== "string" ||
      productHttpHost.configureExport.length === 0
    ) {
      throw new Error(
        `workspace.manifest.json ${m.id}: productHttpHost.configureExport is required`,
      );
    }
    const spec = importSpecifier(m.package, productHttpHost.module);
    if (!importsBySpecifier.has(spec)) {
      importsBySpecifier.set(spec, new Set());
    }
    const exports = importsBySpecifier.get(spec);
    exports.add(productHttpHost.configureExport);
    const optional = [
      productHttpHost.routeDepsTypeExport
        ? `type ${productHttpHost.routeDepsTypeExport}`
        : undefined,
      productHttpHost.portsTypeExport ? `type ${productHttpHost.portsTypeExport}` : undefined,
    ];
    for (const name of optional) {
      if (typeof name === "string" && name.length > 0) {
        exports.add(name);
      }
    }
    const extras = productHttpHost.extraTypeExports;
    if (Array.isArray(extras)) {
      for (const raw of extras) {
        if (typeof raw === "string" && raw.length > 0) {
          exports.add(raw.startsWith("type ") ? raw : `type ${raw}`);
        }
      }
    }
  }

  if (importsBySpecifier.size === 0) {
    return `${BANNER}
/** No manifest productHttpHost bindings. */
export {};
`;
  }

  const reexportLines = [...importsBySpecifier.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([spec, exports]) => {
      return `export { ${[...exports].sort((a, b) => a.localeCompare(b)).join(", ")} } from "${spec}";`;
    });

  return `${BANNER}
${reexportLines.join("\n")}
`;
}

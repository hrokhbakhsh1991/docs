/** Plugin Contract paths — not prefixed with ./host (Phase 6 P2). */
export function isWorkspaceContractExportPath(entry) {
  if (entry === "." || entry === "./") return true;
  if (entry === "./plugin") return true;
  if (entry.startsWith("./theme/")) return true;
  if (entry.startsWith("./settings/")) return true;
  if (entry.startsWith("./field-registry/")) return true;
  if (entry.startsWith("./marketing/")) return true;
  if (entry.startsWith("./catalog/")) return true;
  return false;
}

/**
 * Resolve package export to ESM import specifier.
 * Manifest-bound modules use `./host/*`; contract uses `./plugin`, `./theme/*`, `./settings/*`, or package root.
 * @param {string} pkg
 * @param {string} entry
 */
export function importSpecifier(pkg, entry) {
  if (entry === ".") return pkg;
  if (isWorkspaceContractExportPath(entry)) {
    if (entry.startsWith("./")) return `${pkg}/${entry.slice(2)}`;
    return `${pkg}/${entry}`;
  }
  if (entry.startsWith("./")) return `${pkg}/host/${entry.slice(2)}`;
  return `${pkg}/host/${entry}`;
}

/**
 * Default smoke-tenant module path per workspace id (devBootstrap codegen).
 * @param {string} workspaceId
 */
export function defaultSmokeTenantModule(workspaceId) {
  if (workspaceId === "denali") return "./smoke/phase-6-denali-smoke-tenant";
  if (workspaceId === "urban") return "./smoke/phase-7-urban-smoke-tenant";
  return "./smoke/tenant";
}

/**
 * Uppercase underscore prefix for generated const names (hyphen ids → GUEST_CLUB).
 * @param {string} workspaceId
 */
export function workspaceManifestConstPrefix(workspaceId) {
  return workspaceId.replace(/-/g, "_").toUpperCase();
}

/**
 * Fail if generated TypeScript redeclares the same top-level binding name.
 * Catches merge fallout that would emit duplicate `const` / `function` symbols
 * into `*.generated.ts` (non-deterministic / invalid modules).
 *
 * @param {string} generatedSource
 * @param {string} [context]
 */
export function assertNoDuplicateEmittedSymbols(generatedSource, context = "codegen") {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const declRe =
    /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface)\s+([A-Za-z_][\w]*)/gm;
  let match;
  while ((match = declRe.exec(generatedSource)) !== null) {
    const name = match[1];
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([name, n]) => `${name}×${n}`);
  if (duplicates.length > 0) {
    throw new Error(
      `${context}: duplicate emitted symbols (merge-unsafe): ${duplicates.join(", ")}`
    );
  }
}

/**
 * Naive per-function scan: each `export function` body must not declare the same
 * `const name =` twice (brace-depth aware). Used by drop-in specs to catch
 * consolidation duplicates like `reexportsBySpecifier` before Node parses the module.
 *
 * @param {string} moduleSource
 * @param {string} [fileLabel]
 */
export function assertExportFunctionsHaveUniqueConstBindings(moduleSource, fileLabel = "module") {
  const exportFnStarts = [...moduleSource.matchAll(/^export function (\w+)\s*\(/gm)];
  for (let i = 0; i < exportFnStarts.length; i++) {
    const fnName = exportFnStarts[i][1];
    const bodyOpen = moduleSource.indexOf("{", exportFnStarts[i].index);
    if (bodyOpen < 0) continue;
    const bodyCloseExclusive =
      i + 1 < exportFnStarts.length ? exportFnStarts[i + 1].index : moduleSource.length;
    const region = moduleSource.slice(bodyOpen, bodyCloseExclusive);
    /** @type {string[]} */
    const constNames = [];
    let depth = 0;
    const lines = region.split("\n");
    for (const line of lines) {
      for (const ch of line) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }
      // Only top-of-function locals (depth === 1 after the opening brace line advances).
      const m = /^\s*const (\w+)\s*=/.exec(line);
      if (m && depth === 1) {
        constNames.push(m[1]);
      }
    }
    const seen = new Set();
    /** @type {string[]} */
    const dupes = [];
    for (const name of constNames) {
      if (seen.has(name)) dupes.push(name);
      seen.add(name);
    }
    if (dupes.length > 0) {
      throw new Error(
        `${fileLabel}: export function ${fnName} redeclares const bindings: ${[...new Set(dupes)].join(", ")}`
      );
    }
  }
}

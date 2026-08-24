#!/usr/bin/env node
/**
 * Dependency Purity Audit — TypeScript AST module resolver graph (foundation layer).
 * Does not read package.json dependency lists; only resolved import edges.
 *
 * Usage: node scripts/guards/foundation-import-purity-audit.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardRequire } from "./lib/guard-require.mjs";
import { REPO_ROOT } from "./foundation-gate-config.mjs";

const ts = guardRequire("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Foundation layer entry roots (KS-01). */
const FOUNDATION_SRC_ROOTS = [
  path.join(REPO_ROOT, "packages/workspace-sdk/src"),
  path.join(REPO_ROOT, "packages/workspace-sdk/test"),
  path.join(REPO_ROOT, "packages/config"),
];

/**
 * Resolved absolute path prefixes (repo-relative) that constitute Systemic Corruption.
 */
const CORRUPTION_REL_PREFIXES = [
  "apps/",
  "legacy/",
  "packages/ui-primitives/",
  "packages/theme-react/",
  "packages/design-tokens/",
  "packages/workspaces/",
];

const CORRUPTION_PACKAGE_PATTERNS = [
  /^@apps\//,
  /^@app-tour\/ui-primitives\b/,
  /^@app-tour\/theme-react\b/,
  /^@app-tour\/design-tokens\b/,
  /^@app-tour\/workspace-(?!sdk\b)/, // workspace-starter, workspace-denali, etc.
];

/**
 * Codegen dispatch shims must reference workspace packages at runtime.
 * REM-006 / CW9-09: allowlist generated files only (not hand-written imports).
 */
const GENERATED_DISPATCH_ALLOWLIST_SUFFIXES = [
  "catalog-intake-transport-surfaces.generated.ts",
  "catalog-transport-snapshot-readers.generated.ts",
  "workspace-difficulty-fitness-filter-presentation.generated.ts",
];

function isAllowlistedGeneratedDispatch(fileRel) {
  return GENERATED_DISPATCH_ALLOWLIST_SUFFIXES.some((suffix) => fileRel.endsWith(suffix));
}

function listTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "dist") continue;
        walk(p);
      } else if (/\.(ts|tsx|mts|cts)$/.test(ent.name)) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

function toRepoRel(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

function isCorruptAbsPath(absPath) {
  const rel = toRepoRel(absPath);
  if (CORRUPTION_REL_PREFIXES.some((p) => rel.startsWith(p))) {
    return true;
  }
  return false;
}

function isCorruptSpecifier(spec) {
  return CORRUPTION_PACKAGE_PATTERNS.some((re) => re.test(spec));
}

function loadCompilerOptions() {
  const configPath = path.join(REPO_ROOT, "packages/workspace-sdk/tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(ts.formatDiagnostic(read.error, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => REPO_ROOT,
    }));
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configPath),
  );
  return parsed.options;
}

function collectFoundationFiles() {
  /** @type {string[]} */
  const files = [];
  for (const root of FOUNDATION_SRC_ROOTS) {
    files.push(...listTsFiles(root));
  }
  return [...new Set(files)].sort();
}

/**
 * @param {ts.SourceFile} sourceFile
 * @param {import("typescript").Program} program
 * @returns {{ specifier: string, line: number, resolved: string | null, kind: string }[]}
 */
function collectResolvedEdges(sourceFile, program) {
  const checker = program.getTypeChecker();
  /** @type {{ specifier: string, line: number, resolved: string | null, kind: string }[]} */
  const edges = [];

  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  function addEdge(specifier, node, kind, resolvedOverride) {
    const line = lineOf(node);
    let resolved = resolvedOverride ?? null;

    if (resolved == null && !specifier.startsWith(".") && !specifier.startsWith("/")) {
      const ref = { fileName: sourceFile.fileName };
      const resolvedModule = ts.resolveModuleName(
        specifier,
        sourceFile.fileName,
        program.getCompilerOptions(),
        ts.sys,
      );
      if (resolvedModule.resolvedModule?.resolvedFileName) {
        resolved = path.normalize(resolvedModule.resolvedModule.resolvedFileName);
      }
    }

    if (resolved == null) {
      try {
        const mod = ts.resolveModuleName(
          specifier,
          sourceFile.fileName,
          program.getCompilerOptions(),
          ts.sys,
        );
        if (mod.resolvedModule?.resolvedFileName) {
          resolved = path.normalize(mod.resolvedModule.resolvedFileName);
        }
      } catch {
        /* unresolved */
      }
    }

    if (resolved == null) {
      try {
        const sym = checker.getSymbolAtLocation(node);
        if (sym?.declarations?.[0]) {
          const declFile = sym.declarations[0].getSourceFile()?.fileName;
          if (declFile) resolved = path.normalize(declFile);
        }
      } catch {
        /* ignore */
      }
    }

    edges.push({ specifier, line, resolved, kind });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const spec = node.moduleSpecifier;
      if (spec && (ts.isStringLiteral(spec) || ts.isNoSubstitutionTemplateLiteral(spec))) {
        addEdge(spec.text, spec, ts.isImportDeclaration(node) ? "import" : "export-from", null);
      }
    }

    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const isRequire =
        (ts.isIdentifier(expr) && expr.text === "require") ||
        (ts.isPropertyAccessExpression(expr) && expr.name.text === "require");
      if (isRequire && node.arguments[0]) {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          addEdge(arg.text, arg, "require", null);
        }
      }
      if (expr.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(sourceFile) === "import") {
        const arg = node.arguments[0];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
          addEdge(arg.text, arg, "dynamic-import", null);
        }
      }
    }

    if (ts.isImportEqualsDeclaration(node) && node.moduleReference) {
      const ref = node.moduleReference;
      if (ts.isExternalModuleReference(ref) && ref.expression) {
        const expr = ref.expression;
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
          addEdge(expr.text, expr, "import-equals", null);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

function isRepoSourceModule(absPath) {
  const rel = toRepoRel(absPath);
  if (rel.includes("node_modules/")) return false;
  return /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/.test(rel);
}

/**
 * Expand closure of all repo-local modules reachable from foundation roots (TS-resolved).
 * @param {string[]} entryFiles
 * @param {import("typescript").CompilerOptions} compilerOptions
 */
function expandRepoModuleClosure(entryFiles, compilerOptions) {
  /** @type {Set<string>} */
  const allFiles = new Set(entryFiles.map((f) => path.normalize(f)));
  /** @type {string[]} */
  const queue = [...allFiles];

  while (queue.length > 0) {
    const batch = queue.splice(0, 50);
    const program = ts.createProgram([...allFiles], { ...compilerOptions, noEmit: true });
    for (const fileName of batch) {
      const sf = program.getSourceFile(fileName);
      if (!sf) continue;
      for (const e of collectResolvedEdges(sf, program)) {
        if (!e.resolved || !isRepoSourceModule(e.resolved)) continue;
        const to = path.normalize(e.resolved);
        if (!allFiles.has(to)) {
          allFiles.add(to);
          queue.push(to);
        }
      }
    }
  }

  return [...allFiles].sort();
}

function buildAdjacency(program, moduleFiles) {
  /** @type {Map<string, { to: string, specifier: string, line: number, kind: string }[]>} */
  const adj = new Map();

  for (const fileName of moduleFiles) {
    const sf = program.getSourceFile(fileName);
    if (!sf) continue;
    const from = path.normalize(fileName);
    const edges = collectResolvedEdges(sf, program);
    /** @type {{ to: string, specifier: string, line: number, kind: string }[]} */
    const list = [];
    for (const e of edges) {
      if (!e.resolved) continue;
      const to = path.normalize(e.resolved);
      if (!isRepoSourceModule(to)) continue;
      list.push({ to, specifier: e.specifier, line: e.line, kind: e.kind });
    }
    adj.set(from, list);
  }
  return adj;
}

/**
 * @param {Map<string, { to: string, specifier: string, line: number, kind: string }[]>} adj
 * @param {string} start
 */
function findCorruptionPaths(adj, start) {
  /** @type {{ corrupt: string, path: { file: string, specifier: string, line: number, kind: string }[] }[]} */
  const findings = [];
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {{ file: string, specifier: string, line: number, kind: string }[]} */
  const stack = [];

  function dfs(file) {
    if (visited.has(file)) return;
    visited.add(file);

    if (isCorruptAbsPath(file)) {
      findings.push({
        corrupt: file,
        path: [...stack, { file, specifier: "(destination)", line: 0, kind: "corrupt-node" }],
      });
      return;
    }

    for (const edge of adj.get(file) ?? []) {
      if (isCorruptAbsPath(edge.to)) {
        findings.push({
          corrupt: edge.to,
          path: [
            ...stack,
            { file, specifier: edge.specifier, line: edge.line, kind: edge.kind },
            { file: edge.to, specifier: "(resolved)", line: 0, kind: "corrupt-target" },
          ],
        });
        continue;
      }
      stack.push({ file, specifier: edge.specifier, line: edge.line, kind: edge.kind });
      dfs(edge.to);
      stack.pop();
    }
  }

  dfs(start);
  return findings;
}

function findDirectSpecifierViolations(program, foundationFiles) {
  /** @type {{ file: string, specifier: string, line: number, kind: string, reason: string }[]} */
  const hits = [];
  for (const fileName of foundationFiles) {
    const sf = program.getSourceFile(fileName);
    if (!sf) continue;
    for (const e of collectResolvedEdges(sf, program)) {
      if (isCorruptSpecifier(e.specifier)) {
        hits.push({
          file: path.normalize(fileName),
          specifier: e.specifier,
          line: e.line,
          kind: e.kind,
          reason: "corrupt-package-specifier",
        });
      }
      if (e.resolved && isCorruptAbsPath(e.resolved)) {
        hits.push({
          file: path.normalize(fileName),
          specifier: e.specifier,
          line: e.line,
          kind: e.kind,
          reason: "corrupt-resolved-path",
        });
      }
    }
  }
  return hits;
}

function dedupeFindings(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function main() {
  const foundationFiles = collectFoundationFiles();
  const compilerOptions = loadCompilerOptions();
  const moduleClosure = expandRepoModuleClosure(foundationFiles, compilerOptions);
  const program = ts.createProgram(moduleClosure, {
    ...compilerOptions,
    noEmit: true,
  });

  const adj = buildAdjacency(program, moduleClosure);
  const directHits = findDirectSpecifierViolations(program, foundationFiles);

  /** @type {{ corrupt: string, path: { file: string, specifier: string, line: number, kind: string }[] }[]} */
  let transitiveFindings = [];
  for (const root of foundationFiles) {
    const normalized = path.normalize(root);
    transitiveFindings.push(...findCorruptionPaths(adj, normalized));
  }

  transitiveFindings = dedupeFindings(
    transitiveFindings,
    (f) => `${f.corrupt}|${f.path.map((p) => p.file).join("->")}`,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    methodology: "TypeScript compiler API (resolveModuleName + AST import/require/dynamic-import edges)",
    foundationRoots: FOUNDATION_SRC_ROOTS.map((r) => toRepoRel(r)),
    foundationFiles: foundationFiles.length,
    moduleClosureSize: moduleClosure.length,
    corruptionZones: CORRUPTION_REL_PREFIXES,
    directIllegalEdges: directHits.map((h) => ({
      ...h,
      file: toRepoRel(h.file),
    })),
    systemicCorruptionPaths: transitiveFindings.map((f) => ({
      corruptTarget: toRepoRel(f.corrupt),
      path: f.path.map((p) => ({
        file: toRepoRel(p.file),
        specifier: p.specifier,
        line: p.line,
        kind: p.kind,
      })),
    })),
    verdict:
      directHits.length === 0 && transitiveFindings.length === 0
        ? "PASS"
        : "FAIL",
  };

  report.directIllegalEdges = report.directIllegalEdges.filter(
    (e) => !isAllowlistedGeneratedDispatch(e.file),
  );

  /** Paths whose foundation hop chain includes codegen dispatch (runtime workspace load). */
  report.systemicCorruptionPaths = report.systemicCorruptionPaths.filter((finding) => {
    const foundationSteps = finding.path.filter((step) => step.kind !== "corrupt-target");
    return !foundationSteps.some((step) => isAllowlistedGeneratedDispatch(step.file));
  });

  const productionOnly = process.argv.includes("--production-only");
  if (productionOnly) {
    const isProd = (rel) =>
      rel.startsWith("packages/workspace-sdk/src/") && !rel.includes(".spec.");
    report.directIllegalEdges = report.directIllegalEdges.filter((e) => isProd(e.file));
    report.systemicCorruptionPaths = report.systemicCorruptionPaths.filter((p) =>
      p.path.every((step) => isProd(step.file) || step.kind === "corrupt-target"),
    );
    report.verdict =
      report.directIllegalEdges.length === 0 && report.systemicCorruptionPaths.length === 0
        ? "PASS"
        : "FAIL";
    report.scope = "production-src-only";
  } else {
    report.verdict =
      report.directIllegalEdges.length === 0 && report.systemicCorruptionPaths.length === 0
        ? "PASS"
        : "FAIL";
  }

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.verdict === "PASS" ? 0 : 1);
  }

  console.log(`foundation-import-purity-audit: ${report.verdict}`);
  console.log(`  foundation files: ${report.foundationFiles}`);
  console.log(`  direct illegal edges: ${report.directIllegalEdges.length}`);
  console.log(`  systemic corruption paths: ${report.systemicCorruptionPaths.length}`);
  process.exit(report.verdict === "PASS" ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { main as runFoundationImportPurityAudit };

/**
 * Static architecture boundary scanner for Denali API modules (Phase 4).
 *
 * Enforces layered dependencies (domain / app / infra) and forbids cross–bounded-context
 * relative imports. Legacy folder layouts are mapped to layers until modules adopt
 * `modules/{context}/{domain,app,infra}/` exclusively.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");

export const API_MODULES_ROOT = path.join(REPO_ROOT, "apps/api/src/modules");
const MODULES_PREFIX = "apps/api/src/modules/";

/** Paths outside bounded contexts that any layer may import via relative/absolute spec. */
const SHARED_KERNEL_PREFIXES = [
  "apps/api/src/common/",
  "apps/api/src/config/",
  "apps/api/src/database/",
  "apps/api/src/infra/",
];

export type Layer = "domain" | "app" | "infra";

export type ViolationKind =
  | "domain-must-not-import-app"
  | "domain-must-not-import-infra"
  | "app-must-not-import-infra"
  | "cross-module-import";

export type BoundaryViolation = {
  kind: ViolationKind;
  file: string;
  line: number;
  importSpecifier: string;
  targetFile: string | null;
  sourceLayer: Layer;
  targetLayer: Layer | null;
  sourceBoundedContext: string;
  targetBoundedContext: string | null;
  message: string;
};

export type ScanStats = {
  filesScanned: number;
  filesClassified: number;
  byLayer: Record<Layer, number>;
  unclassified: number;
};

const IMPORT_FROM_RE =
  /^\s*(?:import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?|export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+)['"]([^'"]+)['"]/;

function normPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walkTsFiles(abs, acc);
    } else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".d.ts")) {
      acc.push(abs);
    }
  }
  return acc;
}

function isTestFile(rel: string): boolean {
  return (
    rel.includes("/__tests__/") ||
    /\.(spec|unit-spec|e2e-spec)\.ts$/.test(rel) ||
    rel.endsWith(".test.ts")
  );
}

function isCompositionRoot(rel: string): boolean {
  return rel.endsWith(".module.ts") || rel.endsWith(".module.spec.ts");
}

/** Nest composition roots and wiring — excluded from layer dependency rules. */
function isExcludedFromLayerRules(rel: string): boolean {
  return (
    isTestFile(rel) ||
    isCompositionRoot(rel) ||
    rel.includes("/services/") ||
    rel.includes("/subscribers/")
  );
}

/**
 * Bounded context = first path segment under `apps/api/src/modules/`.
 * (e.g. `finance/ledger/...` and `finance/payments/...` share context `finance`.)
 */
export function getBoundedContext(relPath: string): string | null {
  if (!relPath.startsWith(MODULES_PREFIX)) return null;
  const tail = relPath.slice(MODULES_PREFIX.length);
  const segment = tail.split("/")[0];
  return segment ?? null;
}

/** Path within the bounded context (after `modules/{bc}/`). */
function pathWithinBoundedContext(relPath: string, bc: string): string {
  return relPath.slice(MODULES_PREFIX.length + bc.length + 1);
}

/**
 * Resolves a file to its architectural layer.
 *
 * Canonical (target) layout:
 * - `.../domain/**` → domain
 * - `.../app/**` → app
 * - `.../infra/**` → infra
 *
 * Transitional legacy mapping documented in MAP §62 / architecture-boundaries.spec.ts.
 */
export function resolveLayer(relPath: string): Layer | null {
  const bc = getBoundedContext(relPath);
  if (!bc) return null;

  const within = pathWithinBoundedContext(relPath, bc);
  const segments = within.split("/");
  const fileName = segments[segments.length - 1] ?? "";

  if (segments.includes("domain")) return "domain";
  if (segments.includes("app")) return "app";
  if (segments.includes("infra")) return "infra";

  if (segments.some((s) => s === "entities" || s === "repositories" || s === "adapters" || s === "gateways" || s === "gateway")) {
    return "infra";
  }
  if (fileName.endsWith(".entity.ts")) return "infra";

  if (
    segments.some(
      (s) =>
        s === "application" ||
        s === "services" ||
        s === "dto" ||
        s === "pipes" ||
        s === "controllers"
    )
  ) {
    return "app";
  }
  if (
    fileName.endsWith(".controller.ts") ||
    fileName.endsWith(".service.ts") ||
    fileName.endsWith(".orchestrator.ts") ||
    fileName.endsWith(".pipe.ts")
  ) {
    return "app";
  }

  if (segments.some((s) => s === "policies" || s === "pure" || s === "strategies" || s === "contracts")) {
    return "domain";
  }
  if (segments.includes("domain")) return "domain";

  if (segments.some((s) => s === "utils" || s === "constants" || s === "types")) {
    return "app";
  }

  if (fileName.endsWith(".policy.ts") || fileName.endsWith(".rules.ts")) {
    return "domain";
  }

  // Module-root orchestrators / handlers default to application layer.
  return "app";
}

function resolveTsImport(fromAbs: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.normalize(path.join(path.dirname(fromAbs), specifier));
  const candidates = [base, `${base}.ts`, path.join(base, "index.ts")];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function isSharedKernel(relPath: string): boolean {
  return SHARED_KERNEL_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function isPackageOrAliasImport(specifier: string): boolean {
  return !specifier.startsWith(".") && !specifier.startsWith("/");
}

function classifyLayerViolation(
  sourceLayer: Layer,
  targetLayer: Layer
): ViolationKind | null {
  if (sourceLayer === "domain") {
    if (targetLayer === "app") return "domain-must-not-import-app";
    if (targetLayer === "infra") return "domain-must-not-import-infra";
  }
  if (sourceLayer === "app" && targetLayer === "infra") {
    return "app-must-not-import-infra";
  }
  return null;
}

function parseImports(source: string): Array<{ specifier: string; line: number }> {
  const results: Array<{ specifier: string; line: number }> = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const match = IMPORT_FROM_RE.exec(line);
    if (match?.[1]) {
      results.push({ specifier: match[1], line: i + 1 });
      continue;
    }
    // Multiline: `import { …\n} from '…'`
    if (/^\s*import\s+(?:type\s+)?[{*]/.test(line) && !/\bfrom\s+['"]/.test(line)) {
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        const cont = lines[j];
        if (cont === undefined) break;
        const fromMatch = /^\s*\}\s+from\s+['"]([^'"]+)['"]/.exec(cont);
        if (fromMatch?.[1]) {
          results.push({ specifier: fromMatch[1], line: i + 1 });
          break;
        }
      }
    }
  }
  return results;
}

export function scanArchitectureBoundaries(): {
  violations: BoundaryViolation[];
  stats: ScanStats;
} {
  const violations: BoundaryViolation[] = [];
  const stats: ScanStats = {
    filesScanned: 0,
    filesClassified: 0,
    byLayer: { domain: 0, app: 0, infra: 0 },
    unclassified: 0,
  };

  const files = walkTsFiles(API_MODULES_ROOT).map((abs) => normPosix(path.relative(REPO_ROOT, abs)));

  for (const rel of files) {
    stats.filesScanned += 1;
    if (isExcludedFromLayerRules(rel)) continue;

    const sourceBc = getBoundedContext(rel);
    const sourceLayer = resolveLayer(rel);
    if (!sourceBc || !sourceLayer) {
      stats.unclassified += 1;
      continue;
    }
    stats.filesClassified += 1;
    stats.byLayer[sourceLayer] += 1;

    const abs = path.join(REPO_ROOT, rel);
    const source = fs.readFileSync(abs, "utf8");
    const imports = parseImports(source);

    for (const { specifier, line } of imports) {
      if (isPackageOrAliasImport(specifier)) continue;

      const targetAbs = resolveTsImport(abs, specifier);
      const targetRel = targetAbs ? normPosix(path.relative(REPO_ROOT, targetAbs)) : null;

      if (targetRel && isSharedKernel(targetRel)) continue;

      const targetBc = targetRel ? getBoundedContext(targetRel) : null;
      const targetLayer = targetRel ? resolveLayer(targetRel) : null;

      if (sourceBc && targetBc && sourceBc !== targetBc) {
        violations.push({
          kind: "cross-module-import",
          file: rel,
          line,
          importSpecifier: specifier,
          targetFile: targetRel,
          sourceLayer,
          targetLayer,
          sourceBoundedContext: sourceBc,
          targetBoundedContext: targetBc,
          message:
            `Cross-module relative import: ${sourceBc} must not import ${targetBc} directly ` +
            `(use ports/adapters or shared packages).`,
        });
        continue;
      }

      if (!targetRel || !targetLayer) continue;

      const layerViolation = classifyLayerViolation(sourceLayer, targetLayer);
      if (layerViolation) {
        violations.push({
          kind: layerViolation,
          file: rel,
          line,
          importSpecifier: specifier,
          targetFile: targetRel,
          sourceLayer,
          targetLayer,
          sourceBoundedContext: sourceBc,
          targetBoundedContext: targetBc,
          message:
            `${sourceLayer} layer must not import ${targetLayer} ` +
            `(${layerViolation.replace(/-/g, " ")}).`,
        });
      }
    }
  }

  violations.sort((a, b) => {
    const k = a.kind.localeCompare(b.kind);
    if (k !== 0) return k;
    const f = a.file.localeCompare(b.file);
    if (f !== 0) return f;
    return a.line - b.line;
  });

  return { violations, stats };
}

export function formatViolations(violations: BoundaryViolation[]): string {
  if (violations.length === 0) return "No architecture boundary violations.";

  const byKind = new Map<ViolationKind, BoundaryViolation[]>();
  for (const v of violations) {
    const list = byKind.get(v.kind) ?? [];
    list.push(v);
    byKind.set(v.kind, list);
  }

  const lines: string[] = [
    `Architecture boundary violations (${violations.length} total):`,
    "",
  ];

  for (const kind of [
    "domain-must-not-import-infra",
    "domain-must-not-import-app",
    "app-must-not-import-infra",
    "cross-module-import",
  ] as ViolationKind[]) {
    const group = byKind.get(kind);
    if (!group?.length) continue;
    lines.push(`## ${kind} (${group.length})`);
    for (const v of group) {
      const target = v.targetFile ?? v.importSpecifier;
      lines.push(`  ${v.file}:${v.line}  →  ${target}`);
      lines.push(`    ${v.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

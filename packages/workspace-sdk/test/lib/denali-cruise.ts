import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const CRUISE_DENALI_HELPER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cruise-no-denali-product-ids.mjs",
);

export type DepcruiseSummaryError = {
  rule?: { name?: string };
  from?: string;
  to?: string;
};

export type PackageBoundaryViolation = {
  from: string;
  line: number;
  kind: string;
  specifier: string;
  to: string | null;
};

function denaliCruiseTargetAbs(repoRoot: string, packageRootRel: string): string {
  const absRoot = path.join(repoRoot, packageRootRel);
  const srcDir = path.join(absRoot, "src");
  return fs.existsSync(srcDir) ? srcDir : absRoot;
}

/** Programmatic depcruise for no-denali-product-ids (one package root per process). */
export function cruiseDenaliViolations(
  repoRoot: string,
  packageRootRel: string,
): DepcruiseSummaryError[] {
  const absRoot = denaliCruiseTargetAbs(repoRoot, packageRootRel);
  const r = spawnSync(process.execPath, [CRUISE_DENALI_HELPER, absRoot], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const stdout = (r.stdout ?? "").trim();
  if (r.status === 0) {
    return [];
  }

  if (stdout.startsWith("[")) {
    return JSON.parse(stdout) as DepcruiseSummaryError[];
  }

  throw new Error(
    `depcruise failed for ${packageRootRel} (exit ${r.status}): ${(r.stderr ?? stdout).trim()}`,
  );
}

/**
 * Resolve source edges without crawling package directories. This is the
 * deterministic negative-proof for package ownership: depcruiser remains the
 * production graph guard, while this fixture check cannot follow pnpm links.
 */
export function findPackageBoundaryViolations(
  repoRoot: string,
  sourceFiles: string[],
  forbiddenPackageRootRel: string,
  forbiddenPackageNames: string[],
): PackageBoundaryViolation[] {
  const configPath = path.join(repoRoot, "packages/workspace-sdk/tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const compilerOptions = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configPath),
  ).options;
  const files = sourceFiles.map((file) => path.resolve(repoRoot, file));
  const program = ts.createProgram(files, { ...compilerOptions, noEmit: true });
  const forbiddenRoot = path.resolve(repoRoot, forbiddenPackageRootRel) + path.sep;
  const forbiddenNames = forbiddenPackageNames.map((name) => `${name}/`);
  const violations: PackageBoundaryViolation[] = [];

  const resolve = (sourceFile: ts.SourceFile, specifier: string): string | null => {
    const resolved = ts.resolveModuleName(
      specifier,
      sourceFile.fileName,
      compilerOptions,
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    return resolved ? path.resolve(resolved) : null;
  };

  for (const sourceFile of files) {
    const sf = program.getSourceFile(sourceFile);
    if (!sf) continue;
    const visit = (node: ts.Node): void => {
      let specifier: string | undefined;
      let kind = "";
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const mod = node.moduleSpecifier;
        if (mod && ts.isStringLiteral(mod)) {
          specifier = mod.text;
          kind = ts.isImportDeclaration(node) ? "import" : "export-from";
        }
      } else if (ts.isImportEqualsDeclaration(node)) {
        const ref = node.moduleReference;
        if (ts.isExternalModuleReference(ref) && ref.expression && ts.isStringLiteral(ref.expression)) {
          specifier = ref.expression.text;
          kind = "import-equals";
        }
      } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg)) {
          const expression = node.expression;
          if (ts.isIdentifier(expression) && expression.text === "require") kind = "require";
          else if (expression.kind === ts.SyntaxKind.ImportKeyword) kind = "dynamic-import";
        }
        if (kind) specifier = arg.text;
      }

      if (specifier && kind) {
        const resolved = resolve(sf, specifier);
        const packageMatch = forbiddenNames.some(
          (name) => specifier === name.slice(0, -1) || specifier.startsWith(name),
        );
        const pathMatch = resolved?.startsWith(forbiddenRoot) === true;
        if (packageMatch || pathMatch) {
          violations.push({
            from: path.relative(repoRoot, sourceFile).split(path.sep).join("/"),
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            kind,
            specifier,
            to: resolved ? path.relative(repoRoot, resolved).split(path.sep).join("/") : null,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return violations;
}

/** Cruise an absolute path (file or directory). */
export function cruiseDenaliViolationsAtAbsPath(
  repoRoot: string,
  absPath: string,
): DepcruiseSummaryError[] {
  const r = spawnSync(process.execPath, [CRUISE_DENALI_HELPER, absPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const stdout = (r.stdout ?? "").trim();
  if (r.status === 0) {
    return [];
  }

  if (stdout.startsWith("[")) {
    return JSON.parse(stdout) as DepcruiseSummaryError[];
  }

  throw new Error(
    `depcruise failed for ${absPath} (exit ${r.status}): ${(r.stderr ?? stdout).trim()}`,
  );
}

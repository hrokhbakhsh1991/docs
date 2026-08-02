import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const DENALI_WORKSPACE_PATH = /(?:^|[/@-])(?:workspace-)?denali(?:[/@-]|$)/i;
const MODULE_REFERENCE =
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\()(["'`])([^"'`]+)\1/g;

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function lineForOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function stripCommentsAndStrings(source) {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
    (match) => match.replace(/[^\n]/g, " ")
  );
}

export function inspectSource(file, source) {
  const violations = [];
  if (DENALI_WORKSPACE_PATH.test(file)) {
    violations.push({ file, line: 1, kind: "workspace-denali-path" });
  }
  for (const match of source.matchAll(MODULE_REFERENCE)) {
    if (DENALI_WORKSPACE_PATH.test(match[2])) {
      violations.push({ file, line: lineForOffset(source, match.index ?? 0), kind: "workspace-denali-import", value: match[2] });
    }
  }
  const executable = stripCommentsAndStrings(source);
  for (const match of executable.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    if (!/denali/i.test(match[0])) continue;
    violations.push({ file, line: lineForOffset(source, match.index ?? 0), kind: "denali-product-symbol", value: match[0] });
  }
  for (const match of source.matchAll(/(["'`])denali\1/gi)) {
    violations.push({ file, line: lineForOffset(source, match.index ?? 0), kind: "denali-product-id", value: "denali" });
  }
  return violations;
}

export function inspectPackageJson(file, source) {
  const manifest = JSON.parse(source);
  const violations = [];
  for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (DENALI_WORKSPACE_PATH.test(name) || DENALI_WORKSPACE_PATH.test(String(version))) {
        violations.push({ file, line: lineForOffset(source, source.indexOf(`"${name}"`)), kind: "workspace-denali-dependency", value: name });
      }
    }
  }
  return violations;
}

export function evaluateDenaliKernelBoundary(repoRoot) {
  const violations = [];
  for (const packageRelative of ["packages/tenant-kernel", "packages/platform-events"]) {
    const packageRoot = path.join(repoRoot, packageRelative);
    const packageJson = path.join(packageRoot, "package.json");
    if (fs.existsSync(packageJson)) {
      violations.push(...inspectPackageJson(path.relative(repoRoot, packageJson), fs.readFileSync(packageJson, "utf8")));
    }
    const sourceRoot = path.join(packageRoot, "src");
    for (const file of walkFiles(sourceRoot).filter((candidate) => SOURCE_EXTENSION.test(candidate))) {
      violations.push(...inspectSource(path.relative(repoRoot, file), fs.readFileSync(file, "utf8")));
    }
  }
  return { ok: violations.length === 0, violations };
}

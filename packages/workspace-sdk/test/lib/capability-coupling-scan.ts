import fs from "node:fs";
import path from "node:path";

const WORKSPACE_ID_LITERAL = String.raw`["'](?!(?:string|number|boolean|object|undefined|function|symbol|bigint|unknown|platform)["'])[a-z][a-z0-9-]*["']`;
const WORKSPACE_TYPE_BRANCH_PATTERN = new RegExp(
  String.raw`\bworkspaceType\s*(?:={2,3}|!={1,2})\s*${WORKSPACE_ID_LITERAL}|${WORKSPACE_ID_LITERAL}\s*(?:={2,3}|!={1,2})\s*\bworkspaceType\b`
);
const PLUGIN_ID_BRANCH_PATTERN = new RegExp(
  String.raw`\bpluginId\s*(?:={2,3}|!={1,2})\s*${WORKSPACE_ID_LITERAL}|${WORKSPACE_ID_LITERAL}\s*(?:={2,3}|!={1,2})\s*\bpluginId\b`
);
const MANIFEST_ID_DENALI_FALLBACK_PATTERN = /\bmanifest\.id\s*(?:={2,3}|!={1,2})\s*["']denali["']/;
const WORKSPACE_TYPE_FALLBACK_PATTERN = new RegExp(
  String.raw`\bworkspaceType\b\s*(?:\?\?|\|\|)\s*${WORKSPACE_ID_LITERAL}`
);
const PLUGIN_ID_FALLBACK_PATTERN = new RegExp(
  String.raw`\bpluginId\b\s*(?:\?\?|\|\|)\s*${WORKSPACE_ID_LITERAL}`
);

export const CAPABILITY_PACKAGE_ROOTS = [
  "packages/workspace-sdk/src/equipment",
  "packages/workspace-sdk/src/transport",
  "packages/workspace-sdk/src/itinerary",
  "packages/workspace-sdk/src/difficulty-fitness",
  "packages/workspace-sdk/src/pricing",
] as const;

export type CapabilityCouplingViolation = {
  readonly file: string;
  readonly line: number;
  readonly kind: string;
  readonly text: string;
};

/** @param {string} repoRoot */
export function walkTsSourceFiles(repoRoot: string, relRoot: string): string[] {
  const absRoot = path.join(repoRoot, relRoot);
  if (!fs.existsSync(absRoot)) {
    return [];
  }
  /** @type {string[]} */
  const files: string[] = [];
  const visit = (absDir: string): void => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
        continue;
      }
      if (entry.name.endsWith(".ts") && !entry.name.endsWith(".generated.ts")) {
        files.push(abs);
      }
    }
  };
  visit(absRoot);
  return files;
}

/** @param {string} repoRoot @param {readonly string[]} relRoots */
export function scanCapabilityCouplingViolations(
  repoRoot: string,
  relRoots: readonly string[] = CAPABILITY_PACKAGE_ROOTS,
): CapabilityCouplingViolation[] {
  /** @type {CapabilityCouplingViolation[]} */
  const violations: CapabilityCouplingViolation[] = [];

  for (const relRoot of relRoots) {
    for (const absFile of walkTsSourceFiles(repoRoot, relRoot)) {
      const relFile = path.relative(repoRoot, absFile).split(path.sep).join("/");
      const lines = fs.readFileSync(absFile, "utf8").split("\n");
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
          return;
        }
        const checks: Array<[string, RegExp]> = [
          ["workspace-type-branch", WORKSPACE_TYPE_BRANCH_PATTERN],
          ["plugin-id-branch", PLUGIN_ID_BRANCH_PATTERN],
          ["manifest-id-denali-fallback", MANIFEST_ID_DENALI_FALLBACK_PATTERN],
          ["workspace-type-fallback", WORKSPACE_TYPE_FALLBACK_PATTERN],
          ["plugin-id-fallback", PLUGIN_ID_FALLBACK_PATTERN],
        ];
        for (const [kind, pattern] of checks) {
          if (pattern.test(line)) {
            violations.push({
              file: relFile,
              line: index + 1,
              kind,
              text: trimmed,
            });
          }
        }
      });
    }
  }

  return violations.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.kind.localeCompare(right.kind),
  );
}

/** @param {string} repoRoot @param {string} relFile */
export function scanCapabilityCouplingViolationsInFile(
  repoRoot: string,
  relFile: string,
): CapabilityCouplingViolation[] {
  const abs = path.join(repoRoot, relFile);
  const relRoot = path.dirname(relFile);
  const all = scanCapabilityCouplingViolations(repoRoot, [relRoot]);
  return all.filter((violation) => violation.file === relFile.split(path.sep).join("/"));
}

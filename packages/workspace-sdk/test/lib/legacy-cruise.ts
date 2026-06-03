import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CRUISE_LEGACY_HELPER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cruise-no-legacy-imports.mjs",
);

export type DepcruiseSummaryError = {
  rule?: { name?: string };
  from?: string;
  to?: string;
};

function legacyCruiseTargetAbs(repoRoot: string, packageRootRel: string): string {
  const absRoot = path.join(repoRoot, packageRootRel);
  const srcDir = path.join(absRoot, "src");
  return fs.existsSync(srcDir) ? srcDir : absRoot;
}

/** Programmatic depcruise via isolated subprocess (one package per process). */
export function cruiseLegacyViolations(
  repoRoot: string,
  packageRootRel: string,
): DepcruiseSummaryError[] {
  const absRoot = legacyCruiseTargetAbs(repoRoot, packageRootRel);
  const r = spawnSync(process.execPath, [CRUISE_LEGACY_HELPER, absRoot], {
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

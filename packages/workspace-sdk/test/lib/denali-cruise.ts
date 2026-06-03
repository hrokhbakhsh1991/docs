import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CRUISE_DENALI_HELPER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cruise-no-denali-product-ids.mjs",
);

export type DepcruiseSummaryError = {
  rule?: { name?: string };
  from?: string;
  to?: string;
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

/** Cruise breach fixture + denali probe package (paired negative proof). */
export function cruiseDenaliBreachFixture(repoRoot: string): DepcruiseSummaryError[] {
  const breachFile = path.join(
    repoRoot,
    "packages/workspace-sdk/test/__fixtures__/denali-breach.ts",
  );
  const denaliProbe = path.join(repoRoot, "packages/workspaces/denali");
  const r = spawnSync(process.execPath, [CRUISE_DENALI_HELPER, breachFile, denaliProbe], {
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
    `depcruise failed for denali-breach fixture (exit ${r.status}): ${(r.stderr ?? stdout).trim()}`,
  );
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

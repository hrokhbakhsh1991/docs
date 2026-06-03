import fs from "node:fs";
import path from "node:path";

import { FOUNDATION_GATE_LEGACY_CRUISE_ROOTS } from "../../../../scripts/guards/foundation-gate-config.mjs";

export type LegacyImportScanScope = "foundation" | "monorepo";

/** Resolve H-12 scan scope from env (CI foundation/integration jobs set this). */
export function resolveLegacyImportScanScope(): LegacyImportScanScope {
  const raw = (process.env.LEGACY_IMPORT_SCAN_SCOPE ?? "").trim().toLowerCase();
  if (raw === "monorepo" || raw === "full") return "monorepo";
  if (raw === "foundation" || raw === "foundation-gate") return "foundation";
  if (process.env.PHASE_0_GUARD_SCOPE === "foundation") return "foundation";
  return "foundation";
}

/** Repo-relative package roots for legacy-import depcruise (H-12). */
export function listLegacyImportCruiseRoots(
  repoRoot: string,
  scope: LegacyImportScanScope = resolveLegacyImportScanScope(),
): string[] {
  if (scope === "foundation") {
    return FOUNDATION_GATE_LEGACY_CRUISE_ROOTS.filter((rel) =>
      fs.existsSync(path.join(repoRoot, rel)),
    );
  }
  return listPackageCruiseRoots(repoRoot);
}

/** Repo-relative package roots for per-package depcruise (KS-02 / H-02) — full monorepo. */
export function listPackageCruiseRoots(repoRoot: string): string[] {
  const packagesDir = path.join(repoRoot, "packages");
  const roots: string[] = [];
  if (!fs.existsSync(packagesDir)) return roots;

  for (const name of fs.readdirSync(packagesDir)) {
    const abs = path.join(packagesDir, name);
    if (!fs.statSync(abs).isDirectory()) continue;

    if (name === "workspaces") {
      for (const wsName of fs.readdirSync(abs)) {
        const wsAbs = path.join(abs, wsName);
        if (fs.statSync(wsAbs).isDirectory()) {
          roots.push(path.join("packages/workspaces", wsName));
        }
      }
      continue;
    }

    roots.push(path.join("packages", name));
  }

  return roots.sort();
}

/**
 * Resolve guard toolchain modules from scripts/guards/node_modules only.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GUARDS_DIR = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(GUARDS_DIR, "../..");

const guardsPackageJson = path.join(GUARDS_DIR, "package.json");
const guardsRequire = createRequire(guardsPackageJson);

/** @param {string} specifier */
export function guardResolve(specifier) {
  return guardsRequire.resolve(specifier);
}

/** @param {string} specifier */
export function guardRequire(specifier) {
  return guardsRequire(specifier);
}

function dependencyCruiserRoot() {
  return path.join(GUARDS_DIR, "node_modules", "dependency-cruiser");
}

/** Programmatic dependency-cruiser entry (cruise API). */
export function guardDepcruiseMain() {
  const main = path.join(dependencyCruiserRoot(), "src/main/index.mjs");
  if (!fs.existsSync(main)) {
    throw new Error(
      "dependency-cruiser main missing — run pnpm install (workspace @app-tour/guards)",
    );
  }
  return main;
}

/** dependency-cruiser CLI entry (not root node_modules/.bin). */
export function guardDepcruiseBin() {
  const pkgRoot = dependencyCruiserRoot();
  const pkg = JSON.parse(
    fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"),
  );
  const binRel =
    typeof pkg.bin === "string"
      ? pkg.bin
      : pkg.bin?.depcruise ?? Object.values(pkg.bin ?? {})[0];
  if (!binRel) {
    throw new Error(
      "dependency-cruiser bin missing — run pnpm install (workspace @app-tour/guards)",
    );
  }
  return path.join(pkgRoot, binRel);
}

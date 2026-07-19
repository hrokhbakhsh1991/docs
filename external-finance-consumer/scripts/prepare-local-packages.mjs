/**
 * Stage publishable-shaped copies of finance packages for outside-workspace install.
 *
 * BLOCKER (reported): @app-tour/finance-core depends on
 *   "@app-tour/finance-http-contracts": "workspace:*"
 * which cannot resolve when this fixture installs with --ignore-workspace.
 * This script rewrites that edge to a semver pin against the staged contracts package.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO = join(ROOT, "..");
const STAGE = join(ROOT, ".local-packages");

function mustBuild(pkgDir) {
  const dist = join(pkgDir, "dist", "index.js");
  try {
    readFileSync(dist);
  } catch {
    console.error(`Missing ${dist} — run package build first`);
    process.exit(1);
  }
}

function stagePackage(name, srcRel, rewriteDeps) {
  const src = join(MONOREPO, srcRel);
  mustBuild(src);
  const dest = join(STAGE, name);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(join(src, "dist"), join(dest, "dist"), { recursive: true });
  cpSync(join(src, "package.json"), join(dest, "package.json"));
  const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8"));
  if (rewriteDeps) rewriteDeps(pkg);
  // Simulate published artifact: strip private so install doesn't warn as harshly
  delete pkg.private;
  delete pkg.devDependencies;
  delete pkg.scripts;
  writeFileSync(join(dest, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  return dest;
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

stagePackage("finance-http-contracts", "packages/finance-http-contracts");
stagePackage("finance-core", "packages/finance-core", (pkg) => {
  pkg.dependencies = pkg.dependencies ?? {};
  // Publish-shaped: replace monorepo workspace protocol (blocks outside install).
  pkg.dependencies["@app-tour/finance-http-contracts"] = "file:../finance-http-contracts";
});

console.log("Staged publishable-shaped packages under .local-packages/");
console.log("Installing with --ignore-workspace …");

const install = spawnSync(
  "pnpm",
  ["install", "--ignore-workspace"],
  { cwd: ROOT, stdio: "inherit", shell: true }
);
process.exit(install.status ?? 1);

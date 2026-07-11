#!/usr/bin/env node
/**
 * Post-scaffold workspace onboarding — install, codegen, domain checks, build, test.
 * Usage: pnpm run workspace:onboard -- <id> [--guest]
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const DOMAIN_CHECKS = [
  "guard:workspace-registry-domain-core-registry",
  "guard:workspace-registry-domain-tour-api",
  "guard:workspace-registry-domain-wizard-admin",
  "guard:workspace-registry-domain-theme",
  "guard:workspace-registry-domain-guest-catalog",
  "guard:workspace-registry-domain-registration",
  "guard:workspace-registry-domain-member",
  "guard:workspace-registry-domain-http",
  "guard:workspace-registry-domain-settings-api",
  "guard:workspace-registry-domain-dev",
  "guard:workspace-registry-domain-operator",
];

/**
 * @param {string} cmd
 * @param {string[]} args
 */
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function usage() {
  console.error("Usage: pnpm run workspace:onboard -- <workspace-id> [--guest]");
  process.exit(1);
}

function main(argv) {
  const id = argv[2]?.trim();
  if (!id || id.startsWith("-")) {
    usage();
  }
  const guest = argv.includes("--guest");
  const pkgName = `@app-tour/workspace-${id}`;
  const workspaceDir = join(REPO_ROOT, "packages/workspaces", id);

  if (!existsSync(join(workspaceDir, "workspace.manifest.json"))) {
    console.error(`workspace:onboard: missing ${workspaceDir}/workspace.manifest.json`);
    console.error("Run: pnpm run workspace:create --", id, guest ? "--guest" : "");
    process.exit(1);
  }

  console.log(`== workspace:onboard ${id} ==`);

  run("pnpm", ["install"]);
  run("pnpm", ["run", "generate:workspace-registry"]);

  for (const script of DOMAIN_CHECKS) {
    run("pnpm", ["run", script]);
  }

  run("pnpm", ["run", "guard:workspace-registry-fresh"]);
  run("pnpm", ["run", "guard:workspace-onboard-contract"]);

  run("pnpm", ["--filter", pkgName, "run", "build"]);
  run("pnpm", ["--filter", pkgName, "run", "test"]);

  run("pnpm", ["run", "guard:workspace-plugin-surface"]);
  run("pnpm", ["run", "guard:workspace-peer-import"]);

  if (guest) {
    run("pnpm", ["run", "guard:guest-plugin-conformance"]);
    run("pnpm", ["run", "guard:workspace-certification"]);
  }

  console.log(`workspace:onboard: PASS (${pkgName})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv);
}

#!/usr/bin/env node
/**
 * Post-scaffold workspace onboarding — install, codegen, domain checks, build, test.
 * Usage: pnpm run workspace:onboard -- <id> [--guest] [--dry-run] [--skip-install] [--contract-only] [--from=build]
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
 * Gap Closure E.4a — printable full onboard recipe (does not execute).
 * @param {{ readonly id: string; readonly guest?: boolean }} input
 */
export function planWorkspaceOnboardSteps(input) {
  const id = input.id.trim();
  const guest = input.guest === true;
  const pkgName = `@app-tour/workspace-${id}`;
  /** @type {{ readonly phase: string; readonly command: string }[]} */
  const steps = [
    { phase: "create", command: `pnpm run workspace:create -- ${id}${guest ? " --guest" : ""}` },
    { phase: "install", command: "pnpm install" },
    { phase: "generate", command: "pnpm run generate:workspace-registry" },
  ];
  for (const script of DOMAIN_CHECKS) {
    steps.push({ phase: "domain-guard", command: `pnpm run ${script}` });
  }
  steps.push(
    { phase: "freshness", command: "pnpm run guard:workspace-registry-fresh" },
    { phase: "onboard-contract", command: "pnpm run guard:workspace-onboard-contract" },
    { phase: "build", command: `pnpm --filter ${pkgName} run build` },
    { phase: "test", command: `pnpm --filter ${pkgName} run test` },
    { phase: "surface", command: "pnpm run guard:workspace-plugin-surface" },
    { phase: "peer-import", command: "pnpm run guard:workspace-peer-import" }
  );
  if (guest) {
    steps.push(
      { phase: "guest-conformance", command: "pnpm run guard:guest-plugin-conformance" },
      { phase: "certification", command: "pnpm run guard:workspace-certification" }
    );
  }
  return { id, guest, pkgName, steps };
}

/**
 * E.4b-prep — JSON payload for `--dry-run` / print helpers (no side effects).
 * @param {ReturnType<typeof planWorkspaceOnboardSteps>} plan
 * @param {{ readonly mode?: "dry-run" | "plan" }} [opts]
 */
export function formatWorkspaceOnboardPlanPayload(plan, opts = {}) {
  const mode = opts.mode === "dry-run" ? "dry-run" : "plan";
  return {
    id: plan.id,
    guest: plan.guest,
    pkgName: plan.pkgName,
    mode,
    note:
      mode === "dry-run"
        ? "E.4b-prep dry-run — manifest checked; does not run install/build. Full execution: omit --dry-run"
        : "E.4a plan only — does not run install/build. Full execution: pnpm run workspace:onboard",
    steps: plan.steps,
  };
}

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
  console.error(
    "Usage: pnpm run workspace:onboard -- <workspace-id> [--guest] [--dry-run] [--skip-install] [--contract-only] [--from=build]"
  );
  process.exit(1);
}

/**
 * @param {string[]} flags
 */
function parseFromFlag(flags) {
  const fromFlag = flags.find((f) => f.startsWith("--from="));
  if (fromFlag === undefined) {
    return null;
  }
  const value = fromFlag.slice("--from=".length);
  if (value !== "build") {
    console.error(`Unknown --from value: ${value} (supported: build)`);
    usage();
  }
  return value;
}

function main(argv) {
  const args = argv.slice(2).filter((a) => a !== "--");
  const flags = args.filter((a) => a.startsWith("-"));
  const positionals = args.filter((a) => !a.startsWith("-"));
  const id = positionals[0]?.trim();
  if (!id) {
    usage();
  }
  const guest = flags.includes("--guest");
  const dryRun = flags.includes("--dry-run");
  const skipInstall = flags.includes("--skip-install");
  const contractOnly = flags.includes("--contract-only");
  const from = parseFromFlag(flags);
  const unknown = flags.filter(
    (a) =>
      a !== "--guest" &&
      a !== "--dry-run" &&
      a !== "--skip-install" &&
      a !== "--contract-only" &&
      !a.startsWith("--from=")
  );
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}`);
    usage();
  }
  if (dryRun && (contractOnly || from !== null || skipInstall)) {
    console.error("workspace:onboard: --dry-run cannot combine with --contract-only / --from / --skip-install");
    process.exit(1);
  }
  if (contractOnly && from !== null) {
    console.error("workspace:onboard: --contract-only cannot combine with --from");
    process.exit(1);
  }

  const pkgName = `@app-tour/workspace-${id}`;
  const workspaceDir = join(REPO_ROOT, "packages/workspaces", id);

  if (!existsSync(join(workspaceDir, "workspace.manifest.json"))) {
    console.error(`workspace:onboard: missing ${workspaceDir}/workspace.manifest.json`);
    console.error("Run: pnpm run workspace:create --", id, guest ? "--guest" : "");
    process.exit(1);
  }

  if (dryRun) {
    const plan = planWorkspaceOnboardSteps({ id, guest });
    console.log(JSON.stringify(formatWorkspaceOnboardPlanPayload(plan, { mode: "dry-run" }), null, 2));
    console.log(`workspace:onboard: DRY-RUN OK (${pkgName})`);
    return;
  }

  console.log(`== workspace:onboard ${id} ==`);

  if (from === "build") {
    run("pnpm", ["--filter", pkgName, "run", "build"]);
    run("pnpm", ["--filter", pkgName, "run", "test"]);
    run("pnpm", ["run", "guard:workspace-plugin-surface"]);
    run("pnpm", ["run", "guard:workspace-peer-import"]);
    if (guest) {
      run("pnpm", ["run", "guard:guest-plugin-conformance"]);
      run("pnpm", ["run", "guard:workspace-certification"]);
    }
    console.log(`workspace:onboard: PASS (${pkgName}) [from=build]`);
    return;
  }

  if (!skipInstall) {
    run("pnpm", ["install"]);
  }
  run("pnpm", ["run", "generate:workspace-registry"]);

  for (const script of DOMAIN_CHECKS) {
    run("pnpm", ["run", script]);
  }

  run("pnpm", ["run", "guard:workspace-registry-fresh"]);
  run("pnpm", ["run", "guard:workspace-onboard-contract"]);

  if (contractOnly) {
    console.log(`workspace:onboard: PASS (${pkgName}) [contract-only]`);
    return;
  }

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

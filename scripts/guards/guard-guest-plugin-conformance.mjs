#!/usr/bin/env node
/**
 * PF-4 — guest plugin conformance guard bundle (fail-fast).
 * @see docs/dev/guest-plugin-conformance.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SDK_DIST = path.join(REPO_ROOT, "packages/workspace-sdk/dist/index.js");

function ensureWorkspaceSdkBuilt() {
  if (fs.existsSync(SDK_DIST)) {
    return;
  }
  console.log(
    "guard-guest-plugin-conformance: building catalog-registration-auth + workspace-sdk (dist missing)"
  );
  for (const filter of ["@app-tour/catalog-registration-auth", "@app-tour/workspace-sdk"]) {
    const build = spawnSync("pnpm", ["--filter", filter, "run", "build"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: "inherit",
    });
    if (build.status !== 0) {
      console.error(`guard-guest-plugin-conformance: ${filter} build failed`);
      process.exit(1);
    }
  }
}

/** @type {{ name: string; cmd: string[] }[]} */
export const GUEST_CONFORMANCE_STEPS = [
  { name: "registry_fresh", cmd: ["node", "scripts/generate-workspace-registry.mjs", "--check"] },
  { name: "intake_plugin_registry", cmd: ["node", "scripts/guards/guard-intake-plugin-registry.mjs"] },
  { name: "guest_extension_schema", cmd: ["node", "scripts/guards/guard-guest-extension-schema.mjs"] },
  { name: "no_default_fallback", cmd: ["node", "scripts/guards/guard-no-default-fallback.mjs"] },
  { name: "generated_banner", cmd: ["node", "scripts/guards/guard-generated-banner.mjs"] },
  { name: "feature_flag_boundary", cmd: ["node", "scripts/guards/guard-feature-flag-boundary.mjs"] },
  { name: "guest_e2e_hooks", cmd: ["node", "scripts/guards/guard-guest-e2e-hooks.mjs"] },
  { name: "structured_errors", cmd: ["node", "scripts/guards/guard-structured-errors.mjs"] },
  { name: "no_todo_guest", cmd: ["node", "scripts/guards/guard-no-todo-guest.mjs"] },
  { name: "guest_reuse_from", cmd: ["node", "scripts/guards/guard-guest-reuse-from.mjs"] },
  { name: "guest_frozen_shell", cmd: ["node", "scripts/guards/guard-guest-frozen-shell.mjs"] },
  { name: "guest_api_shell", cmd: ["node", "scripts/guards/guard-guest-api-shell.mjs"] },
  { name: "guest_consumer_deps", cmd: ["node", "scripts/guards/guard-guest-consumer-deps.mjs"] },
  {
    name: "guest_conformance_dual_verify",
    cmd: ["node", "--test", "scripts/test/workspace-guest-conformance.spec.mjs"],
  },
  { name: "guest_seo", cmd: ["node", "scripts/guards/guard-guest-seo.mjs"] },
  { name: "guest_seo_e2e_hooks", cmd: ["node", "scripts/guards/guard-guest-seo-e2e-hooks.mjs"] },
  { name: "registration_flow_state", cmd: ["node", "scripts/guards/guard-registration-flow-state.mjs"] },
  { name: "member_portal_contract", cmd: ["node", "scripts/guards/guard-member-portal-contract.mjs"] },
  { name: "no_workspace_ids_in_codegen", cmd: ["node", "scripts/guards/guard-no-workspace-ids-in-codegen.mjs"] },
  { name: "no_workspace_type_branches", cmd: ["node", "scripts/guards/guard-no-workspace-type-branches.mjs"] },
  { name: "css_bootstrap_integrity", cmd: ["node", "scripts/guards/guard-css-bootstrap-integrity.mjs"] },
];

/**
 * @param {typeof GUEST_CONFORMANCE_STEPS} steps
 * @returns {string[]}
 */
export function runGuestConformanceSteps(steps) {
  /** @type {string[]} */
  const failures = [];

  for (const step of steps) {
    const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: process.env.GITHUB_ACTIONS === "true" ? "inherit" : "pipe",
    });
    if (result.status === 0) {
      console.log(`PASS guest_conformance/${step.name}`);
      continue;
    }
    failures.push(step.name);
    console.error(`FAIL guest_conformance/${step.name}`);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    if (output.length > 0) {
      console.error(output);
    }
  }

  return failures;
}

const sliceArg = process.argv[2];
const onlyIdx = process.argv.indexOf("--only");
const steps =
  onlyIdx >= 0
    ? (() => {
        const name = process.argv[onlyIdx + 1];
        const match = GUEST_CONFORMANCE_STEPS.filter((step) => step.name === name);
        if (match.length === 0) {
          console.error(`guard-guest-plugin-conformance: unknown step ${name}`);
          process.exit(2);
        }
        return match;
      })()
    : sliceArg == null
      ? GUEST_CONFORMANCE_STEPS
      : (() => {
          const [start, end] = sliceArg.split(/[:-]/).map((value) => Number(value));
          if (!Number.isInteger(start) || !Number.isInteger(end)) {
            console.error("guard-guest-plugin-conformance: invalid slice (use start:end)");
            process.exit(2);
          }
          return GUEST_CONFORMANCE_STEPS.slice(start, end);
        })();

ensureWorkspaceSdkBuilt();

const failures = runGuestConformanceSteps(steps);

if (failures.length > 0) {
  const summary = failures.map((name) => `- \`${name}\``).join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Guest conformance failures\n${summary}\n`
    );
  }
  console.error(`guard-guest-plugin-conformance: FAIL (${failures.join(", ")})`);
  process.exit(1);
}

console.log("guard-guest-plugin-conformance: PASS");
